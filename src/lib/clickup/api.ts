import { ClickUpConfig, ClickUpUser, ClickUpSpace, ClickUpList, ClickUpTask } from '../../types/clickup';
import { CLICKUP_API_BASE, ERROR_MESSAGES } from '../../constants/clickup';

export class ClickUpAPI {
  private apiKey: string;
  private controller: AbortController;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.controller = new AbortController();
  }

  public abort() {
    this.controller.abort();
    this.controller = new AbortController();
  }

  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${CLICKUP_API_BASE}${endpoint}`;
    
    try {
      console.log(`Fazendo requisição para: ${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json',
          ...options.headers
        },
        signal: this.controller.signal
      });

      if (!response.ok) {
        let errorData = { err: 'Erro desconhecido' };
        
        try {
          errorData = await response.json();
          console.error(`Erro na requisição para ${url}:`, errorData);
        } catch (parseError) {
          console.error(`Não foi possível analisar resposta de erro para ${url}:`, parseError);
        }
        
        // Tratamento específico por código de status
        switch (response.status) {
          case 401:
            throw new Error(ERROR_MESSAGES.INVALID_API_KEY);
          case 403:
            throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
          case 404:
            throw new Error(ERROR_MESSAGES.LIST_NOT_FOUND);
          case 400:
            // Verificar se é o erro específico de UUID
            if (errorData.err && errorData.err.includes('Field is must be a valid UUID')) {
              console.error("[ClickUpAPI] Erro de UUID inválido em campo personalizado");
              throw new Error(ERROR_MESSAGES.INVALID_UUID);
            }
            // Para erros 400, verificar se é relacionado a status não encontrado
            if (errorData.err && errorData.err.includes('Status not found')) {
              throw new Error(ERROR_MESSAGES.STATUS_NOT_FOUND);
            }
            throw new Error(errorData.err || `Erro na requisição: ${response.status} ${response.statusText}`);
          default:
            throw new Error(errorData.err || `Erro na requisição: ${response.status} ${response.statusText}`);
        }
      }

      const data = await response.json();
      console.log(`Resposta de ${url}:`, data);
      return data;
    } catch (error) {
      console.error(`Erro na requisição para ${url}:`, error);
      
      if (error instanceof Error) {
        // Se já é um erro tratado, apenas propagar
        throw error;
      }
      
      throw new Error(ERROR_MESSAGES.DEFAULT_ERROR);
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.getWorkspaces();
      return true;
    } catch (error) {
      console.error('Falha na validação da API Key:', error);
      return false;
    }
  }

  async getWorkspaces(): Promise<{ teams: { id: string; name: string }[] }> {
    return this.request<{ teams: { id: string; name: string }[] }>('/team');
  }

  async getSpaces(workspaceId: string): Promise<{ spaces: ClickUpSpace[] }> {
    return this.request<{ spaces: ClickUpSpace[] }>(`/team/${workspaceId}/space`);
  }

  async getLists(spaceId: string): Promise<{ lists: ClickUpList[] }> {
    return this.request<{ lists: ClickUpList[] }>(`/space/${spaceId}/list`);
  }

  async getUsers(workspaceId: string): Promise<{ users: ClickUpUser[] }> {
    return this.request<{ users: ClickUpUser[] }>(`/team/${workspaceId}/user`);
  }

  async createTask(listId: string, task: Partial<ClickUpTask>): Promise<ClickUpTask> {
    if (!listId) {
      throw new Error(ERROR_MESSAGES.LIST_ID_REQUIRED);
    }
    
    console.log(`Criando tarefa na lista ${listId}:`, task);
    
    return this.request<ClickUpTask>(`/list/${listId}/task`, {
      method: 'POST',
      body: JSON.stringify(task)
    });
  }

  async updateTaskStatus(taskId: string, status: string): Promise<void> {
    console.log(`Atualizando status da tarefa ${taskId} para: ${status}`);
    
    await this.request(`/task/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  async deleteTask(taskId: string): Promise<void> {
    console.log(`Excluindo tarefa ${taskId}`);
    
    await this.request(`/task/${taskId}`, {
      method: 'DELETE'
    });
  }

  async taskExists(taskId: string): Promise<boolean> {
    try {
      console.log(`Verificando se a tarefa ${taskId} existe`);
      await this.request(`/task/${taskId}`);
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('não encontrada')) {
        return false;
      }
      throw error;
    }
  }

  async getTask(taskId: string): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(`/task/${taskId}`);
  }
  
  async getAllTasks(listId: string): Promise<{ tasks: ClickUpTask[] }> {
    if (!listId) {
      throw new Error(ERROR_MESSAGES.LIST_ID_REQUIRED);
    }
    
    console.log(`Buscando todas as tarefas da lista ${listId}`);
    return this.request<{ tasks: ClickUpTask[] }>(`/list/${listId}/task`);
  }
}