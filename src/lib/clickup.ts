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
        // Tentar obter informações detalhadas do erro
        let errorDetails: any = {};
        
        try {
          errorDetails = await response.json();
          console.error("Resposta de erro da API do ClickUp:", errorDetails);
        } catch (parseError) {
          console.error("Não foi possível analisar a resposta de erro:", parseError);
          // Se não conseguirmos analisar o JSON, usamos o erro genérico
          errorDetails = { err: `Erro ${response.status}: ${response.statusText}` };
        }
        
        // Trata erros conhecidos com mensagens amigáveis
        if (response.status === 401) {
          throw new Error('API Key inválida ou expirada');
        }
        if (response.status === 403) {
          throw new Error('Team not authorized');
        }
        if (response.status === 404) {
          throw new Error('Recurso não encontrado');
        }
        if (response.status === 400) {
          // Para erros 400, tentamos extrair informações mais detalhadas
          if (errorDetails.err) {
            if (errorDetails.err.includes('Status not found')) {
              throw new Error('Status not found');
            }
            throw new Error(errorDetails.err);
          }
          
          // Mensagem genérica para erro 400 se não tiver detalhes
          throw new Error(`Erro 400: Bad Request - ${response.statusText}`);
        }
        
        // Se chegarmos aqui, é um erro não tratado especificamente
        const errorMessage = errorDetails.err || errorDetails.message || `Erro ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      console.error("Erro no request do ClickUp:", error);
      
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
    console.log(`Iniciando criação de tarefa na lista ${listId} para o ticket:`, ticket.id);
    
    // Verificar se o listId não está vazio
    if (!listId || listId.trim() === '') {
      throw new Error('ID da lista do ClickUp não especificado');
    }
    
    const priorityMap: Record<string, number> = {
      low: 3,
      medium: 2,
      high: 1,
      critical: 4
    };

    // Adicionar ID personalizado para rastreamento
    const isValidForCustomField = (id: string | undefined) => {
      return typeof id === 'string' && id.length > 0;
    };
    
    const customFields = [];
    
    // Gerar um ID personalizado único para o campo personalizado
    // Usamos um formato sem caracteres especiais para evitar problemas
    const safeTicketId = `tk_${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    console.log(`[ClickUp] Gerando ID personalizado para ticket: ${safeTicketId}`);
    customFields.push({
      id: "0",  // Colocamos um valor padrão para garantir que seja aceito
      name: "ticket_id",
      value: safeTicketId
    });

    // Determinar a prioridade corretamente
    let priority = priorityMap.medium; // Valor padrão
    if (ticket.priority && typeof ticket.priority === 'string' && priorityMap[ticket.priority] !== undefined) {
      priority = priorityMap[ticket.priority];
    }
    
    // Garantir que a data esteja no formato correto (timestamp)
    let dueDate = null;
    if (ticket.deadline) {
      if (ticket.deadline instanceof Date) {
        dueDate = ticket.deadline.getTime();
      } else {
        try {
          // Tenta converter a string para Date e depois para timestamp
          const date = new Date(ticket.deadline);
          dueDate = date.getTime();
          if (isNaN(dueDate)) {
            console.warn("Data inválida:", ticket.deadline);
            dueDate = null;
          }
        } catch (error) {
          console.warn("Não foi possível converter deadline para timestamp:", error);
        }
      }
    }
    
    // Mapear o status corretamente
    let status = 'to do'; // Valor padrão
    
    // Verificar se temos um status para usar
    if (ticket.status) {
      // Mapeamento de status do sistema para o ClickUp
      // Importante: Estes devem corresponder EXATAMENTE aos nomes de status no ClickUp
      console.log(`Mapeando status: ${ticket.status} para o formato do ClickUp`);
      
      switch (ticket.status) {
        case 'open':
          status = 'ABERTO';
          break;
        case 'in_progress':
          status = 'EM ANDAMENTO';
          break;
        case 'resolved':
          status = 'RESOLVIDO';
          break;
        case 'closed':
          status = 'FECHADO';
          break;
        default:
          console.warn(`Status desconhecido: ${ticket.status}, usando status padrão 'ABERTO'`);
          status = 'ABERTO';
      }
      console.log(`Status mapeado para: ${status}`);
    }
    
    console.log(`Enviando requisição para criar tarefa: ${CLICKUP_API_BASE}/list/${listId}/task`);
    const requestData = {
      name: ticket.title || ticket.name || "Novo Ticket",
      description: ticket.description || "Sem descrição",
      priority: priority,
      due_date: dueDate,
      status: status
      // Removendo o campo custom_fields da requisição para evitar erros
    };
    
    console.log("Dados da tarefa a serem enviados:", JSON.stringify(requestData));

    try {
      const response = await this.request(`/list/${listId}/task`, {
        method: 'POST',
        body: JSON.stringify(requestData)
      });
      
      console.log("Resposta da criação de tarefa:", response);
      return response;
    } catch (error) {
      console.error("Erro ao criar tarefa:", error);
      if (error instanceof Error) {
        if (error.message.includes('Status not found')) {
          // Erro específico de status não encontrado
          throw new Error(`Erro de status: O status "${status}" não existe na lista configurada no ClickUp. ` +
                          `Verifique se você tem os seguintes status criados no ClickUp: ABERTO, EM ANDAMENTO, RESOLVIDO, FECHADO.`);
        } else if (error.message.includes('Recurso não encontrado')) {
          throw new Error(`A lista com ID ${listId} não foi encontrada no ClickUp. Verifique a configuração.`);
        } else if (error.message.includes('404')) {
          throw new Error(`Erro 404: Lista não encontrada (ID: ${listId}). Verifique se o ID está correto.`);
        } else if (error.message.includes('403')) {
          throw new Error('Erro 403: Sem permissão para acessar esta lista. Verifique suas permissões no ClickUp.');
        } else if (error.message.includes('401')) {
          throw new Error('Erro 401: API Key inválida ou expirada. Verifique sua configuração do ClickUp.');
        } else if (error.message.includes('400')) {
          // Tentar extrair mais informações do erro
          const errorMessage = error.message;
          if (errorMessage.includes('Status')) {
            throw new Error(`Erro 400: Problema com o status. O status "${status}" não existe na lista do ClickUp. ` +
                          `Crie os status ABERTO, EM ANDAMENTO, RESOLVIDO e FECHADO na sua lista do ClickUp.`);
          } else if (errorMessage.includes('Field is must be a valid UUID')) {
            throw new Error(`Erro 400: Problema com o campo personalizado. O ID do campo personalizado deve ser um UUID válido. Verifique a configuração dos campos personalizados no ClickUp.`);
          } else {
            throw new Error(`Erro 400: Requisição inválida. Verifique os dados enviados e a configuração do ClickUp. ${errorMessage}`);
          }
        }
      }
      throw error;
    }
  }

  // Atualiza o status de uma tarefa
  async updateTaskStatus(taskId: string, status: string) {
    console.log(`[ClickUpAPI] Atualizando status da tarefa ${taskId} para "${status}"`);
    
    try {
      // Primeiro, vamos verificar se conseguimos obter a tarefa
      try {
        console.log(`[ClickUpAPI] Verificando se a tarefa ${taskId} existe antes de atualizar status`);
        const task: any = await this.request(`/task/${taskId}`);
        console.log(`[ClickUpAPI] Tarefa encontrada:`, task?.name || 'Nome não disponível');
        
        // Se a tarefa existe, vamos obter a lista para verificar os status disponíveis
        if (task && task.list && task.list.id) {
          console.log(`[ClickUpAPI] Verificando status disponíveis na lista ${task.list.id}`);
          const listData: any = await this.request(`/list/${task.list.id}`);
          
          if (listData && listData.statuses && Array.isArray(listData.statuses)) {
            const availableStatuses = listData.statuses.map((s: any) => s.status);
            console.log(`[ClickUpAPI] Status disponíveis na lista:`, availableStatuses);
            
            // Verificar se o status existe exatamente como passado
            if (!availableStatuses.includes(status)) {
              console.log(`[ClickUpAPI] Status "${status}" não encontrado. Verificando status em caso insensitivo.`);
              
              // Verificar sem considerar case sensitive
              const statusLowerCase = status.toLowerCase();
              const matchingStatus = availableStatuses.find(s => s.toLowerCase() === statusLowerCase);
              
              if (matchingStatus) {
                console.log(`[ClickUpAPI] Status encontrado com case diferente: "${matchingStatus}". Usando este status.`);
                status = matchingStatus;
              } else {
                console.error(`[ClickUpAPI] ERRO: Status "${status}" não está na lista de status disponíveis!`);
                console.error(`[ClickUpAPI] Você deve criar este status exatamente com este nome no ClickUp: "${status}"`);
                
                throw new Error(`Status "${status}" não encontrado na lista do ClickUp. Status disponíveis: ${availableStatuses.join(', ')}`);
              }
            }
          }
        }
      } catch (checkError) {
        console.error(`[ClickUpAPI] Erro ao verificar tarefa/status antes de atualizar:`, checkError);
        // Continuamos mesmo se não conseguirmos verificar previamente
      }
      
      // Agora tentamos realmente atualizar o status
      console.log(`[ClickUpAPI] Enviando requisição para atualizar status para "${status}"`);
      const response = await this.request(`/task/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status
        })
      });
      
      console.log(`[ClickUpAPI] Status da tarefa ${taskId} atualizado com sucesso para "${status}"`);
      return response;
    } catch (error) {
      console.error(`[ClickUpAPI] Erro ao atualizar status da tarefa ${taskId}:`, error);
      
      if (error instanceof Error) {
        if (error.message.includes('Status not found')) {
          console.error(`[ClickUpAPI] Erro: Status "${status}" não encontrado na lista do ClickUp`);
          console.error('[ClickUpAPI] Verifique se os status exatos existem no ClickUp e têm a mesma grafia:');
          console.error(`[ClickUpAPI] 1. Acesse a lista no ClickUp`);
          console.error(`[ClickUpAPI] 2. Verifique os status disponíveis`);
          console.error(`[ClickUpAPI] 3. Certifique-se que os status ABERTO, EM ANDAMENTO, RESOLVIDO, FECHADO existem`);
          
          // Erro mais detalhado para o cliente
          throw new Error(
            `O status "${status}" não existe na lista configurada no ClickUp. ` +
            `Verifique se você tem exatamente estes status criados na sua lista no ClickUp: ` +
            `ABERTO, EM ANDAMENTO, RESOLVIDO, FECHADO`
          );
        }
      }
      
      throw error;
    }
  }

  // Atualiza os campos de uma tarefa
  async updateTask(taskId: string, data: { 
    name?: string; 
    description?: string; 
    priority?: number;
    due_date?: number;
    status?: string;
  }) {
    return this.request(`/task/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // Deleta uma tarefa
  async deleteTask(taskId: string) {
    return this.request(`/task/${taskId}`, {
      method: 'DELETE'
    });
  }

  // Adiciona um comentário a uma tarefa
  async addComment(taskId: string, comment: { content: string; userId?: string; ticketId?: string }) {
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