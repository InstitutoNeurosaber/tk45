import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ClickUpAPI } from '../lib/clickup/api';
import type { Ticket } from '../types/ticket';
import type { ClickUpConfig } from '../types/clickup';
import { create } from 'zustand';
import { ClickUpConfigManager } from '../lib/clickup/config';
import { useAuthStore } from '../stores/authStore';
import {
  CLICKUP_API_BASE, 
  STATUS_MAP, 
  PRIORITY_MAP,
  ERROR_MESSAGES,
  TICKET_ID_FIELD_NAME,
  isValidTicketId
} from '../constants/clickup';

export class ClickUpService {
  private _apiKey: string | null = null;
  private configManager = new ClickUpConfigManager();
  private _lastErrorTimestamp: number = 0;
  private _consecutiveErrors: number = 0;

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
      
      console.log('[ClickUpService] Nenhuma configuração ativa encontrada');
      return null;
    } catch (error) {
      console.error('[ClickUpService] Erro ao buscar configuração:', error);
      return null;
    }
  }

  async isConfigured(): Promise<boolean> {
    try {
      const config = await this.getConfig();
      if (!config || !config.active || !config.apiKey) {
        console.log('[ClickUpService] Configuração inválida ou inativa');
        return false;
      }

      // Testa a conexão com o ClickUp
      const api = new ClickUpAPI(config.apiKey);
      await api.validateApiKey();
      return true;
    } catch (error) {
      console.error('[ClickUpService] Erro ao verificar configuração:', error);
      return false;
    }
  }

  private async getAPI(): Promise<ClickUpAPI> {
    const config = await this.getConfig();
    if (!config || !config.active || !config.apiKey) {
      console.error('[ClickUpService] Configuração não encontrada ou inativa');
      throw new Error(ERROR_MESSAGES.INVALID_API_KEY);
    }
    return new ClickUpAPI(config.apiKey);
  }
  
  private shouldThrottleError(): boolean {
    const now = Date.now();
    
    // Se o último erro foi há mais de 1 minuto, resetar o contador
    if (now - this._lastErrorTimestamp > 60000) {
      this._consecutiveErrors = 0;
      this._lastErrorTimestamp = now;
      return false;
    }
    
    // Incrementar contador se estiver no período de throttle
    this._consecutiveErrors += 1;
    this._lastErrorTimestamp = now;
    
    // Throttle após 3 erros consecutivos em menos de 1 minuto
    return this._consecutiveErrors > 3;
  }

  /**
   * Sincroniza um ticket com o ClickUp, criando ou atualizando uma tarefa
   * @param ticket Ticket a ser sincronizado
   * @returns ID da tarefa criada/atualizada no ClickUp
   */
  async syncTicketWithClickUp(ticket: Ticket): Promise<string | null> {
    if (this.shouldThrottleError()) {
      console.warn('[ClickUpService] Muitas falhas consecutivas, aguardando antes de tentar novamente');
      return null;
    }
    
    try {
      console.log(`[ClickUpService] Sincronizando ticket ${ticket.id} com o ClickUp`);
      
      const config = await this.getConfig();
      if (!config) {
        console.log('[ClickUpService] Configuração não encontrada, pulando sincronização');
        return null;
      }

      if (!config.listId) {
        console.error('[ClickUpService] ListID não encontrado na configuração');
        throw new Error(ERROR_MESSAGES.LIST_ID_REQUIRED);
      }

      const api = await this.getAPI();
      
      // Verificar se a lista existe antes de tentar criar a tarefa
      try {
        console.log(`[ClickUpService] Verificando lista ${config.listId}`);
        await api.getAllTasks(config.listId);
        console.log(`[ClickUpService] Lista ${config.listId} encontrada com sucesso`);
      } catch (error) {
        console.error(`[ClickUpService] Erro ao verificar lista ${config.listId}:`, error);
        throw new Error(ERROR_MESSAGES.LIST_NOT_FOUND);
      }
      
      // Se o ticket já tem uma tarefa associada, verifica se ela existe
      if (ticket.taskId) {
        try {
          console.log(`[ClickUpService] Verificando tarefa ${ticket.taskId}`);
          const taskExists = await api.taskExists(ticket.taskId);
          if (taskExists) {
            // Atualiza a tarefa existente
            console.log(`[ClickUpService] Atualizando tarefa ${ticket.taskId}`);
            
            // Mapeia o status usando a constante padronizada
            const clickupStatus = STATUS_MAP[ticket.status as keyof typeof STATUS_MAP] || STATUS_MAP.open;
            await api.updateTaskStatus(ticket.taskId, clickupStatus);
            
            // Atualiza outros campos se necessário
            const updateData = {
              name: ticket.title,
              description: ticket.description,
              priority: PRIORITY_MAP[ticket.priority as keyof typeof PRIORITY_MAP] || PRIORITY_MAP.medium,
              dueDate: ticket.deadline instanceof Date ? 
                ticket.deadline.toISOString() : 
                new Date(ticket.deadline).toISOString()
            };
            
            // Atualiza a tarefa com a API do ClickUp
            await api.request(`/task/${ticket.taskId}`, {
              method: 'PUT',
              body: JSON.stringify(updateData)
            });
            
            // Reset contador de erros após sucesso
            this._consecutiveErrors = 0;
            
            return ticket.taskId;
          } else {
            console.log(`[ClickUpService] Tarefa ${ticket.taskId} não encontrada, criando nova`);
          }
        } catch (error) {
          console.error(`[ClickUpService] Erro ao verificar tarefa ${ticket.taskId}:`, error);
          // Continuará para criar uma nova tarefa
        }
      }
      
      // Prepara dados para criar nova tarefa
      try {
        // Validação de dados
        if (!ticket.title) {
          console.error("[ClickUpService] Título do ticket vazio");
          throw new Error("Título do ticket é obrigatório para criar no ClickUp");
        }
        
        // Garantir que a data de prazo está em formato válido
        let dueDate: string | null = null;
        if (ticket.deadline) {
          if (ticket.deadline instanceof Date) {
            dueDate = ticket.deadline.toISOString();
          } else {
            try {
              const date = new Date(ticket.deadline);
              if (isNaN(date.getTime())) {
                console.warn("[ClickUpService] Data de prazo inválida, usando atual + 7 dias");
                dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
              } else {
                dueDate = date.toISOString();
              }
            } catch (e) {
              console.warn("[ClickUpService] Erro ao converter data, usando atual + 7 dias");
              dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            }
          }
        } else {
          console.warn("[ClickUpService] Ticket sem prazo, usando atual + 7 dias");
          dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        }
        
        // Adicionar ID personalizado para rastreamento
        let customFields = [];
        if (isValidTicketId(ticket.id)) {
          // Não enviar o campo personalizado custom_fields
          // O problema está aqui - o campo está causando erro porque o ID precisa ser um UUID válido
          // e nós não temos como saber o UUID correto do campo personalizado sem consultar a API do ClickUp
          // Para resolver, vamos comentar este trecho e não enviar campos personalizados temporariamente
          /*
          customFields.push({
            id: TICKET_ID_FIELD_NAME,
            value: `ticket-${ticket.id.substring(0, 10)}`
          });
          */
        } else {
          /*
          customFields.push({
            id: TICKET_ID_FIELD_NAME,
            value: `ticket-${Date.now()}`
          });
          */
        }
        
        const taskData = {
          title: ticket.title,
          name: ticket.title,
          description: ticket.description || "Sem descrição",
          status: STATUS_MAP[ticket.status as keyof typeof STATUS_MAP] || STATUS_MAP.open,
          priority: PRIORITY_MAP[ticket.priority as keyof typeof PRIORITY_MAP] || PRIORITY_MAP.medium,
          dueDate: dueDate,
          // Removemos o campo custom_fields completamente para evitar o erro de UUID
          // custom_fields: customFields
        };
        
        // Cria uma nova tarefa
        console.log(`[ClickUpService] Criando nova tarefa para ticket ${ticket.id}`);
        const response = await api.createTask(config.listId, taskData);
        
        if (response && typeof response === 'object' && 'id' in response) {
          console.log(`[ClickUpService] Tarefa criada com sucesso. ID: ${response.id}`);
          
          // Reset contador de erros após sucesso
          this._consecutiveErrors = 0;
          
          return response.id as string;
        } else {
          console.error('[ClickUpService] Resposta inválida ao criar tarefa:', response);
          throw new Error("Resposta da API não contém ID da tarefa");
        }
      } catch (createError) {
        console.error("[ClickUpService] Erro na criação da tarefa:", createError);
        throw createError;
      }
    } catch (error) {
      console.error('[ClickUpService] Erro ao sincronizar com ClickUp:', error);
      
      if (error instanceof Error) {
        throw new Error(`Erro ao sincronizar com ClickUp: ${error.message}`);
      }
      throw new Error(ERROR_MESSAGES.DEFAULT_ERROR);
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
        dueDate: ticket.deadline.toISOString()
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
      if (!ticket.taskId) {
        console.log("Não há taskId para excluir");
        return;
      }

      const config = await this.getConfig();
      if (!config) {
        throw new Error('Configuração do ClickUp não encontrada');
      }

      const api = await this.getAPI();
      await api.deleteTask(ticket.taskId);
    } catch (error) {
      console.error('Erro ao excluir tarefa no ClickUp:', error);
      throw new Error('Erro ao excluir tarefa no ClickUp: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  }

  // Mapeia o status do ticket para o status no ClickUp
  private mapStatus(status: string): string {
    return STATUS_MAP[status as keyof typeof STATUS_MAP] || STATUS_MAP.open;
  }

  // Mapeia a prioridade do ticket para o nível de prioridade no ClickUp
  private getPriorityLevel(priority: string): number {
    return PRIORITY_MAP[priority as keyof typeof PRIORITY_MAP] || PRIORITY_MAP.medium;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${CLICKUP_API_BASE}${endpoint}`;
    
    try {
      console.log(`Fazendo requisição para: ${url}`);
      
      // Obter a API para usar o método de request existente
      const api = await this.getAPI();
      return await api.request<T>(endpoint, options);
    } catch (error) {
      console.error('[ClickUpService] Erro ao fazer requisição:', error);
      throw error;
    }
  }
}

// Exportar uma instância única do serviço para uso nos componentes
export const clickupService = new ClickUpService();