import { ticketService } from '../ticketService';
import { clickupStatusReverseMap, clickupPriorityReverseMap, TicketStatus } from '../../types/ticket';
import { clickupStatusSync } from './statusSync';

// Definir interface para resultado de webhook
interface WebhookResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Manipulador de eventos de webhook do ClickUp
 * Este serviço processa eventos recebidos via webhook do ClickUp e
 * os traduz em atualizações no sistema de tickets
 */
export class ClickUpWebhookHandler {
  /**
   * Processa um evento recebido via webhook do ClickUp
   * @param payload Dados do evento recebido
   * @returns Resultado do processamento
   */
  async processEvent(payload: any): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[ClickUpWebhookHandler] Evento recebido:', payload.event_type);
      
      const { event_type, task_id, history_items } = payload;
      
      if (!task_id) {
        console.error('[ClickUpWebhookHandler] task_id não encontrado no payload');
        return { success: false, message: 'task_id não encontrado' };
      }
  
      // Buscar ticket pelo taskId
      console.log(`[ClickUpWebhookHandler] Buscando ticket com taskId ${task_id}`);
      const ticket = await ticketService.findByTaskId(task_id);
      
      if (!ticket) {
        console.error(`[ClickUpWebhookHandler] Ticket com taskId ${task_id} não encontrado`);
        return { success: false, message: 'Ticket não encontrado' };
      }
      
      console.log(`[ClickUpWebhookHandler] Ticket encontrado: ${ticket.id}`);
      
      // Flag para determinar se devemos pular a atualização automática do sistema
      // (Útil quando a mudança se originou do nosso próprio sistema)
      let skipUpdate = false;
      
      // Verificar se este evento foi originado pelo nosso próprio sistema
      // Verificamos nos custom fields ou em alguma outra propriedade que indique a origem
      if (payload.custom_data && payload.custom_data.source === 'ticket-system') {
        console.log('[ClickUpWebhookHandler] Evento originado pelo nosso sistema, ignorando atualização');
        skipUpdate = true;
      }
  
