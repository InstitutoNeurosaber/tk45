import { create } from 'zustand';
import { notificationService } from '../services/notificationService';
import type { Notification } from '../types/ticket';

interface NotificationState {
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  setNotifications: (notifications: Notification[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  createNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearAll: (userId: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  loading: false,
  error: null,

  setNotifications: (notifications) => set({ notifications }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  createNotification: async (notificationData) => {
    try {
      set({ loading: true, error: null });
      await notificationService.createNotification(notificationData);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar notificação';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  markAsRead: async (notificationId) => {
    try {
      set({ loading: true, error: null });
      await notificationService.markAsRead(notificationId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao marcar notificação como lida';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  markAllAsRead: async (userId) => {
    try {
      set({ loading: true, error: null });
      await notificationService.markAllAsRead(userId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao marcar todas notificações como lidas';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  deleteNotification: async (notificationId) => {
    try {
      set({ loading: true, error: null });
      await notificationService.deleteNotification(notificationId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao excluir notificação';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  clearAll: async (userId) => {
    try {
      set({ loading: true, error: null });
      await notificationService.clearAll(userId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao limpar todas as notificações';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ loading: false });
    }
  }
}));