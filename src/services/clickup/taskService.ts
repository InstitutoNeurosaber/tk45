import { Ticket, Comment } from '../../types/ticket';
import { ClickUpAPI } from '../../lib/clickup';
import { statusMapper } from './statusMapper';
import { ClickUpConfig } from '../../types/clickup';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

/**
 * Serviço para gerenciar operações de tarefas no ClickUp
 * Responsável por criar, atualizar, excluir e buscar tarefas
 */
export class TaskService {
  private _apiKey: string | null = null;
  private _listId: string | null = null;
  private _api: ClickUpAPI | null = null;

  /**
   * Obtém a configuração atual do ClickUp do Firestore
   */
  private async getConfig(): Promise<ClickUpConfig | null> {
    try {
      console.log('[TaskService] Buscando configuração do ClickUp');
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
      
      console.log('[TaskService] Nenhuma configuração ativa encontrada');
      return null;
    } catch (error) {
      console.error('[TaskService] Erro ao buscar configuração:', error);
      return null;
    }
  }

  /**
   * Inicializa a API do ClickUp com a configuração atual
   */
  private async initializeAPI(): Promise<ClickUpAPI> {
    const config = await this.getConfig();
    if (!config || !config.apiKey || !config.listId) {
      throw new Error('Configuração do ClickUp incompleta ou inativa');
    }
    
    this._apiKey = config.apiKey;
    this._listId = config.listId;
    this._api = new ClickUpAPI(config.apiKey);
    
    return this._api;
  }

  /**
   * Verifica se o ClickUp está configurado
   */
  async isConfigured(): Promise<boolean> {
    try {
      const config = await this.getConfig();
      if (!config || !config.active || !config.apiKey || !config.listId) {
        return false;
      }

      // Inicializa e testa a API
      const api = new ClickUpAPI(config.apiKey);
      await api.getWorkspaces();
      return true;
    } catch (error) {
      console.error('[TaskService] Erro ao verificar configuração:', error);
      return false;
    }
  }

  /**
   * Obtém a instância da API do ClickUp
   */
  async getAPI(): Promise<ClickUpAPI> {
    if (this._api && this._apiKey) {
      return this._api;
    }
    
    return await this.initializeAPI();
  }

  /**
   * Obtém o ID da lista configurada
   */
  async getListId(): Promise<string> {
    if (this._listId) {
      return this._listId;
    }
    
    const config = await this.getConfig();
    if (!config || !config.listId) {
      throw new Error('ID da lista não configurado');
    }
    
    this._listId = config.listId;
    return config.listId;
  }

