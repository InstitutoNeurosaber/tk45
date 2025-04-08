import { 
  collection, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc, 
  query,
  where,
  getDocs,
  getDoc,
  Timestamp,
  QueryDocumentSnapshot as FirestoreQueryDocumentSnapshot,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { webhookService } from './webhookService';
import type { Ticket, TicketStatus } from '../types/ticket';
import { priorityDeadlines } from '../types/ticket';

function convertToTicket(doc: any): Ticket {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    deadline: data.deadline?.toDate() || new Date(),
    attachments: data.attachments || [],
    taskId: data.taskId,
    priorityLockedAt: data.priorityLockedAt?.toDate(),
    priorityLockedBy: data.priorityLockedBy,
    priorityReason: data.priorityReason
  };
}

export const ticketService = {
  async findByTitle(title: string): Promise<Ticket[]> {
    try {
      const ticketsRef = collection(db, 'tickets');
      const q = query(ticketsRef, where('title', '>=', title), where('title', '<=', title + '\uf8ff'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc: any) => convertToTicket(doc));
    } catch (error) {
      console.error('Erro ao buscar tickets por título:', error);
      throw error;
    }
  },

  async createTicket(ticketData: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'deadline'>): Promise<Ticket> {
    try {
      const now = Timestamp.now();
      const deadlineDate = new Date(now.toMillis() + priorityDeadlines[ticketData.priority]);
      const deadline = Timestamp.fromDate(deadlineDate);

      const ticketsRef = collection(db, 'tickets');
      
      const ticketToSave = {
        ...ticketData,
        status: 'open',
        createdAt: now,
        updatedAt: now,
        deadline,
        attachments: []
      };

      const docRef = await addDoc(ticketsRef, ticketToSave);

      const newTicket: Ticket = {
        ...ticketData,
        id: docRef.id,
        status: 'open',
        createdAt: now.toDate(),
        updatedAt: now.toDate(),
        deadline: deadline.toDate(),
        attachments: []
      };

      try {
        // Tentar sincronizar com o ClickUp automaticamente
        try {
          const { clickupService } = await import('../services/clickupService');
          const isConfigured = await clickupService.isConfigured();
          
          if (isConfigured) {
            console.log("[TicketService] ClickUp configurado. Sincronizando ticket recém-criado automaticamente...");
            try {
              const taskId = await clickupService.syncTicketWithClickUp(newTicket);
              
              if (taskId) {
                console.log(`[TicketService] Sincronização automática bem-sucedida. ID da tarefa ClickUp: ${taskId}`);
                // Atualizar o ticket com o taskId do ClickUp
                const updateData = { 
                  taskId,
                  updatedAt: Timestamp.now()
                };
                
                await updateDoc(doc(db, 'tickets', newTicket.id), updateData);
                newTicket.taskId = taskId;
                newTicket.updatedAt = updateData.updatedAt.toDate();
              }
            } catch (syncError) {
              console.error("[TicketService] Erro específico na sincronização com ClickUp:", syncError);
              // Se o erro incluir "UUID" ou "custom_fields", é um problema com o formato do campo personalizado
              if (syncError instanceof Error && 
                  (syncError.message.includes('UUID') || 
                   syncError.message.includes('custom_fields'))) {
                console.error("[TicketService] Erro relacionado a campos personalizados. Estes foram desativados.");
              }
              // Não falha a criação do ticket se a sincronização falhar
            }
          } else {
            console.log("[TicketService] ClickUp não está configurado. Pulando sincronização automática.");
          }
        } catch (clickupError) {
          console.error("[TicketService] Erro ao sincronizar com ClickUp automaticamente:", clickupError);
          // Não falha a criação do ticket se a sincronização falhar
        }
        
        // Enviar webhook e processar resposta
        const webhookResponse = await webhookService.sendWebhookNotification('ticket.created', newTicket);
        
        // Se houver resposta do webhook, atualizar o ticket
        if (webhookResponse) {
          const updates: Partial<Ticket> = {
            updatedAt: Timestamp.now().toDate()
          };

          // Atualizar taskId se retornado e se ainda não tiver sido atualizado pelo ClickUp
          if (webhookResponse.taskId && !newTicket.taskId) {
            updates.taskId = webhookResponse.taskId;
          }

          // Atualizar outros campos se necessário
          if (Object.keys(updates).length > 0) {
            await updateDoc(docRef, {
              ...updates,
              updatedAt: Timestamp.now()
            });
            Object.assign(newTicket, updates);
          }
        }
      } catch (error) {
        console.error('Erro ao processar resposta do webhook:', error);
      }
      
      return newTicket;
    } catch (error) {
      console.error('Erro ao criar ticket:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao criar ticket');
    }
  },

  async updateTicket(ticketId: string, changes: Partial<Ticket>): Promise<Ticket> {
    try {
      const ticketRef = doc(db, 'tickets', ticketId);
      const ticketDoc = await getDoc(ticketRef);
      
      if (!ticketDoc.exists()) {
        throw new Error('Ticket não encontrado');
      }

      const currentTicket = convertToTicket(ticketDoc as any);
      const now = Timestamp.now();
      
      // Criar uma cópia das alterações para processar
      const updates: any = {
        ...changes,
        updatedAt: now
      };

      // Converter deadline para Timestamp se fornecido nas alterações
      if (changes.deadline) {
        const deadlineDate = changes.deadline instanceof Date 
          ? changes.deadline 
          : new Date(changes.deadline);
        
        if (!isNaN(deadlineDate.getTime())) {
          updates.deadline = Timestamp.fromDate(deadlineDate);
        } else {
          console.error('Data de prazo inválida:', changes.deadline);
          delete updates.deadline; // Remover se inválida
        }
      }

      // Atualizar deadline baseado na prioridade, se alterada
      if (changes.priority && changes.priority !== currentTicket.priority) {
        updates.priorityLockedBy = changes.priorityLockedBy;
        updates.priorityLockedAt = now;
        updates.priorityReason = changes.priorityReason;

        const newDeadline = new Date(now.toMillis() + priorityDeadlines[changes.priority]);
        updates.deadline = Timestamp.fromDate(newDeadline);
      }
      
      // Atualizar no Firestore
      await updateDoc(ticketRef, updates);

      // Preparar o objeto de retorno
      const updatedTicket = {
        ...currentTicket,
        ...changes, // Manter as alterações originais para manter o tipo
        updatedAt: now.toDate()
      };

      // Garantir que a deadline seja um objeto Date
      if (updates.deadline && typeof updates.deadline.toDate === 'function') {
        updatedTicket.deadline = updates.deadline.toDate();
      } else if (changes.deadline instanceof Date) {
        updatedTicket.deadline = changes.deadline;
      } else if (typeof changes.deadline === 'string') {
        updatedTicket.deadline = new Date(changes.deadline);
      }

      try {
        const webhookResponse = await webhookService.sendWebhookNotification('ticket.updated', updatedTicket);
        
        // Atualizar ticket com dados da resposta do webhook se necessário
        if (webhookResponse && webhookResponse.taskId && !updatedTicket.taskId) {
          await updateDoc(ticketRef, {
            taskId: webhookResponse.taskId,
            updatedAt: Timestamp.now()
          });
          updatedTicket.taskId = webhookResponse.taskId;
        }
      } catch (error) {
        console.error('Erro ao enviar webhook de atualização:', error);
      }

      return updatedTicket;
    } catch (error) {
      console.error('Erro ao atualizar ticket:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao atualizar ticket');
    }
  },

  async deleteTicket(ticketId: string): Promise<void> {
    try {
      // Verificar se o ticket existe
      const ticketRef = doc(db, 'tickets', ticketId);
      const ticketDoc = await getDoc(ticketRef);
      
      if (!ticketDoc.exists()) {
        throw new Error('Ticket não encontrado');
      }

      // Deletar o ticket
      await deleteDoc(ticketRef);

      // Enviar notificação de webhook
      try {
        await webhookService.sendWebhookNotification('ticket.deleted', {
          ticketId,
          ticket: convertToTicket(ticketDoc as any)
        });
      } catch (error) {
        console.error('Erro ao enviar webhook de exclusão de ticket:', error);
      }
    } catch (error) {
      console.error('Erro ao excluir ticket:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao excluir ticket');
    }
  }
};