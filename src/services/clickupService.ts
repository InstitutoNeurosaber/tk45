import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ClickUpAPI } from '../lib/clickup';
import type { Ticket, Comment } from '../types/ticket';
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
   * @returns ID da tarefa criada/atualizada no ClickUp
   */
  async syncTicketWithClickUp(ticket: Ticket): Promise<string | null> {
    try {
      const config = await this.getConfig();
      if (!config) {
        console.log('Configuração do ClickUp não encontrada. Pulando sincronização.');
        return null;
      }

      if (!config.listId) {
        console.error('ListID não encontrado na configuração do ClickUp');
        return null;
      }

      console.log(`Sincronizando ticket ${ticket.id} com o ClickUp...`);
      console.log(`Lista selecionada: ${config.listId}`);
      console.log(`URL da requisição: ${CLICKUP_API_BASE}/list/${config.listId}/task`);
      
      const api = await this.getAPI();
      
      // Verificar se a lista existe antes de tentar criar a tarefa
      try {
        console.log(`Verificando se a lista ${config.listId} existe...`);
        // Não podemos verificar diretamente a lista, mas podemos tentar obter as tarefas dela
        await api.getAllTasks(config.listId);
        console.log(`Lista ${config.listId} encontrada com sucesso.`);
      } catch (error) {
        console.error(`Erro ao verificar lista ${config.listId}:`, error);
        console.error('A lista configurada não existe ou não está acessível.');
        throw new Error(`Lista com ID ${config.listId} não encontrada ou inacessível`);
      }
      
      // Se o ticket já tem uma tarefa associada, verifica se ela existe
      if (ticket.taskId) {
        try {
          console.log(`Verificando se a tarefa ${ticket.taskId} existe no ClickUp...`);
          const taskExists = await api.taskExists(ticket.taskId);
          if (taskExists) {
            // Atualiza a tarefa existente
            console.log(`Tarefa ${ticket.taskId} encontrada no ClickUp, atualizando...`);
            await api.updateTaskStatus(ticket.taskId, this.mapStatus(ticket.status));
            
            // Atualiza outros campos se necessário
            const updateData = {
              name: ticket.title,
              description: ticket.description,
              priority: this.getPriorityLevel(ticket.priority),
              due_date: ticket.deadline instanceof Date ? ticket.deadline.getTime() : new Date(ticket.deadline).getTime()
            };
            
            console.log(`Dados para atualizar:`, updateData);
            await api.updateTask(ticket.taskId, updateData);
            return ticket.taskId;
          } else {
            console.log(`Tarefa ${ticket.taskId} não encontrada no ClickUp. Criando nova.`);
          }
        } catch (error) {
          console.error(`Erro ao verificar tarefa ${ticket.taskId}:`, error);
          console.log('Continuando para criar uma nova tarefa...');
          // Continuará para criar uma nova tarefa
        }
      }
      
      // Prepara dados para criar nova tarefa
      try {
        // Validação de dados antes de criar
        if (!ticket.title) {
          console.error("Título do ticket está vazio");
          throw new Error("Título do ticket é obrigatório para criar no ClickUp");
        }
        
        // Garantir que a data de prazo está em formato válido
        let dueDate: number | null = null;
        if (ticket.deadline) {
          if (ticket.deadline instanceof Date) {
            dueDate = ticket.deadline.getTime();
          } else {
            try {
              const date = new Date(ticket.deadline);
              if (isNaN(date.getTime())) {
                console.warn("Data de prazo inválida, usando data atual + 7 dias");
                dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).getTime();
              } else {
                dueDate = date.getTime();
              }
            } catch (e) {
              console.warn("Erro ao converter data de prazo, usando data atual + 7 dias");
              dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).getTime();
            }
          }
        } else {
          console.warn("Ticket sem prazo definido, usando data atual + 7 dias");
          dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).getTime();
        }
        
        // Verificar se o ID do ticket é válido para custom_fields
        const isValidTicketId = (id: string) => {
          // Verifica se o ID é alfanumérico e não causa problemas como UUID
          return typeof id === 'string' && id.length > 0;
        };

        // Adicionar ID personalizado para rastreamento
        let customFields = [];
        if (isValidTicketId(ticket.id)) {
          customFields.push({
            id: "ticket_id",
            value: `ticket-${ticket.id.substring(0, 10)}` // Usa apenas uma parte do ID original
          });
        } else {
          customFields.push({
            id: "ticket_id",
            value: `ticket-${Date.now()}`
          });
        }
        
        const taskData = {
          title: ticket.title,
          name: ticket.title,
          description: ticket.description || "Sem descrição",
          status: this.mapStatus(ticket.status),
          priority: this.getPriorityLevel(ticket.priority),
          due_date: dueDate,
          custom_fields: customFields
        };
        console.log(`Dados para criar tarefa:`, taskData);
        
        // Cria uma nova tarefa
        console.log(`Criando nova tarefa para ticket ${ticket.id} na lista ${config.listId} do ClickUp`);
        const response = await api.createTask(config.listId, taskData);
        
        console.log(`Resposta completa da API:`, JSON.stringify(response));
        
        if (response && typeof response === 'object' && 'id' in response) {
          console.log(`Tarefa criada com sucesso no ClickUp. ID: ${response.id}`);
          return response.id as string;
        } else {
          console.error('Resposta inválida ao criar tarefa:', response);
          throw new Error("Resposta da API não contém ID da tarefa");
        }
      } catch (createError) {
        console.error("Erro específico na criação da tarefa:", createError);
        if (createError instanceof Error) {
          console.error('Detalhes do erro de criação:', createError.message);
          console.error('Stack trace de criação:', createError.stack);
        }
        throw createError;
      }
    } catch (error) {
      console.error('Erro ao sincronizar ticket com ClickUp:', error);
      // Registra mais detalhes sobre o erro
      if (error instanceof Error) {
        console.error('Detalhes do erro:', error.message);
        console.error('Stack trace:', error.stack);
        // Propagar o erro para mostrar no frontend
        throw new Error(`Erro ao sincronizar com ClickUp: ${error.message}`);
      }
      throw new Error('Erro desconhecido ao sincronizar com ClickUp');
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

  async addComment(ticketId: string, comment: Comment): Promise<void> {
    try {
      const config = await this.getConfig();
      if (!config) {
        throw new Error('Configuração do ClickUp não encontrada');
      }

      const api = await this.getAPI();

      // Verifica se a tarefa existe antes de tentar adicionar comentário
      const taskExists = await api.taskExists(ticketId);
      if (!taskExists) {
        throw new Error('Tarefa não encontrada no ClickUp');
      }

      // Validação do ID do usuário
      const commentToSend = { ...comment };
      if (commentToSend.userId && isNaN(parseInt(commentToSend.userId))) {
        console.warn('ID do usuário inválido para o ClickUp, removendo assignee');
        commentToSend.userId = '';
      }

      await api.addComment(ticketId, commentToSend);
    } catch (error) {
      console.error('Erro ao adicionar comentário no ClickUp:', error);
      throw new Error('Erro ao adicionar comentário no ClickUp: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  }

  async getComments(taskId: string): Promise<Comment[]> {
    try {
      const config = await this.getConfig();
      if (!config) {
        throw new Error('Configuração do ClickUp não encontrada');
      }

      const api = await this.getAPI();

      // Verifica se a tarefa existe antes de tentar buscar comentários
      const taskExists = await api.taskExists(taskId);
      if (!taskExists) {
        throw new Error('Tarefa não encontrada no ClickUp');
      }

      const comments = await api.getComments(taskId);
      
      return comments.map(comment => ({
        id: comment.id,
        content: comment.content,
        userId: comment.userId,
        userName: comment.userName,
        ticketId: taskId,
        createdAt: comment.createdAt
      }));
    } catch (error) {
      console.error('Erro ao buscar comentários do ClickUp:', error);
      throw new Error('Erro ao buscar comentários do ClickUp: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  }

  // Mapeia o status do ticket para o status no ClickUp
  private mapStatus(status: string): string {
    console.log(`Mapeando status do ticket: "${status}"`);
    
    // Certifique-se de que os nomes exatos dos status existem no ClickUp
    switch(status) {
      case 'open':
        return 'ABERTO';
      case 'in_progress':
        return 'EM ANDAMENTO';
      case 'resolved':
        return 'RESOLVIDO';
      case 'closed':
        return 'FECHADO';
      default:
        console.warn(`Status desconhecido: ${status}, usando status padrão 'ABERTO'`);
        return 'ABERTO';
    }
  }

  // Mapeia a prioridade do ticket para o nível de prioridade no ClickUp
  private getPriorityLevel(priority: string): number {
    console.log(`Mapeando prioridade do ticket: "${priority}"`);
    
    switch(priority) {
      case 'low':
        return 3;
      case 'medium':
        return 2;
      case 'high':
        return 1;
      case 'critical':
        return 4;
      default:
        console.warn(`Prioridade desconhecida: ${priority}, usando prioridade padrão 'Normal (2)'`);
        return 2;  // Normal
    }
  }
}

// Exportar uma instância única do serviço para uso nos componentes
export const clickupService = new ClickUpService();