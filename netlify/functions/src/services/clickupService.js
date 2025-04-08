import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ClickUpAPI } from '../lib/clickup/api';
import { ClickUpConfigManager } from '../lib/clickup/config';
import { CLICKUP_API_BASE, STATUS_MAP, PRIORITY_MAP, ERROR_MESSAGES, isValidTicketId } from '../constants/clickup';
export class ClickUpService {
    constructor() {
        this._apiKey = null;
        this.configManager = new ClickUpConfigManager();
        this._lastErrorTimestamp = 0;
        this._consecutiveErrors = 0;
    }
    async getConfig() {
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
                };
            }
            console.log('[ClickUpService] Nenhuma configuração ativa encontrada');
            return null;
        }
        catch (error) {
            console.error('[ClickUpService] Erro ao buscar configuração:', error);
            return null;
        }
    }
    async isConfigured() {
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
        }
        catch (error) {
            console.error('[ClickUpService] Erro ao verificar configuração:', error);
            return false;
        }
    }
    async getAPI() {
        const config = await this.getConfig();
        if (!config || !config.active || !config.apiKey) {
            console.error('[ClickUpService] Configuração não encontrada ou inativa');
            throw new Error(ERROR_MESSAGES.INVALID_API_KEY);
        }
        return new ClickUpAPI(config.apiKey);
    }
    shouldThrottleError() {
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
    async syncTicketWithClickUp(ticket) {
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
            }
            catch (error) {
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
                        const clickupStatus = STATUS_MAP[ticket.status] || STATUS_MAP.open;
                        // Cálculo de datas
                        const dueDate = this.getDateMilliseconds(ticket.deadline);
                        const startDate = this.getDateMilliseconds(ticket.createdAt);
                        // Tempo estimado (em milissegundos) - por padrão, definimos como o intervalo entre criação e prazo
                        const timeEstimate = dueDate && startDate ? dueDate - startDate : undefined;
                        // Atualiza a tarefa com a API do ClickUp
                        const updateData = {
                            name: ticket.title,
                            description: ticket.description || "Sem descrição",
                            status: clickupStatus,
                            priority: PRIORITY_MAP[ticket.priority] || PRIORITY_MAP.medium,
                            due_date: dueDate,
                            due_date_time: true, // Incluir horário na data de prazo
                            start_date: startDate,
                            start_date_time: true, // Incluir horário na data de início
                            time_estimate: timeEstimate
                        };
                        await api.request(`/task/${ticket.taskId}`, {
                            method: 'PUT',
                            body: JSON.stringify(updateData)
                        });
                        // Reset contador de erros após sucesso
                        this._consecutiveErrors = 0;
                        return ticket.taskId;
                    }
                    else {
                        console.log(`[ClickUpService] Tarefa ${ticket.taskId} não encontrada, criando nova`);
                    }
                }
                catch (error) {
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
                // Cálculo de datas com timestamps
                const dueDate = this.getDateMilliseconds(ticket.deadline);
                const startDate = this.getDateMilliseconds(ticket.createdAt);
                // Tempo estimado (em milissegundos) - por padrão, definimos como o intervalo entre criação e prazo
                const timeEstimate = dueDate && startDate ? dueDate - startDate : undefined;
                // Adicionar ID personalizado para rastreamento temporariamente ignorado
                // devido aos problemas com UUID no custom_fields        
                const taskData = {
                    name: ticket.title,
                    description: ticket.description || "Sem descrição",
                    status: STATUS_MAP[ticket.status] || STATUS_MAP.open,
                    priority: PRIORITY_MAP[ticket.priority] || PRIORITY_MAP.medium,
                    due_date: dueDate,
                    due_date_time: true, // Incluir horário na data de prazo
                    start_date: startDate,
                    start_date_time: true, // Incluir horário na data de início
                    time_estimate: timeEstimate
                };
                // Cria uma nova tarefa
                console.log(`[ClickUpService] Criando nova tarefa para ticket ${ticket.id}`, taskData);
                const response = await api.createTask(config.listId, taskData);
                if (response && typeof response === 'object' && 'id' in response) {
                    console.log(`[ClickUpService] Tarefa criada com sucesso. ID: ${response.id}`);
                    // Reset contador de erros após sucesso
                    this._consecutiveErrors = 0;
                    return response.id;
                }
                else {
                    console.error('[ClickUpService] Resposta inválida ao criar tarefa:', response);
                    throw new Error("Resposta da API não contém ID da tarefa");
                }
            }
            catch (createError) {
                console.error("[ClickUpService] Erro na criação da tarefa:", createError);
                throw createError;
            }
        }
        catch (error) {
            console.error('[ClickUpService] Erro ao sincronizar com ClickUp:', error);
            if (error instanceof Error) {
                throw new Error(`Erro ao sincronizar com ClickUp: ${error.message}`);
            }
            throw new Error(ERROR_MESSAGES.DEFAULT_ERROR);
        }
    }
    /**
     * Converte uma data para milissegundos (formato aceito pelo ClickUp)
     */
    getDateMilliseconds(date) {
        if (!date)
            return undefined;
        try {
            if (date instanceof Date) {
                return date.getTime();
            }
            else {
                const parsedDate = new Date(date);
                if (isNaN(parsedDate.getTime())) {
                    console.warn("[ClickUpService] Data inválida:", date);
                    return undefined;
                }
                return parsedDate.getTime();
            }
        }
        catch (error) {
            console.warn("[ClickUpService] Erro ao converter data:", error);
            return undefined;
        }
    }
    async createTaskFromTicket(ticket) {
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
        }
        catch (error) {
            console.error('Erro ao criar tarefa no ClickUp:', error);
            throw new Error('Erro ao criar tarefa no ClickUp: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
        }
    }
    async updateTaskStatus(ticket) {
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
        }
        catch (error) {
            console.error('Erro ao atualizar status da tarefa no ClickUp:', error);
            throw new Error('Erro ao atualizar status da tarefa no ClickUp: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
        }
    }
    async deleteTask(ticket) {
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
        }
        catch (error) {
            console.error('Erro ao excluir tarefa no ClickUp:', error);
            throw new Error('Erro ao excluir tarefa no ClickUp: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
        }
    }
    // Mapeia o status do ticket para o status no ClickUp
    mapStatus(status) {
        return STATUS_MAP[status] || STATUS_MAP.open;
    }
    // Mapeia a prioridade do ticket para o nível de prioridade no ClickUp
    getPriorityLevel(priority) {
        return PRIORITY_MAP[priority] || PRIORITY_MAP.medium;
    }
    async request(endpoint, options = {}) {
        const url = `${CLICKUP_API_BASE}${endpoint}`;
        try {
            console.log(`Fazendo requisição para: ${url}`);
            // Obter a API para usar o método de request existente
            const api = await this.getAPI();
            return await api.request(endpoint, options);
        }
        catch (error) {
            console.error('[ClickUpService] Erro ao fazer requisição:', error);
            throw error;
        }
    }
    /**
     * Adiciona um comentário a uma tarefa no ClickUp
     * @param taskId ID da tarefa no ClickUp
     * @param comment Texto do comentário
     * @param authorName Nome do autor para adicionar ao comentário (opcional)
     * @returns true se o comentário foi adicionado com sucesso
     */
    async addCommentToTask(taskId, comment, authorName) {
        if (this.shouldThrottleError()) {
            console.warn('[ClickUpService] Muitas falhas consecutivas, aguardando antes de tentar novamente');
            return false;
        }
        if (!taskId || !isValidTicketId(taskId)) {
            console.error('[ClickUpService] ID de tarefa inválido:', taskId);
            return false;
        }
        if (!comment || !comment.trim()) {
            console.error('[ClickUpService] Comentário vazio');
            return false;
        }
        try {
            const api = await this.getAPI();
            // Remover a verificação de existência da tarefa que pode falhar com usuários comuns
            // Vamos tentar adicionar o comentário diretamente
            // Adicionar prefixo com nome do autor no comentário, se fornecido
            const commentText = authorName
                ? `**${authorName}:** ${comment}`
                : comment;
            console.log(`[ClickUpService] Adicionando comentário à tarefa ${taskId}: "${commentText.substring(0, 50)}${commentText.length > 50 ? '...' : ''}"`);
            await api.createTaskComment(taskId, commentText);
            // Reset contador de erros após sucesso
            this._consecutiveErrors = 0;
            console.log(`[ClickUpService] Comentário adicionado com sucesso à tarefa ${taskId}`);
            return true;
        }
        catch (error) {
            this._consecutiveErrors++;
            this._lastErrorTimestamp = Date.now();
            console.error('[ClickUpService] Erro ao adicionar comentário:', error);
            // Verificar se há erro de autenticação
            if (error instanceof Error) {
                const errorMessage = error.message.toLowerCase();
                if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
                    console.error('[ClickUpService] Erro de autenticação ao adicionar comentário. Verifique sua API key.');
                }
            }
            return false;
        }
    }
}
// Exportar uma instância única do serviço para uso nos componentes
export const clickupService = new ClickUpService();
