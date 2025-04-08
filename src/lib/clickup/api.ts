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

  /**
   * Realiza uma requisição à API do ClickUp
   * @param endpoint Endpoint da API (sem a base URL)
   * @param options Opções da requisição
   * @returns Resposta da API
   */
  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${CLICKUP_API_BASE}${endpoint}`;
    
    const headers = {
      'Authorization': this.apiKey,
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    try {
      console.log(`[ClickUp API] Requisição para ${endpoint} (${options.method || 'GET'})`);
      
      const response = await fetch(url, {
        ...options,
        headers
      });
      
      // Verificar se a resposta é ok (2xx)
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Erro ao ler resposta');
        console.error(`[ClickUp API] Erro HTTP ${response.status} ${response.statusText}: ${errorText}`);
        
        // Tentar analisar o erro se for JSON
        let errorJson;
        try {
          errorJson = JSON.parse(errorText);
        } catch (e) {
          // Ignorar erro de parse
        }
        
        const error = new Error(
          errorJson?.err || errorJson?.error?.message || 
          `Erro HTTP ${response.status} ${response.statusText}`
        );
        
        // Adicionar contexto ao erro
        (error as any).status = response.status;
        (error as any).statusText = response.statusText;
        (error as any).endpoint = endpoint;
        (error as any).responseBody = errorText;
        
        throw error;
      }
      
      // Obter resultado como JSON
      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`[ClickUp API] Erro de requisição para ${endpoint}:`, {
          message: error.message,
          name: error.name,
          endpoint,
          method: options.method || 'GET'
        });
      } else {
        console.error(`[ClickUp API] Erro desconhecido na requisição para ${endpoint}:`, error);
      }
      throw error;
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
    
    // Garantir que os campos estejam no formato correto esperado pela API do ClickUp
    const taskData: Record<string, any> = {
      name: task.name,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
    };
    
    // Adicionar campos de data e tempo estimado apenas se estiverem presentes
    if (task.due_date) {
      taskData.due_date = task.due_date;
      if (task.due_date_time !== undefined) {
        taskData.due_date_time = task.due_date_time;
      }
    }
    
    if (task.start_date) {
      taskData.start_date = task.start_date;
      if (task.start_date_time !== undefined) {
        taskData.start_date_time = task.start_date_time;
      }
    }
    
    if (task.time_estimate) {
      taskData.time_estimate = task.time_estimate;
    }
    
    return this.request<ClickUpTask>(`/list/${listId}/task`, {
      method: 'POST',
      body: JSON.stringify(taskData)
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

  /**
   * Adiciona um comentário a uma tarefa no ClickUp
   * @param taskId ID da tarefa no ClickUp
   * @param comment Texto do comentário
   * @param notifyAll Se true, notifica todos os membros da tarefa
   * @returns Objeto com o comentário criado
   */
  async createTaskComment(taskId: string, comment: string, notifyAll: boolean = false): Promise<any> {
    if (!taskId) {
      console.error('[ClickUp API] Erro: ID da tarefa é obrigatório');
      throw new Error('ID da tarefa é obrigatório');
    }
    
    if (!comment || !comment.trim()) {
      console.error('[ClickUp API] Erro: Comentário vazio');
      throw new Error('Comentário vazio');
    }
    
    console.log(`[ClickUp API] Adicionando comentário à tarefa ${taskId}: "${comment.substring(0, 50)}${comment.length > 50 ? '...' : ''}"`);
    
    try {
      const result = await this.request<{id?: string}>(`/task/${taskId}/comment`, {
        method: 'POST',
        body: JSON.stringify({
          comment_text: comment,
          notify_all: notifyAll
        })
      });
      
      console.log(`[ClickUp API] Comentário adicionado com sucesso à tarefa ${taskId}, ID do comentário: ${result?.id || 'N/A'}`);
      return result;
    } catch (error) {
      console.error(`[ClickUp API] Erro ao adicionar comentário à tarefa ${taskId}:`, error);
      
      // Verificar erros específicos para dar mensagens mais úteis
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('task not found') || errorMessage.includes('404')) {
          throw new Error(`Tarefa ${taskId} não encontrada no ClickUp`);
        }
        
        if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
          throw new Error('Acesso não autorizado ao ClickUp. Verifique sua API key e permissões.');
        }
        
        if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
          throw new Error('Limite de requisições do ClickUp atingido. Tente novamente mais tarde.');
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Obtém todos os comentários de uma tarefa no ClickUp
   * @param taskId ID da tarefa no ClickUp
   * @returns Lista de comentários da tarefa
   */
  async getTaskComments(taskId: string): Promise<any> {
    if (!taskId) {
      throw new Error('ID da tarefa é obrigatório');
    }
    
    console.log(`Buscando comentários da tarefa ${taskId}`);
    
    return this.request(`/task/${taskId}/comment`);
  }
}