  /**
   * Cria uma nova tarefa no ClickUp a partir de um ticket
   */
  async createTask(ticket: Ticket): Promise<string> {
    console.log(`[TaskService] Criando tarefa para ticket ${ticket.id}`);
    
    try {
      const api = await this.getAPI();
      const listId = await this.getListId();

      if (!ticket.title) {
        throw new Error('Título do ticket é obrigatório');
      }

      // Preparar data de prazo
      const dueDate = ticket.deadline instanceof Date 
        ? ticket.deadline.getTime() 
        : ticket.deadline 
          ? new Date(ticket.deadline).getTime() 
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).getTime();
      
      // Mapear status e prioridade
      const clickupStatus = statusMapper.mapSystemToClickUp(ticket.status);
      const priorityLevel = statusMapper.mapPriorityToClickUp(ticket.priority);
      
      console.log(`[TaskService] Status mapeado: ${ticket.status} -> ${clickupStatus}`);
      console.log(`[TaskService] Prioridade mapeada: ${ticket.priority} -> ${priorityLevel}`);
      
      // Criar tarefa
      const taskData = {
        id: ticket.id,
        name: ticket.title,
        description: `${ticket.description || "Sem descrição"}\n\nTicket ID: ${ticket.id}`,
        status: clickupStatus,
        priority: priorityLevel,
        due_date: dueDate
      };
      
      console.log(`[TaskService] Enviando dados para criar tarefa:`, JSON.stringify(taskData));
      const response = await api.createTask(listId, taskData);
      
      if (response && typeof response === 'object' && 'id' in response) {
        console.log(`[TaskService] Tarefa criada com sucesso. ID: ${response.id}`);
        return response.id as string;
      } else {
        console.error('[TaskService] Resposta inválida ao criar tarefa:', response);
        throw new Error('Resposta da API não contém ID da tarefa');
      }
    } catch (error) {
      console.error('[TaskService] Erro ao criar tarefa:', error);
      throw error;
    }
  }

  /**
   * Atualiza uma tarefa existente no ClickUp
   */
  async updateTask(taskId: string, ticket: Ticket): Promise<boolean> {
    console.log(`[TaskService] ⚠️ INICIANDO atualização da tarefa ${taskId}`);
    console.log(`[TaskService] Dados do ticket:`, JSON.stringify({
      id: ticket.id,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority
    }));
    
    try {
      const api = await this.getAPI();
      
      // Mapear status e prioridade
      const clickupStatus = statusMapper.mapSystemToClickUp(ticket.status);
      const priorityLevel = statusMapper.mapPriorityToClickUp(ticket.priority);
      
      console.log(`[TaskService] Status mapeado: ${ticket.status} -> ${clickupStatus}`);
      console.log(`[TaskService] Prioridade mapeada: ${ticket.priority} -> ${priorityLevel}`);
      
      // 1. Atualizar campos básicos primeiro
      const updateData = {
        name: ticket.title,
        description: ticket.description,
        priority: priorityLevel,
        due_date: ticket.deadline ? ticket.deadline.getTime() : undefined
      };
      
      console.log(`[TaskService] 1. Atualizando campos básicos:`, JSON.stringify(updateData));
      
      try {
        await api.updateTask(taskId, updateData);
        console.log(`[TaskService] ✓ Campos básicos atualizados com sucesso`);
      } catch (updateError) {
        console.error(`[TaskService] ❌ Erro ao atualizar campos básicos:`, updateError);
        throw updateError;
      }
      
      // 2. Atualizar status separadamente
      console.log(`[TaskService] 2. Iniciando atualização de status para: ${clickupStatus}`);
      
      try {
        // Primeiro verificar o status atual
        const taskDetails = await api.getTask(taskId);
        console.log(`[TaskService] Status atual no ClickUp: ${taskDetails?.status?.status}`);
        
        if (taskDetails?.status?.status === clickupStatus) {
          console.log(`[TaskService] ℹ️ Status já está como ${clickupStatus}, pulando atualização`);
        } else {
          await api.updateTaskStatus(taskId, clickupStatus);
          console.log(`[TaskService] ✓ Status atualizado com sucesso para ${clickupStatus}`);
        }
      } catch (statusError) {
        console.error(`[TaskService] ❌ Erro ao atualizar status:`, statusError);
        
        if (statusError instanceof Error) {
          if (statusError.message.includes('Status not found')) {
            console.error(`[TaskService] ❌ Status "${clickupStatus}" não existe no ClickUp!`);
            console.error(`[TaskService] Verifique se você criou os seguintes status: aberto, em andamento, resolvido, fechado`);
          }
        }
        
        throw statusError;
      }
      
      console.log(`[TaskService] ✅ Tarefa ${taskId} atualizada com sucesso!`);
      return true;
    } catch (error) {
      console.error(`[TaskService] ❌ Erro ao atualizar tarefa ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Verifica se uma tarefa existe no ClickUp
   */
  async taskExists(taskId: string): Promise<boolean> {
    try {
      const api = await this.getAPI();
      return await api.taskExists(taskId);
    } catch (error) {
      console.error(`[TaskService] Erro ao verificar existência da tarefa ${taskId}:`, error);
      return false;
    }
  }

  /**
   * Exclui uma tarefa do ClickUp
   */
  async deleteTask(taskId: string): Promise<boolean> {
    try {
      console.log(`[TaskService] Excluindo tarefa ${taskId}`);
      const api = await this.getAPI();
      await api.deleteTask(taskId);
      return true;
    } catch (error) {
      console.error(`[TaskService] Erro ao excluir tarefa ${taskId}:`, error);
      return false;
    }
  }

  /**
   * Adiciona um comentário a uma tarefa no ClickUp
   */
  async addComment(taskId: string, comment: Comment | string): Promise<boolean> {
    try {
      console.log(`[TaskService] Adicionando comentário à tarefa ${taskId}`);
      const api = await this.getAPI();
      
      const commentText = typeof comment === 'string' 
        ? comment 
        : comment.content;
      
      await api.addComment(taskId, { content: commentText });
      return true;
    } catch (error) {
      console.error(`[TaskService] Erro ao adicionar comentário à tarefa ${taskId}:`, error);
      return false;
    }
  }
}

// Exportar instância única para uso em toda a aplicação
export const taskService = new TaskService(); 