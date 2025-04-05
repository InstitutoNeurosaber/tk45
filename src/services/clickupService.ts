import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ClickUpAPI } from '../lib/clickup';
import type { Ticket, Comment, TicketStatus, TicketPriority } from '../types/ticket';
import type { ClickUpConfig } from '../types/clickup';

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

export class ClickUpService {
  private async getConfig(): Promise<ClickUpConfig | null> {
    try {
      const configsRef = collection(db, 'clickup_configs');
      const q = query(configsRef, where('active', '==', true));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const configDoc = snapshot.docs[0];
        return {
          id: configDoc.id,
          ...configDoc.data(),
          createdAt: configDoc.data().createdAt.toDate(),
          updatedAt: configDoc.data().updatedAt.toDate()
        } as ClickUpConfig;
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar configuração do ClickUp:', error);
      return null;
    }
  }

  async isConfigured(): Promise<boolean> {
    try {
      const config = await this.getConfig();
      if (!config || !config.active || !config.apiKey) {
        return false;
      }

      // Testa a conexão com o ClickUp
      const api = new ClickUpAPI(config.apiKey);
      await api.getWorkspaces();
      return true;
    } catch (error) {
      console.error('Erro ao verificar configuração do ClickUp:', error);
      return false;
    }
  }

  private async getAPI(): Promise<ClickUpAPI> {
    const config = await this.getConfig();
    if (!config || !config.active || !config.apiKey) {
      throw new Error('Configuração do ClickUp não encontrada ou inativa');
    }
    return new ClickUpAPI(config.apiKey);
  }

