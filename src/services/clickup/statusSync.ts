import { ticketService } from '../ticketService';
import { syncService } from './syncService';
import { statusMapper } from './statusMapper';
import { taskService } from './taskService';
import type { Ticket, TicketStatus } from '../../types/ticket';

/**
 * Flag para rastrear mudanças recentes e evitar loops infinitos
 */
interface StatusChange {
  ticketId: string;
  taskId: string;
  newStatus: TicketStatus;
  source: 'system' | 'clickup';
  timestamp: number;
}

/**
 * Serviço para sincronizar status entre o sistema de tickets e o ClickUp
 * Implementa lógica para evitar loops e rastrear a origem das mudanças
 */
export class ClickUpStatusSync {
  // Armazena as mudanças recentes para evitar loops
  private recentChanges: StatusChange[] = [];
  // Tempo (em ms) para considerar uma mudança como "recente" (5 segundos)
  private readonly CHANGE_EXPIRY_TIME = 5000;

  /**
   * Registra uma mudança de status recente
   */
  registerChange(change: StatusChange): void {
    // Limpar mudanças expiradas
    this.cleanExpiredChanges();
    
    // Adicionar a nova mudança
    this.recentChanges.push(change);
    console.log(`[ClickUpStatusSync] Registrada mudança de status: ${change.ticketId} -> ${change.newStatus} (origem: ${change.source})`);
  }

  /**
   * Verifica se uma mudança similar já foi processada recentemente
   * para evitar loops infinitos de atualização
   */
  isDuplicateChange(ticketId: string, taskId: string, status: TicketStatus, source: 'system' | 'clickup'): boolean {
    // Limpar mudanças expiradas
    this.cleanExpiredChanges();
    
    // Verificar se já existe uma mudança recente com os mesmos dados
    const duplicate = this.recentChanges.some(change => 
      change.ticketId === ticketId &&
      change.taskId === taskId && 
      change.newStatus === status && 
      // Só consideramos duplicada se vier da mesma fonte
      change.source === source
    );
    
    if (duplicate) {
      console.log(`[ClickUpStatusSync] Detectada mudança duplicada: ${ticketId} -> ${status} (origem: ${source}), ignorando`);
    }
    
    return duplicate;
  }

  /**
   * Remove mudanças antigas da lista
   */
  private cleanExpiredChanges(): void {
    const now = Date.now();
    this.recentChanges = this.recentChanges.filter(change => 
      (now - change.timestamp) < this.CHANGE_EXPIRY_TIME
    );
  }

  /**
   * Processa mudança de status no sistema e propaga para o ClickUp
   * @param ticketId ID do ticket no sistema
   * @param status Novo status
   * @returns Sucesso da operação
   */
  async updateSystemStatus(ticketId: string, status: TicketStatus): Promise<boolean> {
    try {
      console.log(`[ClickUpStatusSync] ⚠️ INICIANDO atualização de status do ticket ${ticketId} para ${status}`);
      
      // Buscar o ticket atual
      const ticket = await ticketService.getTicket(ticketId);
      if (!ticket) {
        console.error(`[ClickUpStatusSync] Ticket ${ticketId} não encontrado`);
        return false;
      }
      
      console.log(`[ClickUpStatusSync] Ticket encontrado:`, JSON.stringify({
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
        taskId: ticket.taskId
      }));
      
      // Se não tiver taskId, não há necessidade de verificar duplicação
      if (!ticket.taskId) {
        console.log(`[ClickUpStatusSync] Ticket ${ticketId} não possui taskId, atualizando somente no sistema`);
        await ticketService.updateTicket(ticketId, { status });
        return true;
      }
      
      // Verificar se é uma mudança duplicada
      if (this.isDuplicateChange(ticketId, ticket.taskId, status, 'system')) {
        console.log(`[ClickUpStatusSync] Ignorando mudança duplicada de status`);
        return true;
      }
      
      // Registrar a mudança
      this.registerChange({
        ticketId,
        taskId: ticket.taskId,
        newStatus: status,
        source: 'system',
        timestamp: Date.now()
      });
      
      // Atualizar o status no sistema
      console.log(`[ClickUpStatusSync] Atualizando status no sistema para ${status}`);
      await ticketService.updateTicket(ticketId, { status });
      console.log(`[ClickUpStatusSync] Status atualizado no sistema com sucesso`);
      
      // Propagar para o ClickUp com marcação de origem
      console.log(`[ClickUpStatusSync] Verificando configuração do ClickUp...`);
      // Usar o novo serviço de tarefas para verificar a configuração
      const isConfigured = await taskService.isConfigured();
      console.log(`[ClickUpStatusSync] ClickUp configurado: ${isConfigured}`);
      
      if (isConfigured && ticket.taskId) {
        console.log(`[ClickUpStatusSync] ⚠️ ClickUp configurado, propagando mudança para o ClickUp. TaskId: ${ticket.taskId}`);
        
        // Criar um objeto ticket atualizado para sincronização
        const updatedTicket: Ticket = {
          ...ticket,
          status
        };
        
        console.log(`[ClickUpStatusSync] Ticket atualizado a ser enviado para ClickUp:`, JSON.stringify({
          id: updatedTicket.id,
          title: updatedTicket.title, 
          status: updatedTicket.status
        }));
        
        // Usar o novo mapeador de status
        const mappedStatus = statusMapper.mapSystemToClickUp(status);
        console.log(`[ClickUpStatusSync] Status do sistema: ${status}, será mapeado para o ClickUp como: ${mappedStatus}`);
        console.log(`[ClickUpStatusSync] Iniciando sincronização com ClickUp para status: ${status}`);
        
        // Adicionar marcação de origem na sincronização
        try {
          // Usar o novo serviço de sincronização
          const resultado = await syncService.syncTicketWithClickUp(updatedTicket, { 
            source: 'ticket-system',
            skipWebhookUpdate: true
          });
          console.log(`[ClickUpStatusSync] Resultado da sincronização:`, resultado);
          console.log(`[ClickUpStatusSync] Status propagado com sucesso para o ClickUp`);
        } catch (syncError) {
          console.error(`[ClickUpStatusSync] ❌ Erro na sincronização com ClickUp:`, syncError);
          console.error(`[ClickUpStatusSync] Detalhes do erro:`, syncError instanceof Error ? syncError.message : 'Erro desconhecido');
          // Não falhar completamente, já que o status no sistema foi atualizado
          
          if (syncError instanceof Error && syncError.message.includes('Status not found')) {
            console.error(`[ClickUpStatusSync] ❌ ERRO CRÍTICO: Status não encontrado no ClickUp!`);
            console.error(`[ClickUpStatusSync] Verifique se os status corretos existem no ClickUp: ABERTO, EM ANDAMENTO, RESOLVIDO e FECHADO`);
          }
        }
      } else {
        console.log(`[ClickUpStatusSync] Não foi possível propagar para ClickUp. isConfigured: ${isConfigured}, taskId: ${ticket.taskId}`);
      }
      
      return true;
    } catch (error) {
      console.error(`[ClickUpStatusSync] ❌ Erro ao atualizar status no sistema:`, error);
      console.error(`[ClickUpStatusSync] Detalhes do erro:`, error instanceof Error ? error.message : 'Erro desconhecido');
      return false;
    }
  }

