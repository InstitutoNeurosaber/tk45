import type { Ticket } from '../types/ticket';
import { 
  CLICKUP_API_BASE, 
  STATUS_MAP, 
  PRIORITY_MAP, 
  TICKET_ID_FIELD_NAME,
  ERROR_MESSAGES, 
  isValidTicketId
} from '../constants/clickup';

export class ClickUpAPI {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      console.log(`[ClickUp] Requisição para: ${CLICKUP_API_BASE}${endpoint}`);
      
      const response = await fetch(`${CLICKUP_API_BASE}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        // Tentar obter informações detalhadas do erro
        let errorDetails: any = {};
        
        try {
          errorDetails = await response.json();
          console.error("[ClickUp] Resposta de erro:", errorDetails);
        } catch (parseError) {
          console.error("[ClickUp] Não foi possível analisar a resposta de erro:", parseError);
          errorDetails = { err: `Erro ${response.status}: ${response.statusText}` };
        }
        
        // Trata erros conhecidos com mensagens padronizadas
        switch (response.status) {
          case 401:
            throw new Error(ERROR_MESSAGES.INVALID_API_KEY);
          case 403:
            throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
          case 404:
            throw new Error(ERROR_MESSAGES.LIST_NOT_FOUND);
          case 400:
            // Para erros 400, tentamos extrair informações mais detalhadas
            if (errorDetails.err && errorDetails.err.includes('Status not found')) {
              throw new Error(ERROR_MESSAGES.STATUS_NOT_FOUND);
            }
            throw new Error(errorDetails.err || `Erro 400: ${response.statusText}`);
          default:
            const errorMessage = errorDetails.err || errorDetails.message || 
                                `Erro ${response.status}: ${response.statusText}`;
            throw new Error(errorMessage);
        }
      }

      const data = await response.json();
      console.log(`[ClickUp] Resposta recebida para ${endpoint}`);
      return data;
    } catch (error) {
      console.error("[ClickUp] Erro na requisição:", error);
      
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(ERROR_MESSAGES.DEFAULT_ERROR);
    }
  }

  async getWorkspaces() {
    return this.request<{ teams: { id: string; name: string }[] }>('/team');
  }

  async getSpaces(workspaceId: string) {
    return this.request<{ spaces: { id: string; name: string }[] }>(`/team/${workspaceId}/space`);
  }

  async getLists(spaceId: string) {
    return this.request<{ lists: { id: string; name: string }[] }>(`/space/${spaceId}/list`);
  }

  // Verifica se uma tarefa existe no ClickUp
  async taskExists(taskId: string): Promise<boolean> {
    try {
      await this.request<{ id: string }>(`/task/${taskId}`);
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('não encontrada')) {
        return false;
      }
      throw error;
    }
  }

  // Cria uma nova tarefa no ClickUp
  async createTask(listId: string, ticket: Partial<Ticket> | any) {
    console.log(`[ClickUp] Iniciando criação de tarefa na lista ${listId} para o ticket:`, 
                ticket.id || 'Novo ticket');
    
    // Verificar se o listId não está vazio
    if (!listId || listId.trim() === '') {
      throw new Error(ERROR_MESSAGES.LIST_ID_REQUIRED);
    }
    
    // Adicionar ID personalizado para rastreamento
    const customFields = [];
    
    if (isValidTicketId(ticket.id)) {
      customFields.push({
        id: TICKET_ID_FIELD_NAME,
        value: `ticket-${ticket.id.substring(0, 10)}`
      });
    }

    // Determinar a prioridade corretamente
    let priority = PRIORITY_MAP.medium; // Valor padrão
    if (ticket.priority && typeof ticket.priority === 'string' && 
        PRIORITY_MAP[ticket.priority as keyof typeof PRIORITY_MAP] !== undefined) {
      priority = PRIORITY_MAP[ticket.priority as keyof typeof PRIORITY_MAP];
    }
    
    // Garantir que a data esteja no formato correto (timestamp)
    let dueDate = null;
    if (ticket.deadline) {
      if (ticket.deadline instanceof Date) {
        dueDate = ticket.deadline.getTime();
      } else {
        try {
          const date = new Date(ticket.deadline);
          dueDate = date.getTime();
          if (isNaN(dueDate)) {
            console.warn("[ClickUp] Data inválida:", ticket.deadline);
            dueDate = null;
          }
        } catch (error) {
          console.warn("[ClickUp] Não foi possível converter deadline para timestamp:", error);
        }
      }
    }
    
    // Mapear o status corretamente usando a constante padronizada
    let status = STATUS_MAP.open; // Valor padrão
    
    if (ticket.status && STATUS_MAP[ticket.status as keyof typeof STATUS_MAP]) {
      status = STATUS_MAP[ticket.status as keyof typeof STATUS_MAP];
      console.log(`[ClickUp] Status mapeado: ${ticket.status} -> ${status}`);
    }
    
    console.log(`[ClickUp] Dados da tarefa a ser criada:`, {
      name: ticket.title || ticket.name || "Novo Ticket",
      status: status,
      priority: priority,
      due_date: dueDate
    });

    try {
      const response = await this.request(`/list/${listId}/task`, {
        method: 'POST',
        body: JSON.stringify({
          name: ticket.title || ticket.name || "Novo Ticket",
          description: ticket.description || "Sem descrição",
          priority: priority,
          due_date: dueDate,
          status: status
        })
      });
      
      console.log("[ClickUp] Tarefa criada com sucesso:", response);
      return response;
    } catch (error) {
      console.error("[ClickUp] Erro ao criar tarefa:", error);
      throw error; // Já tratado em request()
    }
  }

  // Atualiza o status de uma tarefa
  async updateTaskStatus(taskId: string, status: string) {
    console.log(`[ClickUp] Atualizando status da tarefa ${taskId} para ${status}`);
    return this.request(`/task/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status
      })
    });
  }

  // Atualiza os campos de uma tarefa
  async updateTask(taskId: string, data: { 
    name?: string; 
    description?: string; 
    priority?: number;
    due_date?: number;
    status?: string;
  }) {
    console.log(`[ClickUp] Atualizando tarefa ${taskId}:`, data);
    return this.request(`/task/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // Deleta uma tarefa
  async deleteTask(taskId: string) {
    console.log(`[ClickUp] Excluindo tarefa ${taskId}`);
    return this.request(`/task/${taskId}`, {
      method: 'DELETE'
    });
  }

  // Busca tarefas em uma lista por status
  async getTasksByStatus(listId: string, status: string) {
    console.log(`[ClickUp] Buscando tarefas com status ${status} na lista ${listId}`);
    return this.request<{ tasks: any[] }>(`/list/${listId}/task?statuses[]=${encodeURIComponent(status)}`);
  }

  // Busca todas as tarefas em uma lista
  async getAllTasks(listId: string) {
    console.log(`[ClickUp] Buscando todas as tarefas da lista ${listId}`);
    return this.request<{ tasks: any[] }>(`/list/${listId}/task`);
  }
}

// Estas funções não são utilizadas, foram removidas para evitar código morto
// export const getTicketDetails = async (ticketId: string): Promise<Ticket | null> => { ... };
// export const updateTicketStatus = async (ticketId: string, status: TicketStatus): Promise<boolean> => { ... };
// export const updateTicketPriority = async (ticketId: string, priority: string): Promise<boolean> => { ... };