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
  DocumentData,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { webhookService } from './webhookService';
import type { Ticket, Comment } from '../types/ticket';
import { priorityDeadlines } from '../types/ticket';

function convertToTicket(doc: DocumentData): Ticket {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
    deadline: data.deadline?.toDate(),
    comments: data.comments?.map((comment: any) => ({
      ...comment,
      createdAt: comment.createdAt.toDate()
    })) || [],
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
      return snapshot.docs.map(doc => convertToTicket(doc));
    } catch (error) {
      console.error('Erro ao buscar tickets por título:', error);
      throw error;
    }
  },

  async createTicket(ticketData: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'deadline'>): Promise<Ticket> {
    try {
      const now = Timestamp.now();
      const deadlineDate = new Date(now.toDate().getTime() + priorityDeadlines[ticketData.priority]);
      const deadline = Timestamp.fromDate(deadlineDate);

      const ticketsRef = collection(db, 'tickets');
      
      const ticketToSave = {
        ...ticketData,
        status: 'open',
        createdAt: now,
        updatedAt: now,
        deadline,
        comments: [],
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
        comments: [],
        attachments: []
      };

      try {
        // Enviar webhook e processar resposta
        const webhookResponse = await webhookService.sendWebhookNotification('ticket.created', newTicket);
        
        // Se houver resposta do webhook, atualizar o ticket
        if (webhookResponse) {
          const updates: Partial<Ticket> = {
            updatedAt: Timestamp.now()
          };

          // Atualizar taskId se retornado
          if (webhookResponse.taskId) {
            updates.taskId = webhookResponse.taskId;
          }

          // Atualizar outros campos se necessário
          if (Object.keys(updates).length > 0) {
            await updateDoc(docRef, updates);
            Object.assign(newTicket, updates, {
              updatedAt: updates.updatedAt?.toDate()
            });
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

      const currentTicket = convertToTicket(ticketDoc);
      const now = Timestamp.now();
      
      const updates = {
        ...changes,
        updatedAt: now
      };

      if (changes.priority && changes.priority !== currentTicket.priority) {
        updates.priorityLockedBy = changes.priorityLockedBy;
        updates.priorityLockedAt = now;
        updates.priorityReason = changes.priorityReason;

        const newDeadline = new Date(now.toDate().getTime() + priorityDeadlines[changes.priority]);
        updates.deadline = Timestamp.fromDate(newDeadline);
      }
      
      await updateDoc(ticketRef, updates);

      const updatedTicket = {
        ...currentTicket,
        ...updates,
        updatedAt: now.toDate(),
        deadline: updates.deadline?.toDate() || currentTicket.deadline
      };

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
      const ticketRef = doc(db, 'tickets', ticketId);
      const ticketDoc = await getDoc(ticketRef);
      
      if (!ticketDoc.exists()) {
        throw new Error('Ticket não encontrado');
      }

      const ticket = convertToTicket(ticketDoc);

      try {
        await webhookService.sendWebhookNotification('ticket.deleted', ticket);
      } catch (error) {
        console.error('Erro ao enviar webhook de exclusão:', error);
      }

      await deleteDoc(ticketRef);
    } catch (error) {
      console.error('Erro ao excluir ticket:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao excluir ticket');
    }
  },

  async addComment(ticketId: string, commentData: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> {
    try {
      console.log('[TicketService] Iniciando adição de comentário para ticket:', ticketId);
      console.log('[TicketService] Dados do comentário:', commentData);
      
      const ticketRef = doc(db, 'tickets', ticketId);
      const ticketDoc = await getDoc(ticketRef);
      
      if (!ticketDoc.exists()) {
        console.error('[TicketService] Ticket não encontrado:', ticketId);
        throw new Error('Ticket não encontrado');
      }
      
      console.log('[TicketService] Ticket encontrado, criando comentário');

      const now = Timestamp.now();
      const commentId = crypto.randomUUID();
      const newComment = {
        id: commentId,
        ...commentData,
        createdAt: now
      };
      
      console.log('[TicketService] Novo comentário criado com ID:', commentId);

      console.log('[TicketService] Atualizando documento no Firestore');
      await updateDoc(ticketRef, {
        comments: arrayUnion({
          ...newComment,
          createdAt: now
        }),
        updatedAt: now
      });
      console.log('[TicketService] Documento atualizado com sucesso no Firestore');

      try {
        console.log('[TicketService] Preparando para enviar webhook de comentário');
        const ticket = convertToTicket(ticketDoc);
        console.log('[TicketService] Dados do ticket:', ticket);
        
        // Exatamente a mesma estrutura usada para mudança de status
        const webhookData = {
          ticketId,
          status: 'commented', // Informação fictícia de status para manter o padrão
          previousStatus: ticket.status, // Manter a estrutura idêntica à mudança de status
          ticket, // O ticket completo
          userId: commentData.userId,
          userName: commentData.userName,
          // Adicionar dados do comentário, mas manter estrutura principal como no status
          comment: {
            ...newComment,
            createdAt: now.toDate()
          }
        };
        console.log('[TicketService] Dados para webhook:', JSON.stringify(webhookData, null, 2));
        
        console.log('[TicketService] Chamando webhookService.sendWebhookNotification');
        // Usar o mesmo evento que o de status para garantir compatibilidade
        try {
          const webhookResponse = await webhookService.sendWebhookNotification('ticket.status_changed', webhookData);
          console.log('[TicketService] Resposta do webhook:', webhookResponse);
        
          // Processar resposta do webhook se necessário
          if (webhookResponse && webhookResponse.taskId && !ticket.taskId) {
            console.log('[TicketService] Atualizando ticket com taskId do webhook:', webhookResponse.taskId);
            await updateDoc(ticketRef, {
              taskId: webhookResponse.taskId,
              updatedAt: Timestamp.now()
            });
            console.log('[TicketService] Ticket atualizado com taskId');
          }
        } catch (webhookSendError) {
          console.error('[TicketService] Erro ao enviar webhook de comentário (capturado internamente):', webhookSendError);
        }
      } catch (error) {
        console.error('[TicketService] Erro ao enviar webhook de comentário:', error);
      }

      console.log('[TicketService] Retornando comentário criado');
      return {
        ...newComment,
        createdAt: now.toDate()
      };
    } catch (error) {
      console.error('[TicketService] Erro ao adicionar comentário:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao adicionar comentário');
    }
  },

  async deleteComment(ticketId: string, commentId: string): Promise<void> {
    try {
      const ticketRef = doc(db, 'tickets', ticketId);
      const ticketDoc = await getDoc(ticketRef);
      
      if (!ticketDoc.exists()) {
        throw new Error('Ticket não encontrado');
      }

      const ticket = convertToTicket(ticketDoc);
      const comment = ticket.comments?.find(c => c.id === commentId);

      if (!comment) {
        throw new Error('Comentário não encontrado');
      }

      const now = Timestamp.now();

      await updateDoc(ticketRef, {
        comments: arrayRemove(comment),
        updatedAt: now
      });

      try {
        await webhookService.sendWebhookNotification('ticket.comment_deleted', {
          ticketId,
          commentId,
          ticket
        });
      } catch (error) {
        console.error('Erro ao enviar webhook de exclusão de comentário:', error);
      }
    } catch (error) {
      console.error('Erro ao excluir comentário:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao excluir comentário');
    }
  }
};