  /**
   * Processa mudança de status vinda do ClickUp e atualiza o sistema
   * @param taskId ID da tarefa no ClickUp
   * @param newStatus Novo status mapeado para o sistema
   * @returns Sucesso da operação
   */
  async processClickUpStatusChange(taskId: string, ticketId: string, newStatus: TicketStatus): Promise<boolean> {
    try {
      console.log(`[ClickUpStatusSync] Processando mudança de status do ClickUp: ${taskId} -> ${newStatus}`);
      
      // Verificar se é uma mudança duplicada
      if (this.isDuplicateChange(ticketId, taskId, newStatus, 'clickup')) {
        console.log(`[ClickUpStatusSync] Ignorando mudança duplicada de status do ClickUp`);
        return true;
      }
      
      // Registrar a mudança
      this.registerChange({
        ticketId,
        taskId,
        newStatus,
        source: 'clickup',
        timestamp: Date.now()
      });
      
      // Atualizar o status no sistema sem propagar de volta para o ClickUp
      await ticketService.updateTicket(ticketId, { 
        status: newStatus 
      });
      
      console.log(`[ClickUpStatusSync] Status atualizado com sucesso no sistema`);
      return true;
    } catch (error) {
      console.error(`[ClickUpStatusSync] Erro ao processar mudança de status do ClickUp:`, error);
      return false;
    }
  }

  /**
   * Converte o status do ClickUp para o formato do sistema
   * @param clickupStatus Status recebido do ClickUp
   * @returns Status no formato do sistema
   */
  mapClickUpStatusToSystem(clickupStatus: string): TicketStatus {
    // Usar o novo mapeador de status
    try {
      return statusMapper.mapClickUpToSystem(clickupStatus);
    } catch (error) {
      console.error(`[ClickUpStatusSync] Erro ao mapear status do ClickUp:`, error);
      
      // Mapeamento manual alternativo (fallback)
      const normalizedStatus = clickupStatus.toLowerCase();
      
      if (normalizedStatus.includes('aberto') || normalizedStatus.includes('to do') || normalizedStatus.includes('open')) {
        return 'open';
      } else if (normalizedStatus.includes('andamento') || normalizedStatus.includes('progress') || normalizedStatus.includes('working')) {
        return 'in_progress';
      } else if (normalizedStatus.includes('resolv') || normalizedStatus.includes('complete') || normalizedStatus.includes('done')) {
        return 'resolved';
      } else if (normalizedStatus.includes('fechado') || normalizedStatus.includes('closed') || normalizedStatus.includes('cancel')) {
        return 'closed';
      } else {
        console.warn(`[ClickUpStatusSync] Status do ClickUp não reconhecido: ${clickupStatus}, usando 'open' como padrão`);
        return 'open';
      }
    }
  }
}

// Exportar instância única para uso no aplicativo
export const clickupStatusSync = new ClickUpStatusSync(); 