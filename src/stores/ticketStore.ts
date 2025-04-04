import { create } from 'zustand';
import { ticketService } from '../services/ticketService';
import type { Ticket, TicketStatus, Comment } from '../types/ticket';
import { ClickUpService } from '../services/clickupService';
import { ClickUpAPI } from '../lib/clickup';

// Instanciar o serviço do ClickUp
const clickupService = new ClickUpService();

interface TicketState {
  tickets: Ticket[];
  loading: boolean;
  error: string | null;
  setTickets: (tickets: Ticket[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
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

  createTicket: async (ticketData) => {
    try {
      set({ loading: true, error: null });
      const newTicket = await ticketService.createTicket(ticketData);
      
      // Tenta sincronizar com o ClickUp
      try {
        await clickupService.isConfigured().then(async (isConfigured) => {
          if (isConfigured) {
            console.log("ClickUp configurado, sincronizando ticket recém-criado");
            const taskId = await clickupService.syncTicketWithClickUp(newTicket);
            if (taskId) {
              // Atualiza o ticket com o taskId do ClickUp
              await ticketService.updateTicket(newTicket.id, { taskId });
              newTicket.taskId = taskId;
            }
          } else {
            console.log("ClickUp não configurado, pulando sincronização");
          }
        });
      } catch (syncError) {
        console.error("Erro ao sincronizar com ClickUp:", syncError);
        // Não falha a criação do ticket se a sincronização falhar
      }
      
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
      
      // Obter o ticket atual
      const currentTicket = get().tickets.find(t => t.id === ticketId);
      if (!currentTicket) {
        throw new Error('Ticket não encontrado');
      }
      
      // Atualizar o ticket no backend
      const updatedTicket = await ticketService.updateTicket(ticketId, changes);
      
      // Sincronizar com ClickUp se configurado
      try {
        await clickupService.isConfigured().then(async (isConfigured) => {
          if (isConfigured) {
            console.log("ClickUp configurado, sincronizando atualização de ticket");
            // Mesclar o ticket atual com as alterações para sincronização
            const mergedTicket = { ...currentTicket, ...updatedTicket };
            const taskId = await clickupService.syncTicketWithClickUp(mergedTicket);
            
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
    const previousTickets = get().tickets;
    const now = new Date();
    const currentTicket = get().tickets.find(t => t.id === ticketId);
    
    if (!currentTicket) {
      throw new Error('Ticket não encontrado');
    }
    
    try {
      // Atualização otimista
      set(state => ({
        tickets: state.tickets.map(t => 
          t.id === ticketId ? { ...t, status, updatedAt: now } : t
        )
      }));

      // Atualizar no backend
      await ticketService.updateTicket(ticketId, {
        status,
        updatedAt: now
      });
      
      // Sincronizar com ClickUp se configurado
      try {
        await clickupService.isConfigured().then(async (isConfigured) => {
          if (isConfigured) {
            console.log("ClickUp configurado, sincronizando status do ticket");
            const updatedTicket = { ...currentTicket, status, updatedAt: now };
            await clickupService.syncTicketWithClickUp(updatedTicket);
          }
        });
      } catch (syncError) {
        console.error("Erro ao sincronizar status com ClickUp:", syncError);
        // Não reverte a atualização do ticket se a sincronização falhar
      }
    } catch (error) {
      // Reverter em caso de erro
      set({ tickets: previousTickets });
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
          await clickupService.isConfigured().then(async (isConfigured) => {
            if (isConfigured) {
              console.log("ClickUp configurado, deletando tarefa");
              await clickupService.deleteTask(ticketToDelete);
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
      const newComment = await ticketService.addComment(ticketId, commentData);
      
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
          await clickupService.isConfigured().then(async (isConfigured) => {
            if (isConfigured) {
              console.log("ClickUp configurado, adicionando comentário à tarefa");
              // Adicionar o ticketId ao comentário antes de enviar para o ClickUp
              const commentWithTicketId = {
                ...newComment,
                // Já deve ter sido definido pelo ticketService, mas garantimos aqui
                ticketId
              };
              await clickupService.addComment(ticket.taskId as string, commentWithTicketId);
            }
          });
        } catch (syncError) {
          console.error("Erro ao adicionar comentário no ClickUp:", syncError);
          // Não falha a adição do comentário se a sincronização falhar
        }
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
      console.log("Iniciando sincronização manual com ClickUp para o ticket:", ticket.id);
      
      // Verificar se o ClickUp está configurado
      const isConfigured = await clickupService.isConfigured();
      if (!isConfigured) {
        console.log("ClickUp não configurado, pulando sincronização manual");
        throw new Error("ClickUp não está configurado. Configure a integração primeiro.");
      }

      // É esperado o erro 404 se a tarefa não existir no ClickUp, 
      // já que estamos tentando buscar uma tarefa pelo ID do ticket
      console.log("Tentando sincronizar o ticket com o ClickUp (criação ou atualização)...");
      
      // Se o ticket já tem um taskId, vamos verificar se ele existe realmente
      if (ticket.taskId) {
        console.log(`Ticket já possui um taskId: ${ticket.taskId}, verificando se existe no ClickUp...`);
        try {
          // Não podemos acessar diretamente o método getConfig, 
          // mas podemos obter uma instância da API via isConfigured
          const api = await clickupService.isConfigured()
            .then(() => new ClickUpAPI((clickupService as any)._apiKey || "")); // Usar qualquer técnica disponível
          
          const taskExists = await api.taskExists(ticket.taskId);
          
          if (!taskExists) {
            console.log(`A tarefa ${ticket.taskId} não existe mais no ClickUp. Criando nova tarefa...`);
            // Limpar o taskId para que uma nova tarefa seja criada
            ticket = { ...ticket, taskId: undefined };
          } else {
            console.log(`A tarefa ${ticket.taskId} existe no ClickUp. Atualizando...`);
          }
        } catch (error) {
          console.error("Erro ao verificar existência da tarefa:", error);
          // Se o erro for 404, continuamos para criar uma nova tarefa
          console.log("Considerando que a tarefa não existe e criando uma nova...");
          ticket = { ...ticket, taskId: undefined };
        }
      } else {
        console.log("Ticket não possui taskId, criando nova tarefa no ClickUp...");
      }

      // Tentar sincronizar com o ClickUp (isso tentará criar ou atualizar)
      const taskId = await clickupService.syncTicketWithClickUp(ticket);
      console.log(`Resultado da sincronização: taskId = ${taskId}`);
      
      if (taskId && taskId !== ticket.taskId) {
        // Atualizar o ticket com o novo taskId
        console.log(`Novo taskId recebido: ${taskId}, atualizando ticket...`);
        const updatedTicket = {
          ...ticket,
          taskId
        };
        
        // Atualizar no backend
        console.log("Salvando novo taskId no banco de dados...");
        await ticketService.updateTicket(ticket.id, { taskId });
        
        // Atualizar no estado local
        console.log("Atualizando estado local com novo taskId...");
        set(state => ({
          tickets: state.tickets.map(t => 
            t.id === ticket.id ? { ...t, taskId } : t
          )
        }));
        
        console.log("Sincronização concluída com sucesso!");
        return updatedTicket;
      } else if (!taskId) {
        console.error("Não foi possível obter um taskId válido do ClickUp");
        throw new Error("Não foi possível criar a tarefa no ClickUp. Verifique a configuração e os logs.");
      }
      
      console.log("Nenhuma mudança no taskId, mantendo ticket como está");
      return ticket;
    } catch (error) {
      console.error("Erro na sincronização manual com ClickUp:", error);
      throw error; // Propagar o erro para que a UI possa mostrar a mensagem
    }
  }
}));