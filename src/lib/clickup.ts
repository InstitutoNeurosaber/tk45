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

  // Obter detalhes de uma lista específica
  async getList(listId: string) {
    return this.request<{ id: string; name: string; statuses?: Array<{ status: string }> }>(`/list/${listId}`);
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
          status = 'aberto';
          break;
        case 'in_progress':
          status = 'em andamento';
          break;
        case 'resolved':
          status = 'resolvido';
          break;
        case 'closed':
          status = 'fechado';
          break;
        default:
          console.warn(`Status desconhecido: ${ticket.status}, usando status padrão 'aberto'`);
          status = 'aberto';
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
                          `Verifique se você tem os seguintes status criados no ClickUp: aberto, em andamento, resolvido, fechado.`);
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
                          `Crie os status aberto, em andamento, resolvido e fechado na sua lista do ClickUp.`);
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
    console.log(`[ClickUpAPI] ⚠️ INICIANDO atualização de status da tarefa ${taskId} para "${status}"`);
    
    try {
      // Primeiro, verificar se a tarefa existe e obter os status disponíveis
      try {
        // Obter a tarefa para ver qual é a lista
        console.log(`[ClickUpAPI] Buscando informações da tarefa ${taskId}`);
        const taskData = await this.request<{list?: {id?: string}, status?: {status?: string}}>(`/task/${taskId}`);
        console.log(`[ClickUpAPI] Dados da tarefa recuperados:`, JSON.stringify({
          taskId,
          listId: taskData?.list?.id,
          currentStatus: taskData?.status?.status
        }));
        
        if (taskData && taskData.list && taskData.list.id) {
          const listId = taskData.list.id;
          console.log(`[ClickUpAPI] Lista identificada: ${listId}`);
          
          // Obter os status disponíveis para esta lista
          console.log(`[ClickUpAPI] Buscando status disponíveis para a lista ${listId}`);
          const listData = await this.request<{statuses?: Array<{id: string, status: string, orderindex: number}>}>(`/list/${listId}`);
          console.log(`[ClickUpAPI] Dados da lista recuperados. Status disponíveis: ${listData?.statuses?.length || 0}`);
          
          if (listData && listData.statuses && Array.isArray(listData.statuses)) {
            console.log(`[ClickUpAPI] Detalhes de status:`, JSON.stringify(listData.statuses.map(s => ({
              id: s.id, 
              status: s.status, 
              orderindex: s.orderindex
            }))));
            
            const availableStatuses = listData.statuses.map((s) => s.status);
            console.log(`[ClickUpAPI] Status disponíveis na lista:`, availableStatuses);
            
            // Verificar se o status existe exatamente como passado
            if (!availableStatuses.includes(status)) {
              console.log(`[ClickUpAPI] ⚠️ Status "${status}" não encontrado exatamente. Tentando correspondências alternativas.`);
              
              // Verificar sem considerar case sensitive
              const statusLowerCase = status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              const availableStatusesNormalized = availableStatuses.map(s => 
                s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
              );
              
              console.log(`[ClickUpAPI] Status normalizado: "${statusLowerCase}"`);
              console.log(`[ClickUpAPI] Status disponíveis normalizados:`, availableStatusesNormalized);
              
              // Busca exata com normalização
              const exactMatchIndex = availableStatusesNormalized.findIndex(s => s === statusLowerCase);
              
              if (exactMatchIndex !== -1) {
                const matchingStatus = availableStatuses[exactMatchIndex];
                console.log(`[ClickUpAPI] ✓ Status encontrado com normalização: "${matchingStatus}". Usando este status.`);
                status = matchingStatus;
              } else {
                // Tentar uma correspondência mais flexível
                console.log(`[ClickUpAPI] Tentando encontrar uma correspondência parcial para "${status}"`);
                
                const partialMatchIndex = availableStatusesNormalized.findIndex(s => 
                  s.includes(statusLowerCase) || statusLowerCase.includes(s)
                );
                
                if (partialMatchIndex !== -1) {
                  const partialMatch = availableStatuses[partialMatchIndex];
                  console.log(`[ClickUpAPI] ✓ Correspondência parcial encontrada: "${partialMatch}". Usando este status.`);
                  status = partialMatch;
                } else {
                  console.error(`[ClickUpAPI] ❌ ERRO CRÍTICO: Status "${status}" não corresponde a nenhum status disponível!`);
                  console.error(`[ClickUpAPI] Você deve criar estes status exatamente no ClickUp: "aberto", "em andamento", "resolvido", "fechado"`);
                  console.error(`[ClickUpAPI] Status disponíveis: ${availableStatuses.join(', ')}`);
                  
                  // Usando um status de fallback baseado no nome mais próximo
                  if (statusLowerCase.includes('aberto') || statusLowerCase.includes('open')) {
                    const openStatus = availableStatuses.find(s => 
                      s.toLowerCase().includes('aberto') || 
                      s.toLowerCase().includes('open') || 
                      s.toLowerCase().includes('to do')
                    );
                    if (openStatus) {
                      console.log(`[ClickUpAPI] 🔄 Usando status de fallback "${openStatus}" para "${status}"`);
                      status = openStatus;
                    }
                  } else if (statusLowerCase.includes('andamento') || statusLowerCase.includes('progress')) {
                    const progressStatus = availableStatuses.find(s => 
                      s.toLowerCase().includes('andamento') || 
                      s.toLowerCase().includes('progress') || 
                      s.toLowerCase().includes('in progress')
                    );
                    if (progressStatus) {
                      console.log(`[ClickUpAPI] 🔄 Usando status de fallback "${progressStatus}" para "${status}"`);
                      status = progressStatus;
                    }
                  } else if (statusLowerCase.includes('resolvido') || statusLowerCase.includes('complet')) {
                    const resolvedStatus = availableStatuses.find(s => 
                      s.toLowerCase().includes('resolvido') || 
                      s.toLowerCase().includes('complet') || 
                      s.toLowerCase().includes('done')
                    );
                    if (resolvedStatus) {
                      console.log(`[ClickUpAPI] 🔄 Usando status de fallback "${resolvedStatus}" para "${status}"`);
                      status = resolvedStatus;
                    }
                  } else if (statusLowerCase.includes('fechado') || statusLowerCase.includes('closed')) {
                    const closedStatus = availableStatuses.find(s => 
                      s.toLowerCase().includes('fechado') || 
                      s.toLowerCase().includes('closed') || 
                      s.toLowerCase().includes('cancel')
                    );
                    if (closedStatus) {
                      console.log(`[ClickUpAPI] 🔄 Usando status de fallback "${closedStatus}" para "${status}"`);
                      status = closedStatus;
                    }
                  }
                  
                  // Se ainda assim não encontrarmos um status, pegamos o primeiro disponível como último recurso
                  if (!availableStatuses.includes(status) && availableStatuses.length > 0) {
                    console.log(`[ClickUpAPI] ⚠️ Usando primeiro status disponível "${availableStatuses[0]}" como recurso final`);
                    status = availableStatuses[0];
                  } else if (!availableStatuses.includes(status)) {
                    throw new Error(`Não foi possível encontrar um status correspondente para "${status}" na lista do ClickUp. Status disponíveis: ${availableStatuses.join(', ')}`);
                  }
                }
              }
            } else {
              console.log(`[ClickUpAPI] ✓ Status "${status}" encontrado exatamente entre os disponíveis.`);
            }
          }
        }
      } catch (checkError) {
        console.error(`[ClickUpAPI] Erro ao verificar tarefa/status antes de atualizar:`, checkError);
        // Continuamos mesmo se não conseguirmos verificar previamente
      }
      
      // Agora tentamos realmente atualizar o status
      console.log(`[ClickUpAPI] ⏳ Enviando requisição para atualizar status para "${status}"`);
      const response = await this.request<any>(`/task/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status
        })
      });
      
      console.log(`[ClickUpAPI] ✅ Status atualizado com sucesso! Nova resposta:`, JSON.stringify(response));
      return response;
    } catch (error) {
      console.error(`[ClickUpAPI] ❌ Erro ao atualizar status:`, error);
       
      // Manipular especificamente o erro "Status not found"
      if (error instanceof Error && error.message.includes('Status not found')) {
        console.error(`[ClickUpAPI] ❌ ERRO CRÍTICO: Status "${status}" não existe no ClickUp!`);
        console.error(`[ClickUpAPI] Verifique se você criou os seguintes status na sua lista do ClickUp: aberto, em andamento, resolvido, fechado`);
        console.error(`[ClickUpAPI] Cada status deve ser criado exatamente com estes nomes para que a sincronização funcione corretamente.`);
        
        // Tentar obter os status disponíveis
        try {
          console.log(`[ClickUpAPI] Tentando recuperar informações da tarefa e status disponíveis após erro`);
          const taskData = await this.request<{list?: {id?: string}}>(`/task/${taskId}`);
          
          if (taskData?.list?.id) {
            const listId = taskData.list.id;
            const listData = await this.request<{statuses?: Array<{status: string}>}>(`/list/${listId}`);
            
            if (listData?.statuses) {
              const availableStatuses = listData.statuses.map(s => s.status);
              console.error(`[ClickUpAPI] Status disponíveis na lista:`, availableStatuses);
            }
          }
        } catch (secondError) {
          console.error(`[ClickUpAPI] Não foi possível recuperar status disponíveis:`, secondError);
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

  // Busca uma tarefa específica
  async getTask(taskId: string) {
    console.log(`[ClickUpAPI] Buscando detalhes da tarefa ${taskId}`);
    try {
      const response = await this.request<{
        id: string;
        name: string;
        status: {
          status: string;
          color: string;
        };
      }>(`/task/${taskId}`);
      
      console.log(`[ClickUpAPI] Detalhes da tarefa recuperados:`, JSON.stringify(response));
      return response;
    } catch (error) {
      console.error(`[ClickUpAPI] Erro ao buscar tarefa ${taskId}:`, error);
      throw error;
    }
  }
}