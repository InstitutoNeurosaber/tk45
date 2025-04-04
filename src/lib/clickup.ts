import type { Ticket, Comment } from '../types/ticket';

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

export class ClickUpAPI {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      const response = await fetch(`${CLICKUP_API_BASE}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ err: 'Erro desconhecido' }));
        if (response.status === 401) {
          throw new Error('API Key inválida ou expirada');
        }
        if (response.status === 403) {
          throw new Error('Team not authorized');
        }
        if (response.status === 404) {
          throw new Error('Recurso não encontrado');
        }
        throw new Error(error.err || `Erro ${response.status}: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Erro desconhecido na requisição ao ClickUp');
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
      if (error instanceof Error && error.message.includes('Recurso não encontrado')) {
        return false;
      }
      throw error;
    }
  }

  // Cria uma nova tarefa no ClickUp
  async createTask(listId: string, ticket: Partial<Ticket> | any) {
    const priorityMap: Record<string, number> = {
      low: 3,
      medium: 2,
      high: 1,
      critical: 4
    };

    // Adicionar ID personalizado para rastreamento
    const customFields = [{
      id: "ticket_id",
      value: ticket.id || `ticket-${Date.now()}`
    }];

    // Determinar a prioridade corretamente
    let priority = priorityMap.medium; // Valor padrão
    if (ticket.priority && typeof ticket.priority === 'string' && priorityMap[ticket.priority] !== undefined) {
      priority = priorityMap[ticket.priority];
    }

    return this.request(`/list/${listId}/task`, {
      method: 'POST',
      body: JSON.stringify({
        name: ticket.title || ticket.name,
        description: ticket.description,
        priority: priority,
        due_date: ticket.deadline ? ticket.deadline.getTime() : null,
        status: ticket.status || 'to do',
        custom_fields: customFields
      })
    });
  }

  // Atualiza o status de uma tarefa
  async updateTaskStatus(taskId: string, status: string) {
    return this.request(`/task/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status
      })
    });
  }

  // Deleta uma tarefa
  async deleteTask(taskId: string) {
    return this.request(`/task/${taskId}`, {
      method: 'DELETE'
    });
  }

  // Adiciona um comentário a uma tarefa
  async addComment(taskId: string, comment: Comment) {
    return this.request(`/task/${taskId}/comment`, {
      method: 'POST',
      body: JSON.stringify({
        comment_text: comment.content,
        assignee: comment.userId || null,
        notify_all: true
      })
    });
  }

  // Busca tarefas em uma lista por status
  async getTasksByStatus(listId: string, status: string) {
    return this.request<{ tasks: any[] }>(`/list/${listId}/task?statuses[]=${encodeURIComponent(status)}`);
  }

  // Busca todas as tarefas em uma lista
  async getAllTasks(listId: string) {
    return this.request<{ tasks: any[] }>(`/list/${listId}/task`);
  }
}