import { Ticket } from '../../types/ticket';
import { taskService } from './taskService';
import { statusMapper } from './statusMapper';

/**
 * Interface para opções de sincronização
 */
interface SyncOptions {
  source?: string;
  skipWebhookUpdate?: boolean;
}

/**
 * Serviço responsável pela sincronização bidirecional entre o sistema de tickets e o ClickUp
 */
export class SyncService {
  /**
   * Sincroniza um ticket com o ClickUp, criando ou atualizando uma tarefa
   */
  async syncTicketWithClickUp(ticket: Ticket, options?: SyncOptions): Promise<string | null> {
    console.log(`[SyncService] Iniciando sincronização de ticket ${ticket.id}. Origem: ${options?.source || 'não especificada'}`);
    
    try {
      // Verificar configuração
      const isConfigured = await taskService.isConfigured();
      if (!isConfigured) {
        console.error('[SyncService] ClickUp não está configurado para sincronização');
        throw new Error('ClickUp não está configurado');
      }
      
      console.log(`[SyncService] Verificando existência de tarefa para ticket ${ticket.id}`);
      
      // Verificar se já existe uma tarefa no ClickUp para este ticket
      if (ticket.taskId) {
        console.log(`[SyncService] Ticket ${ticket.id} já possui taskId: ${ticket.taskId}`);
        
        try {
          // Verificar se a tarefa ainda existe no ClickUp
          const taskExists = await taskService.taskExists(ticket.taskId);
          
          if (!taskExists) {
            console.log(`[SyncService] Tarefa ${ticket.taskId} não encontrada no ClickUp. Criando nova tarefa.`);
            // Se não existir mais, criar uma nova tarefa
            return await this.createNewTask(ticket);
          }
          
          // Atualizar a tarefa existente
          console.log(`[SyncService] Atualizando tarefa existente ${ticket.taskId}`);
          await taskService.updateTask(ticket.taskId, ticket);
          
          console.log(`[SyncService] Tarefa ${ticket.taskId} atualizada com sucesso`);
          return ticket.taskId;
        } catch (error) {
          console.error(`[SyncService] Erro ao atualizar tarefa ${ticket.taskId}:`, error);
          
          if (error instanceof Error && (
            error.message.includes('not found') || 
            error.message.includes('não encontrada') ||
            error.message.includes('Resource not found')
          )) {
            // Tarefa não existe mais, criar uma nova
            console.log(`[SyncService] Tarefa não existe mais no ClickUp. Criando nova tarefa.`);
            return await this.createNewTask(ticket);
          }
          
          throw error;
        }
      } else {
        console.log(`[SyncService] Ticket ${ticket.id} não possui taskId. Criando nova tarefa.`);
        // Se não existe taskId, criar uma nova tarefa
        return await this.createNewTask(ticket);
      }
    } catch (error) {
      console.error(`[SyncService] Erro ao sincronizar ticket ${ticket.id}:`, error);
      throw new Error('Erro ao sincronizar com o ClickUp: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  }

  /**
   * Cria uma nova tarefa no ClickUp a partir de um ticket
   */
  private async createNewTask(ticket: Ticket): Promise<string> {
    console.log(`[SyncService] Criando nova tarefa para ticket ${ticket.id}`);
    return await taskService.createTask(ticket);
  }

  /**
   * Deleta uma tarefa no ClickUp relacionada ao ticket
   */
  async deleteTask(ticket: Ticket): Promise<boolean> {
    try {
      console.log(`[SyncService] Excluindo tarefa para ticket ${ticket.id}`);
      
      if (!ticket.taskId) {
        console.log(`[SyncService] Ticket ${ticket.id} não possui taskId. Nada a excluir.`);
        return true;
      }
      
      const isConfigured = await taskService.isConfigured();
      if (!isConfigured) {
        console.error('[SyncService] ClickUp não está configurado');
        return false;
      }
      
      return await taskService.deleteTask(ticket.taskId);
    } catch (error) {
      console.error(`[SyncService] Erro ao excluir tarefa para ticket ${ticket.id}:`, error);
      return false;
    }
  }

  /**
   * Adiciona um comentário do ticket à tarefa correspondente no ClickUp
   */
  async syncComment(ticketId: string, taskId: string, comment: string): Promise<boolean> {
    try {
      console.log(`[SyncService] Sincronizando comentário de ticket ${ticketId} com tarefa ${taskId}`);
      
      const isConfigured = await taskService.isConfigured();
      if (!isConfigured) {
        console.error('[SyncService] ClickUp não está configurado');
        return false;
      }
      
      return await taskService.addComment(taskId, comment);
    } catch (error) {
      console.error(`[SyncService] Erro ao sincronizar comentário:`, error);
      return false;
    }
  }
}

// Exportar instância única para uso em toda a aplicação
export const syncService = new SyncService(); 