      if (!skipUpdate) {
        switch (event_type) {
          case 'taskStatusUpdated': {
            console.log('[ClickUpWebhookHandler] Processando atualização de status');
            const newStatus = history_items[0]?.after?.status;
            
            if (newStatus) {
              console.log(`[ClickUpWebhookHandler] Novo status no ClickUp: ${newStatus}`);
              
              // Verificar se o status existe no mapeamento
              if (clickupStatusReverseMap[newStatus]) {
                const mappedStatus = clickupStatusReverseMap[newStatus];
                console.log(`[ClickUpWebhookHandler] Status mapeado para o sistema: ${mappedStatus}`);
                
                // Usar o serviço de sincronização que controla loops
                return await this.handleStatusUpdate(task_id, ticket.id, mappedStatus);
              } else {
                console.error(`[ClickUpWebhookHandler] Status ${newStatus} não mapeado no sistema`);
                return { success: false, message: `Status não reconhecido: ${newStatus}` };
              }
            } else {
              console.error('[ClickUpWebhookHandler] Dados de status não encontrados no evento');
              return { success: false, message: 'Dados de status incompletos' };
            }
          }
  
          case 'taskDeleted': {
            console.log(`[ClickUpWebhookHandler] Processando exclusão de tarefa para ticket ${ticket.id}`);
            await ticketService.deleteTicket(ticket.id);
            return { success: true, message: 'Ticket excluído com sucesso' };
          }
  
          case 'taskUpdated': {
            console.log('[ClickUpWebhookHandler] Processando atualização de tarefa');
            const updates: any = {};
            
            history_items.forEach((item: any) => {
              if (item.field === 'name') {
                console.log(`[ClickUpWebhookHandler] Atualizando título para: ${item.after}`);
                updates.title = item.after;
              }
              if (item.field === 'description') {
                console.log('[ClickUpWebhookHandler] Atualizando descrição');
                updates.description = item.after;
              }
              if (item.field === 'priority') {
                const priorityValue = parseInt(item.after.priority);
                console.log(`[ClickUpWebhookHandler] Atualizando prioridade para: ${priorityValue}`);
                if (clickupPriorityReverseMap[priorityValue]) {
                  updates.priority = clickupPriorityReverseMap[priorityValue];
                }
              }
              if (item.field === 'due_date') {
                console.log(`[ClickUpWebhookHandler] Atualizando prazo para: ${new Date(parseInt(item.after))}`);
                updates.deadline = new Date(parseInt(item.after));
              }
            });
  
            if (Object.keys(updates).length > 0) {
              console.log(`[ClickUpWebhookHandler] Atualizando ticket ${ticket.id} com:`, updates);
              await ticketService.updateTicket(ticket.id, updates);
              return { success: true, message: 'Ticket atualizado com sucesso' };
            } else {
              console.log('[ClickUpWebhookHandler] Nenhum campo para atualizar');
              return { success: true, message: 'Nenhuma alteração necessária' };
            }
          }
  
          case 'taskCommentPosted': {
            console.log('[ClickUpWebhookHandler] Processando novo comentário');
            const comment = history_items[0]?.comment;
            if (comment) {
              console.log(`[ClickUpWebhookHandler] Adicionando comentário de ${comment.user.username}`);
              await ticketService.addComment(ticket.id, {
                content: comment.text_content,
                userId: comment.user.id,
                userName: comment.user.username,
                ticketId: ticket.id
              });
              return { success: true, message: 'Comentário adicionado com sucesso' };
            } else {
              console.error('[ClickUpWebhookHandler] Dados de comentário não encontrados no evento');
              return { success: false, message: 'Dados de comentário incompletos' };
            }
          }
  
          case 'taskAssigned': {
            console.log('[ClickUpWebhookHandler] Processando atribuição de tarefa');
            const assignee = history_items[0]?.after?.assignees?.[0];
            if (assignee) {
              console.log(`[ClickUpWebhookHandler] Atribuindo ticket para ${assignee.username}`);
              await ticketService.updateTicket(ticket.id, {
                assignedToId: assignee.id,
                assignedToName: assignee.username
              });
              return { success: true, message: 'Atribuição atualizada com sucesso' };
            } else {
              console.error('[ClickUpWebhookHandler] Dados de atribuição não encontrados no evento');
              return { success: false, message: 'Dados de atribuição incompletos' };
            }
          }
  
          default:
            console.log(`[ClickUpWebhookHandler] Tipo de evento não tratado: ${event_type}`);
            return { success: true, message: `Evento ${event_type} ignorado` };
        }
      } else {
        console.log(`[ClickUpWebhookHandler] Evento ignorado por ter sido originado pelo nosso sistema`);
        return { success: true, message: 'Evento originado pelo sistema, ignorado' };
      }
    } catch (error) {
      console.error('[ClickUpWebhookHandler] Erro ao processar evento:', error);
      return { 
        success: false, 
        message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }

  /**
   * Processa uma mudança de status vinda do ClickUp
   */
  private async handleStatusUpdate(taskId: string, ticketId: string, status: string): Promise<{ success: boolean; message: string }> {
    try {
      // Usar o serviço de sincronização para processar a mudança
      // Fazemos uma conversão explícita para TicketStatus
      const ticketStatus = status as any as TicketStatus;
      const success = await clickupStatusSync.processClickUpStatusChange(taskId, ticketId, ticketStatus);
      
      if (success) {
        return { 
          success: true, 
          message: `Status atualizado para ${status}` 
        };
      } else {
        return { 
          success: false, 
          message: 'Falha ao processar mudança de status' 
        };
      }
    } catch (error) {
      console.error('[ClickUpWebhookHandler] Erro ao lidar com mudança de status:', error);
      return { 
        success: false, 
        message: `Erro ao processar status: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }

  async processTaskStatusChange(webhookData: any): Promise<WebhookResult> {
    try {
      console.log('[WebhookHandler] Processando mudança de status via webhook');
      
      const { task_id, history_items } = webhookData;
      
      if (!task_id || !history_items || !Array.isArray(history_items) || history_items.length === 0) {
        console.warn('[WebhookHandler] Payload incompleto ou inválido:', webhookData);
        return { success: false, message: 'Payload incompleto ou inválido' };
      }
      
      // Encontrar o item de histórico que contém a mudança de status
      const statusChange = history_items.find((item: any) => 
        item.field === 'status' && item.before && item.after
      );
      
      if (!statusChange) {
        console.warn('[WebhookHandler] Nenhuma mudança de status encontrada no payload');
        return { success: false, message: 'Nenhuma mudança de status encontrada no payload' };
      }
      
      console.log(`[WebhookHandler] Mudança de status detectada: ${statusChange.before?.status || 'desconhecido'} -> ${statusChange.after?.status || 'desconhecido'}`);
      
      // Obter o novo status
      const newClickUpStatus = statusChange.after?.status;
      if (!newClickUpStatus) {
        console.warn('[WebhookHandler] Novo status não encontrado no payload');
        return { success: false, message: 'Novo status não encontrado no payload' };
      }
      
      // Mapear o status do ClickUp para o formato do sistema
      console.log(`[WebhookHandler] Mapeando status do ClickUp: ${newClickUpStatus}`);
      
      // Usar o método do status sync para manter consistência
      const systemStatus = clickupStatusSync.mapClickUpStatusToSystem(newClickUpStatus);
      console.log(`[WebhookHandler] Status mapeado: ${newClickUpStatus} -> ${systemStatus}`);
      
      // Encontrar o ticket associado à tarefa
      const ticket = await ticketService.findByTaskId(task_id);
      if (!ticket) {
        console.warn(`[WebhookHandler] Nenhum ticket associado à tarefa ${task_id}`);
        return { success: false, message: `Nenhum ticket associado à tarefa ${task_id}` };
      }
      
      console.log(`[WebhookHandler] Ticket encontrado: ${ticket.id}, atualizando status para ${systemStatus}`);
      
      // Atualizar o status do ticket usando a sincronização de status
      await clickupStatusSync.processClickUpStatusChange(task_id, ticket.id, systemStatus);
      
      return {
        success: true,
        message: `Status atualizado com sucesso para ${systemStatus}`,
        data: {
          ticketId: ticket.id,
          taskId: task_id,
          oldStatus: statusChange.before?.status,
          newStatus: newClickUpStatus,
          systemStatus
        }
      };
    } catch (error) {
      console.error('[WebhookHandler] Erro ao processar mudança de status:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro ao processar mudança de status' 
      };
    }
  }
}

// Exportar instância única para uso no aplicativo
export const clickupWebhookHandler = new ClickUpWebhookHandler(); 