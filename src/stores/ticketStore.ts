import { create } from 'zustand';
import { collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { clickupService } from '../services/clickupService';
import { ClickUpAPI } from '../lib/clickup';
import { db } from '../lib/firebase';
import { ticketService } from '../services/ticketService';
import type { Ticket, TicketStatus, TicketPriority, Comment } from '../types/ticket';
import { clickupStatusSync } from '../services/clickup/statusSync';
import { syncService, taskService } from '../services/clickup';

interface TicketState {
  tickets: Ticket[];
  loading: boolean;
  error: string | null;
  setTickets: (tickets: Ticket[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getTicketById: (id: string) => Promise<Ticket | null>;
  createTicket: (ticket: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'deadline'>) => Promise<Ticket>;
  updateTicket: (ticketId: string, changes: Partial<Ticket>) => Promise<void>;
  updateTicketStatus: (ticketId: string, status: TicketStatus) => Promise<void>;
  deleteTicket: (ticketId: string) => Promise<void>;
  addComment: (ticketId: string, comment: Omit<Comment, 'id' | 'createdAt' | 'ticketId'>) => Promise<Comment>;
  deleteComment: (ticketId: string, commentId: string) => Promise<void>;
  optimisticUpdateStatus: (ticketId: string, status: TicketStatus) => void;
  syncWithClickUp: (ticket: Ticket) => Promise<Ticket>;
}

export const useTicketStore = create<TicketState>((set, get) => ({
  tickets: [],
  loading: false,
  error: null,

  setTickets: (tickets) => set({ tickets }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  getTicketById: async (id) => {
    // Primeiro verifica se o ticket já está no state
    const cachedTicket = get().tickets.find(t => t.id === id);
    if (cachedTicket) {
      console.log(`[TicketStore] Ticket ${id} encontrado no cache`);
      return cachedTicket;
    }

    // Se não estiver no state, busca do Firestore
    try {
      console.log(`[TicketStore] Buscando ticket ${id} do Firestore`);
      const ticketRef = doc(db, 'tickets', id);
      const ticketDoc = await getDoc(ticketRef);
      
      if (!ticketDoc.exists()) {
        console.log(`[TicketStore] Ticket ${id} não encontrado no Firestore`);
        return null;
      }
      
      const ticketData = ticketDoc.data();
      const ticket: Ticket = {
        id: ticketDoc.id,
        title: ticketData.title,
        description: ticketData.description,
        status: ticketData.status,
        priority: ticketData.priority,
        category: ticketData.category,
        userId: ticketData.userId,
        createdAt: ticketData.createdAt.toDate(),
        updatedAt: ticketData.updatedAt.toDate(),
        deadline: ticketData.deadline.toDate(),
        comments: ticketData.comments?.map((comment: any) => ({
          ...comment,
          createdAt: comment.createdAt.toDate()
        })) || [],
        attachments: ticketData.attachments || [],
        taskId: ticketData.taskId,
        priorityLockedAt: ticketData.priorityLockedAt?.toDate(),
        priorityLockedBy: ticketData.priorityLockedBy,
        priorityReason: ticketData.priorityReason,
        deadlineHistory: ticketData.deadlineHistory?.map((history: any) => ({
          ...history,
          oldDeadline: history.oldDeadline.toDate(),
          newDeadline: history.newDeadline.toDate(),
          extendedAt: history.extendedAt.toDate()
        })) || []
      };
      
      console.log(`[TicketStore] Ticket ${id} encontrado no Firestore:`, ticket);
      return ticket;
    } catch (error) {
      console.error(`[TicketStore] Erro ao buscar ticket ${id}:`, error);
      throw error;
    }
  },

  createTicket: async (ticketData) => {
    try {
      set({ loading: true, error: null });
      const newTicket = await ticketService.createTicket(ticketData);
      
      // A sincronização com o ClickUp agora é feita automaticamente no serviço
      
      set(state => ({
        tickets: [newTicket, ...state.tickets],
        loading: false
      }));

      return newTicket;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Erro ao criar ticket',
        loading: false 
      });
      throw error;
    }
  },

  updateTicket: async (ticketId, changes) => {
    try {
      set({ loading: true, error: null });
      
      const currentTicket = get().tickets.find(t => t.id === ticketId);
      if (!currentTicket) {
        throw new Error('Ticket não encontrado');
      }
      
      // Atualizar o ticket no backend
      const updatedTicket = await ticketService.updateTicket(ticketId, changes);
      
      // Sincronizar com ClickUp se configurado
      try {
        await taskService.isConfigured().then(async (isConfigured) => {
          if (isConfigured) {
            console.log("ClickUp configurado, sincronizando atualização de ticket");
            // Mesclar o ticket atual com as alterações para sincronização
            const mergedTicket = { ...currentTicket, ...updatedTicket };
            const taskId = await syncService.syncTicketWithClickUp(mergedTicket);
            
            // Se o taskId mudou, atualizar no ticket
            if (taskId && taskId !== currentTicket.taskId) {
              await ticketService.updateTicket(ticketId, { taskId });
              updatedTicket.taskId = taskId;
            }
          }
        });
      } catch (syncError) {
        console.error("Erro ao sincronizar com ClickUp:", syncError);
        // Não falha a atualização do ticket se a sincronização falhar
      }
      
      set(state => ({
        tickets: state.tickets.map(t => t.id === ticketId ? { ...t, ...updatedTicket } : t),
        loading: false
      }));
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Erro ao atualizar ticket',
        loading: false 
      });
      throw error;
    }
  },

  updateTicketStatus: async (ticketId: string, status: TicketStatus) => {
    try {
      console.log(`[TicketStore] Solicitando atualização de status do ticket ${ticketId} para ${status}`);
      
      // Usamos o serviço de sincronização que cuida de toda a lógica de atualização
      // incluindo controle de duplicação, atualização no sistema e propagação para o ClickUp
      const success = await clickupStatusSync.updateSystemStatus(ticketId, status);
      
      if (!success) {
        console.error(`[TicketStore] Falha ao atualizar status do ticket ${ticketId}`);
        throw new Error('Falha ao atualizar status');
      }
      
      return; // Sucesso
    } catch (error) {
      console.error(`[TicketStore] Erro ao atualizar status do ticket ${ticketId}:`, error);
      throw error;
    }
  },

  deleteTicket: async (ticketId: string) => {
    const previousTickets = get().tickets;
    const ticketToDelete = previousTickets.find(t => t.id === ticketId);
    
    if (!ticketToDelete) {
      throw new Error('Ticket não encontrado');
    }
    
    try {
      set({ loading: true, error: null });
      
      // Atualização otimista
      set(state => ({
        tickets: state.tickets.filter(t => t.id !== ticketId)
      }));

      await ticketService.deleteTicket(ticketId);
      
      // Deletar no ClickUp se configurado e se tiver taskId
      if (ticketToDelete.taskId) {
        try {
          await taskService.isConfigured().then(async (isConfigured) => {
            if (isConfigured) {
              console.log("ClickUp configurado, deletando tarefa");
              await syncService.deleteTask(ticketToDelete);
            }
          });
        } catch (syncError) {
          console.error("Erro ao deletar tarefa no ClickUp:", syncError);
          // Não reverte a exclusão do ticket se a sincronização falhar
        }
      }
      
      set({ loading: false });
    } catch (error) {
      // Reverter em caso de erro
      set({ 
        tickets: previousTickets,
        error: error instanceof Error ? error.message : 'Erro ao excluir ticket',
        loading: false 
      });
      throw error;
    }
  },

  addComment: async (ticketId, commentData) => {
    try {
      set({ loading: true, error: null });
      // Adicionamos o ticketId ao comment antes de enviar para o serviço
      const commentWithTicketId = {
        ...commentData,
        ticketId
      };
      const newComment = await ticketService.addComment(ticketId, commentWithTicketId);
      
      // Atualizar o estado local
      set(state => ({
        tickets: state.tickets.map(ticket => {
          if (ticket.id === ticketId) {
            const comments = [...(ticket.comments || []), newComment];
            return { ...ticket, comments };
          }
          return ticket;
        }),
        loading: false
      }));
      
      // Adicionar comentário no ClickUp se configurado
      const ticket = get().tickets.find(t => t.id === ticketId);
      if (ticket?.taskId) {
        try {
          console.log(`[TicketStore] Ticket ${ticketId} tem taskId ${ticket.taskId}, verificando integração ClickUp`);
          await taskService.isConfigured().then(async (isConfigured) => {
            if (isConfigured) {
              console.log(`[TicketStore] ClickUp configurado, adicionando comentário à tarefa ${ticket.taskId}`);
              // Garantir que taskId não é undefined
              const clickupTaskId = ticket.taskId as string;
              await syncService.syncComment(ticketId, clickupTaskId, newComment.content);
            } else {
              console.log('[TicketStore] ClickUp não está configurado, pulando sincronização de comentário');
            }
          });
        } catch (syncError) {
          console.error("[TicketStore] Erro ao adicionar comentário no ClickUp:", syncError);
          // Não falha a adição do comentário se a sincronização falhar
        }
      } else {
        console.log(`[TicketStore] Ticket ${ticketId} não tem taskId associado, pulando sincronização ClickUp`);
      }

      return newComment;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Erro ao adicionar comentário',
        loading: false 
      });
      throw error;
    }
  },

  deleteComment: async (ticketId, commentId) => {
    try {
      set({ loading: true, error: null });
      const ticket = get().tickets.find(t => t.id === ticketId);
      
      // Guardar o comentário para possível referência e sincronização
      const commentToDelete = ticket?.comments?.find(c => c.id === commentId);
      
      await ticketService.deleteComment(ticketId, commentId);
      
      // Atualizar o estado local
      set(state => ({
        tickets: state.tickets.map(ticket => {
          if (ticket.id === ticketId) {
            const comments = (ticket.comments || []).filter(c => c.id !== commentId);
            return { ...ticket, comments };
          }
          return ticket;
        }),
        loading: false
      }));
      
      // Sincronizar exclusão do comentário com o ClickUp se aplicável
      if (ticket?.taskId && commentToDelete) {
        try {
          await taskService.isConfigured().then(async (isConfigured) => {
            if (isConfigured) {
              console.log("ClickUp configurado, notificando exclusão de comentário");
              // Como o ClickUp não permite excluir comentários via API, 
              // adicionamos um novo comentário indicando que o comentário anterior foi excluído
              const deletionNotice = {
                id: crypto.randomUUID(),
                content: `[Sistema] Um comentário foi excluído: "${commentToDelete.content.substring(0, 50)}${commentToDelete.content.length > 50 ? '...' : ''}"`,
                userId: commentToDelete.userId,
                userName: commentToDelete.userName || 'Usuário',
                ticketId: ticketId,
                createdAt: new Date()
              };
              await syncService.syncComment(ticketId, ticket.taskId as string, deletionNotice.content);
            }
          });
        } catch (syncError) {
          console.error("Erro ao sincronizar exclusão de comentário com ClickUp:", syncError);
          // Não falha a exclusão do comentário se a sincronização falhar
        }
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Erro ao excluir comentário',
        loading: false 
      });
      throw error;
    }
  },

  optimisticUpdateStatus: (ticketId: string, status: TicketStatus) => {
    const now = new Date();
    set(state => ({
      tickets: state.tickets.map(ticket =>
        ticket.id === ticketId
          ? { ...ticket, status, updatedAt: now }
          : ticket
      )
    }));
  },

  syncWithClickUp: async (ticket: Ticket) => {
    try {
      set({ loading: true, error: null });
      
      console.log("Iniciando sincronização manual com ClickUp para o ticket:", ticket.id);
      
      // Verificar se o ClickUp está configurado
      const isConfigured = await taskService.isConfigured();
      if (!isConfigured) {
        console.log("ClickUp não configurado, pulando sincronização manual");
        throw new Error("ClickUp não está configurado. Configure a integração primeiro.");
      }
      
      // É esperado o erro 404 se a tarefa não existir no ClickUp,
      // nesse caso, criamos uma nova tarefa
      console.log("Tentando sincronizar o ticket com o ClickUp (criação ou atualização)...");
      let taskExists = false;
      
      if (ticket.taskId) {
        console.log(`Ticket já possui um taskId: ${ticket.taskId}, verificando se existe no ClickUp...`);
        
        try {
          // Verificar se a tarefa ainda existe no ClickUp
          taskExists = await taskService.taskExists(ticket.taskId);
          
          if (!taskExists) {
            console.log(`A tarefa ${ticket.taskId} não existe mais no ClickUp. Criando nova tarefa...`);
            // Continua para criar uma nova tarefa
          } else {
            console.log(`A tarefa ${ticket.taskId} existe no ClickUp. Atualizando...`);
            // Tarefa existe, então podemos pular a criação
          }
        } catch (error) {
          console.error("Erro ao verificar existência da tarefa:", error);
          // Continua para criar uma nova tarefa
        }
      } else {
        console.log("Ticket não possui taskId, criando nova tarefa no ClickUp...");
      }
      
      // Tentar sincronizar com o ClickUp (isso tentará criar ou atualizar)
      const taskId = await syncService.syncTicketWithClickUp(ticket);
      
      // Se tivemos um resultado de sincronização bem-sucedido,
      // e o taskId é diferente do atual, atualizar o ticket:
      if (taskId && (!ticket.taskId || ticket.taskId !== taskId)) {
        console.log(`Recebido novo taskId: ${taskId}. Atualizando o ticket...`);
        
        await ticketService.updateTicket(ticket.id, { taskId });
        
        // Atualizar também no estado local:
        set(state => ({
          tickets: state.tickets.map(t => 
            t.id === ticket.id 
              ? { ...t, taskId } 
              : t
          )
        }));
      } else if (!taskId) {
        console.error("Não foi possível obter um taskId válido do ClickUp");
        throw new Error("Não foi possível criar a tarefa no ClickUp. Verifique a configuração e os logs.");
      }
      
      set({ loading: false });
      return {...ticket, taskId};
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Erro desconhecido' });
      console.error("Erro na sincronização manual com ClickUp:", error);
      throw error;
    }
  }
}));