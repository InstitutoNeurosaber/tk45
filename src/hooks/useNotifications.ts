import { useEffect, useCallback, useState } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  FirebaseFirestore,
  DocumentData 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNotificationStore } from '../stores/notificationStore';
import { notificationService } from '../services/notificationService';
import { useAuthStore } from '../stores/authStore';
import type { Notification } from '../types/ticket';

export function useNotifications() {
  const { user } = useAuthStore();
  const {
    notifications,
    loading: storeLoading,
    error,
    setNotifications,
    setLoading: setStoreLoading,
    setError
  } = useNotificationStore();
  
  // Estado local para gerenciar loading de operações individuais
  const [localLoading, setLocalLoading] = useState(false);
  
  // Loading combinado (store ou local)
  const loading = storeLoading || localLoading;

  // Escutar mudanças nas notificações em tempo real
  useEffect(() => {
    if (!user) {
      setNotifications([]); // Limpa as notificações quando o usuário não está logado
      return;
    }

    setStoreLoading(true);
    setError(null);
    
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    // @ts-ignore - Ignoramos problemas de tipagem com o Firebase
    const unsubscribe = onSnapshot(q,
      // @ts-ignore - Ignoramos problemas de tipagem com o Firebase
      (snapshot) => {
        try {
          // @ts-ignore - Ignoramos problemas de tipagem com o Firebase
          const notificationList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data()?.createdAt?.toDate() || new Date()
          })) as Notification[];
          
          setNotifications(notificationList);
        } catch (error: unknown) {
          console.error('Erro ao processar notificações:', error);
          setError(error instanceof Error ? error.message : 'Erro ao processar notificações');
        } finally {
          setStoreLoading(false);
        }
      },
      (error: unknown) => {
        console.error('Erro ao buscar notificações:', error);
        setError(error instanceof Error ? error.message : 'Erro ao buscar notificações');
        setStoreLoading(false);
      }
    );

    return () => {
      unsubscribe();
      setStoreLoading(false);
    };
  }, [user, setNotifications, setStoreLoading, setError]);

  const createNotification = useCallback(async (
    notification: Omit<Notification, 'id' | 'createdAt' | 'read'>
  ) => {
    try {
      setLocalLoading(true);
      setError(null);
      await notificationService.createNotification(notification);
    } catch (error: unknown) {
      console.error('Erro ao criar notificação:', error);
      setError(error instanceof Error ? error.message : 'Erro ao criar notificação');
      throw error;
    } finally {
      setLocalLoading(false);
    }
  }, [setError]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!notificationId) {
      console.error('ID de notificação não fornecido');
      return;
    }
    
    try {
      setLocalLoading(true);
      setError(null);
      await notificationService.markAsRead(notificationId);
    } catch (error: unknown) {
      console.error('Erro ao marcar notificação como lida:', error);
      setError(error instanceof Error ? error.message : 'Erro ao marcar notificação como lida');
      throw error;
    } finally {
      setLocalLoading(false);
    }
  }, [setError]);

  const markAllAsRead = useCallback(async () => {
    if (!user?.uid) {
      console.error('Usuário não está logado');
      return;
    }
    
    try {
      setLocalLoading(true);
      setError(null);
      await notificationService.markAllAsRead(user.uid);
    } catch (error: unknown) {
      console.error('Erro ao marcar todas notificações como lidas:', error);
      setError(error instanceof Error ? error.message : 'Erro ao marcar todas notificações como lidas');
      throw error;
    } finally {
      setLocalLoading(false);
    }
  }, [user, setError]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!notificationId) {
      console.error('ID de notificação não fornecido');
      return;
    }
    
    try {
      setLocalLoading(true);
      setError(null);
      await notificationService.deleteNotification(notificationId);
    } catch (error: unknown) {
      console.error('Erro ao deletar notificação:', error);
      setError(error instanceof Error ? error.message : 'Erro ao deletar notificação');
      throw error;
    } finally {
      setLocalLoading(false);
    }
  }, [setError]);

  const clearAll = useCallback(async () => {
    if (!user?.uid) {
      console.error('Usuário não está logado');
      return;
    }
    
    try {
      setLocalLoading(true);
      setError(null);
      await notificationService.clearAll(user.uid);
    } catch (error: unknown) {
      console.error('Erro ao limpar todas as notificações:', error);
      setError(error instanceof Error ? error.message : 'Erro ao limpar todas as notificações');
      throw error;
    } finally {
      setLocalLoading(false);
    }
  }, [user, setError]);

  return {
    notifications,
    loading,
    error,
    createNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll
  };
}