  /**
   * Sincroniza um ticket com o ClickUp, criando ou atualizando uma tarefa
   * @param ticket Ticket a ser sincronizado
   * @param options Opções adicionais para a sincronização
   * @returns ID da tarefa criada/atualizada no ClickUp
   */
  async syncTicketWithClickUp(
    ticket: Ticket, 
    options?: { 
      source?: string; 
      skipWebhookUpdate?: boolean 
    }
  ): Promise<string | null> {
    console.log(`[ClickUpService] Iniciando sincronização de ticket ${ticket.id} com o ClickUp. Origem: ${options?.source || 'não especificada'}`);
    
    try {
      // Verificar configuração do ClickUp
      const isConfigured = await this.isConfigured();
      if (!isConfigured) {
        console.error('[ClickUpService] ClickUp não está configurado para sincronização');
        throw new Error('ClickUp não está configurado');
      }
      
      console.log(`[ClickUpService] Verificando existência de tarefa para ticket ${ticket.id}`);
      
      // Verificar se já existe uma tarefa no ClickUp para este ticket
      if (ticket.taskId) {
        console.log(`[ClickUpService] Atualizando tarefa existente ${ticket.taskId}`);
        
        // Se já existe, atualizar a tarefa
        try {
          // Verificar se a tarefa ainda existe no ClickUp
          const api = await this.getAPI();
          console.log(`[ClickUpService] Verificando se tarefa ${ticket.taskId} existe no ClickUp`);
          try {
            const taskExists = await api.taskExists(ticket.taskId);
            
            if (!taskExists) {
              console.error(`[ClickUpService] Tarefa ${ticket.taskId} não encontrada no ClickUp. Criando nova tarefa.`);
              // Se não existir mais, criar uma nova tarefa
              return await this.createNewTask(ticket);
            }
            
            // Atualizar os campos da tarefa
            console.log(`[ClickUpService] Iniciando atualização de campos da tarefa ${ticket.taskId}`);
            
            // 1. Atualizar campos básicos
            const updateData = {
              name: ticket.title,
              description: ticket.description,
              priority: this.getPriorityLevel(ticket.priority),
              due_date: ticket.deadline ? ticket.deadline.getTime() : undefined
            };
            
            console.log(`[ClickUpService] Atualizando tarefa ${ticket.taskId} com dados:`, JSON.stringify(updateData));
            await api.updateTask(ticket.taskId, updateData);
            
            // 2. Atualizar status em uma etapa separada
            // O ClickUp trata a atualização de status de forma especial
            console.log(`[ClickUpService] Atualizando status da tarefa ${ticket.taskId} para '${this.mapStatus(ticket.status)}'`);
            await api.updateTaskStatus(ticket.taskId, this.mapStatus(ticket.status));
            console.log(`[ClickUpService] Status atualizado para ${this.mapStatus(ticket.status)}`);
            
            console.log(`[ClickUpService] Sincronização completa para tarefa ${ticket.taskId}`);
            return ticket.taskId;
          } catch (error) {
            console.error(`[ClickUpService] Erro ao verificar/atualizar tarefa ${ticket.taskId}:`, error);
            throw error;
          }
        } catch (error) {
          console.error(`[ClickUpService] Erro na atualização da tarefa ${ticket.taskId}:`, error);
          if (error instanceof Error && (
            error.message.includes('not found') || 
            error.message.includes('não encontrada') ||
            error.message.includes('Resource not found')
          )) {
            // Tarefa não existe mais, criar uma nova
            console.log(`[ClickUpService] Tarefa não existe mais no ClickUp. Criando nova tarefa para ticket ${ticket.id}`);
            return await this.createNewTask(ticket);
          }
          throw error;
        }
      } else {
        console.log(`[ClickUpService] Nenhum taskId encontrado para ticket ${ticket.id}. Criando nova tarefa.`);
        // Se não existe, criar uma nova tarefa
        return await this.createNewTask(ticket);
      }
    } catch (error) {
      console.error(`[ClickUpService] Erro ao sincronizar ticket ${ticket.id} com o ClickUp:`, error);
      throw new Error('Erro ao sincronizar com o ClickUp: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  }

  // Método auxiliar para criar uma nova tarefa
  async createNewTask(ticket: Ticket): Promise<string | null> {
    console.log(`[ClickUpService] Criando nova tarefa para ticket ${ticket.id}`);
    try {
      const config = await this.getConfig();
      if (!config || !config.listId) {
        console.error('[ClickUpService] Configuração inválida, não é possível criar tarefa');
        throw new Error('Configuração do ClickUp incompleta');
      }

      const api = await this.getAPI();
      
      // Validar dados básicos
      if (!ticket.title) {
        throw new Error('Título da tarefa é obrigatório');
      }
      
      // Preparar data de prazo
      const dueDate = ticket.deadline instanceof Date 
        ? ticket.deadline.getTime() 
        : ticket.deadline 
          ? new Date(ticket.deadline).getTime() 
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).getTime();
      
      // Criar tarefa com dados completos
      console.log(`[ClickUpService] Enviando dados para criar tarefa na lista ${config.listId}`);
      const taskData = {
        id: ticket.id, // Incluir ID do ticket para referência
        name: ticket.title,
        description: `${ticket.description || "Sem descrição"}\n\nTicket ID: ${ticket.id}`, // Adicionamos o ID no texto para rastreamento
        status: this.mapStatus(ticket.status),
        priority: this.getPriorityLevel(ticket.priority),
        due_date: dueDate
        // Removendo custom_fields para evitar o erro
      };
      
      console.log(`[ClickUpService] Dados da tarefa:`, JSON.stringify(taskData));
      const response = await api.createTask(config.listId, taskData);
      
      if (response && typeof response === 'object' && 'id' in response) {
        console.log(`[ClickUpService] Tarefa criada com sucesso. ID: ${response.id}`);
        return response.id as string;
      } else {
        console.error('[ClickUpService] Resposta inválida ao criar tarefa:', response);
        throw new Error('Resposta da API não contém ID da tarefa');
      }
    } catch (error) {
      console.error('[ClickUpService] Erro ao criar tarefa:', error);
      throw error;
    }
  }

  async createTaskFromTicket(ticket: Ticket): Promise<void> {
    try {
      const config = await this.getConfig();
      if (!config) {
        throw new Error('Configuração do ClickUp não encontrada');
      }

      const api = await this.getAPI();

      // Verifica se já existe uma tarefa com esse ID
      const taskExists = await api.taskExists(ticket.id);
      if (taskExists) {
        throw new Error('Já existe uma tarefa no ClickUp com este ID');
      }

      await api.createTask(config.listId, {
        name: ticket.title,
        description: ticket.description,
        status: this.mapStatus(ticket.status),
        priority: this.getPriorityLevel(ticket.priority),
        due_date: ticket.deadline.getTime()
      });
    } catch (error) {
      console.error('Erro ao criar tarefa no ClickUp:', error);
      throw new Error('Erro ao criar tarefa no ClickUp: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  }

  async updateTaskStatus(ticket: Ticket): Promise<void> {
    try {
      const config = await this.getConfig();
      if (!config) {
        throw new Error('Configuração do ClickUp não encontrada');
      }

      const api = await this.getAPI();

      // Verifica se a tarefa existe antes de tentar atualizar
      const taskExists = await api.taskExists(ticket.id);
      if (!taskExists) {
        throw new Error('Tarefa não encontrada no ClickUp');
      }

      await api.updateTaskStatus(ticket.id, this.mapStatus(ticket.status));
    } catch (error) {
      console.error('Erro ao atualizar status da tarefa no ClickUp:', error);
      throw new Error('Erro ao atualizar status da tarefa no ClickUp: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  }

  async deleteTask(ticket: Ticket): Promise<void> {
    try {
      const config = await this.getConfig();
      if (!config) {
        throw new Error('Configuração do ClickUp não encontrada');
      }

      const api = await this.getAPI();

      // Verifica se a tarefa existe antes de tentar deletar
      const taskExists = await api.taskExists(ticket.id);
      if (!taskExists) {
        // Se a tarefa não existe, consideramos como sucesso
        return;
      }

      await api.deleteTask(ticket.id);
    } catch (error) {
      if (error instanceof Error && error.message.includes('API Key inválida')) {
        throw new Error('API Key do ClickUp inválida ou expirada. Por favor, verifique suas configurações.');
      }
      console.error('Erro ao deletar tarefa no ClickUp:', error);
      throw new Error('Erro ao deletar tarefa no ClickUp: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  }

  async addComment(taskId: string, comment: Comment): Promise<void> {
    try {
      console.log(`[ClickUpService] Tentando adicionar comentário à tarefa ${taskId}`);
      const config = await this.getConfig();
      if (!config) {
        console.error('[ClickUpService] Configuração do ClickUp não encontrada');
        throw new Error('Configuração do ClickUp não encontrada');
      }

      const api = await this.getAPI();

      // IMPORTANTE: O parâmetro taskId é o ID da tarefa no ClickUp, não o ID do ticket
      // Verifica se a tarefa existe antes de tentar adicionar comentário
      try {
        console.log(`[ClickUpService] Verificando se a tarefa ${taskId} existe no ClickUp`);
        const taskExists = await api.taskExists(taskId);
        if (!taskExists) {
          console.error(`[ClickUpService] Tarefa com ID ${taskId} não encontrada no ClickUp`);
          throw new Error('Tarefa não encontrada no ClickUp');
        }
        
        console.log(`[ClickUpService] Tarefa ${taskId} encontrada, adicionando comentário: "${comment.content.substring(0, 30)}..."`);
        await api.addComment(taskId, {
          content: comment.content,
          userId: comment.userId,
          ticketId: comment.ticketId
        });
        console.log(`[ClickUpService] Comentário adicionado com sucesso à tarefa ${taskId}`);
      } catch (error) {
        console.error(`[ClickUpService] Erro ao verificar/adicionar comentário na tarefa ${taskId}:`, error);
        throw error;
      }
    } catch (error) {
      console.error('[ClickUpService] Erro ao adicionar comentário no ClickUp:', error);
      throw new Error('Erro ao adicionar comentário no ClickUp: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  }

  /**
   * Mapeia os status do sistema para os status no ClickUp
   * @param status Status do sistema 
   * @returns Status equivalente no ClickUp
   */
  mapStatus(status: TicketStatus): string {
    console.log(`[ClickUpService] Mapeando status do sistema: ${status}`);
    
    // Mapeamento de status do sistema para o ClickUp
    // Importante: usar exatamente os nomes de status configurados no ClickUp
    switch (status) {
      case 'open':
        return 'ABERTO';
      case 'in_progress':
        return 'EM ANDAMENTO';
      case 'resolved':
        return 'RESOLVIDO';
      case 'closed':
        return 'FECHADO';
      default:
        console.warn(`[ClickUpService] Status desconhecido: ${status}, usando status padrão 'ABERTO'`);
        return 'ABERTO';
    }
  }

  /**
   * Mapeia os status do ClickUp para os status do sistema
   * @param clickupStatus Status do ClickUp
   * @returns Status equivalente no sistema
   */
  mapClickUpStatusToSystem(clickupStatus: string): TicketStatus {
    console.log(`[ClickUpService] Mapeando status do ClickUp: ${clickupStatus}`);
    
    // Normalizar o status para comparação (sem case sensitive)
    const normalizedStatus = clickupStatus.toUpperCase();
    
    // Mapeamento de status do ClickUp para o sistema
    if (normalizedStatus === 'ABERTO') {
      return 'open';
    } else if (normalizedStatus === 'EM ANDAMENTO') {
      return 'in_progress';
    } else if (normalizedStatus === 'RESOLVIDO') {
      return 'resolved';
    } else if (normalizedStatus === 'FECHADO') {
      return 'closed';
    } else {
      console.warn(`[ClickUpService] Status do ClickUp desconhecido: ${clickupStatus}, mapeando para 'open'`);
      return 'open';
    }
  }

  // Mapeia as prioridades do sistema para as prioridades do ClickUp
  getPriorityLevel(priority: TicketPriority): number {
    console.log(`[ClickUpService] Mapeando prioridade: ${priority}`);
    switch (priority) {
      case 'low':
        return 4; // Baixa no ClickUp
      case 'medium':
        return 3; // Média no ClickUp
      case 'high':
        return 2; // Alta no ClickUp
      case 'critical':
        return 1; // Urgente no ClickUp
      default:
        console.log(`[ClickUpService] Prioridade não reconhecida: ${priority}, usando 3 (média) como padrão`);
        return 3;
    }
  }
}

// Exportar uma instância única do serviço para uso nos componentes
export const clickupService = new ClickUpService();