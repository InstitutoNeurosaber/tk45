import { create } from 'zustand';
import { collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, Timestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { clickupService } from '../services/clickupService';
import { ClickUpAPI } from '../lib/clickup/api';
import { db } from '../lib/firebase';
import { ticketService } from '../services/ticketService';
import type { Ticket, TicketStatus } from '../types/ticket';
import { useAuthStore } from '../stores/authStore';

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
  optimisticUpdateStatus: (ticketId: string, status: TicketStatus) => void;
  syncWithClickUp: (ticket: Ticket) => Promise<Ticket>;
  archiveTicket: (ticketId: string) => Promise<void>;
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
    
    // Obter o estado do usuário atual (necessário importar useAuthStore no topo do arquivo)
    const { userData } = useAuthStore.getState();
    
    // Verificar se o usuário é administrador
    if (userData?.role !== 'admin') {
      throw new Error('Apenas administradores podem alterar o status dos tickets');
    }
    
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

  archiveTicket: async (ticketId: string) => {
    const previousTickets = get().tickets;
    const now = new Date();
    const currentTicket = get().tickets.find(t => t.id === ticketId);
    
    // Obter o estado do usuário atual
    const { userData } = useAuthStore.getState();
    
    // Verificar se o usuário é administrador
    if (userData?.role !== 'admin') {
      throw new Error('Apenas administradores podem arquivar tickets');
    }
    
    if (!currentTicket) {
      throw new Error('Ticket não encontrado');
    }
    
    try {
      // Atualização otimista
      set(state => ({
        tickets: state.tickets.map(t => 
          t.id === ticketId ? { 
            ...t, 
            archived: true, 
            archivedAt: now,
            archivedBy: userData?.name || 'Administrador',
            updatedAt: now 
          } : t
        )
      }));

      // Atualizar no backend
      await ticketService.updateTicket(ticketId, {
        archived: true,
        archivedAt: now,
        archivedBy: userData?.name || 'Administrador',
        updatedAt: now
      });
      
      // Não é necessário sincronizar este status com o ClickUp, pois é um estado interno
      
    } catch (error) {
      // Reverter em caso de erro
      set({ tickets: previousTickets });
      throw error;
    }
  },

  syncWithClickUp: async (ticket: Ticket) => {
    try {
      console.log("[TicketStore] Iniciando sincronização manual com ClickUp para o ticket:", ticket.id);
      
      // Verificar se o ClickUp está configurado
      const isConfigured = await clickupService.isConfigured();
      if (!isConfigured) {
        console.log("[TicketStore] ClickUp não configurado, pulando sincronização manual");
        throw new Error("ClickUp não está configurado. Configure a integração primeiro.");
      }

      console.log("[TicketStore] Tentando sincronizar o ticket com o ClickUp");
      
      // Sincronizar o ticket com o ClickUp
      const taskId = await clickupService.syncTicketWithClickUp(ticket);
      
      if (!taskId) {
        console.error("[TicketStore] Sincronização falhou, nenhum taskId retornado");
        throw new Error("Não foi possível sincronizar o ticket com o ClickUp.");
      }
      
      console.log(`[TicketStore] Ticket sincronizado com sucesso. taskId: ${taskId}`);
      
      // Atualizar o ticket com o taskId do ClickUp
      const updatedTicket = { ...ticket, taskId };
      
      // Atualizar o ticket no Firestore
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, { 
        taskId,
        updatedAt: Timestamp.now()
      });
      
      // Atualizar o estado no Zustand
      const { tickets } = get();
      const updatedTickets = tickets.map(t => 
        t.id === ticket.id ? updatedTicket : t
      );
      set({ tickets: updatedTickets });
      
      return updatedTicket;
    } catch (error) {
      console.error("[TicketStore] Erro na sincronização com ClickUp:", error);
      throw error;
    }
  }
}));