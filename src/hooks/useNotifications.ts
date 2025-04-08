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
import { toast } from 'react-toastify';
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
  
  // Estados para feedback visual
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  
  // Loading combinado (store ou local)
  const loading = storeLoading || localLoading;

  // Limpar mensagem de sucesso após 3 segundos
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

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

    let retryAttempt = 0;
    let unsubscribe: () => void;

    const setupListener = () => {
      try {
        // @ts-ignore - Ignoramos problemas de tipagem com o Firebase
        unsubscribe = onSnapshot(q,
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
              setStoreLoading(false);
              // Resetar contagem de tentativas quando sucesso
              retryAttempt = 0;
            } catch (error: unknown) {
              console.error('Erro ao processar notificações:', error);
              const errorMessage = error instanceof Error ? error.message : 'Erro ao processar notificações';
              setError(errorMessage);
              setStoreLoading(false);
              handleRetry(() => setupListener(), 'Erro ao processar notificações');
            }
          },
          (error: unknown) => {
            console.error('Erro ao buscar notificações:', error);
            const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar notificações';
            setError(errorMessage);
            setStoreLoading(false);
            handleRetry(() => setupListener(), 'Erro ao buscar notificações');
          }
        );
      } catch (error: unknown) {
        console.error('Erro ao configurar listener de notificações:', error);
        setError(error instanceof Error ? error.message : 'Erro ao configurar notificações');
        setStoreLoading(false);
        handleRetry(() => setupListener(), 'Erro ao configurar notificações');
      }
    };

    const handleRetry = (operation: () => void, errorMessage: string) => {
      if (retryAttempt < MAX_RETRIES) {
        retryAttempt++;
        console.log(`Tentativa ${retryAttempt} de ${MAX_RETRIES} para reconectar notificações...`);
        
        const timeout = Math.min(1000 * (2 ** retryAttempt), 30000); // Backoff exponencial, max 30s
        setTimeout(operation, timeout);
      } else {
        toast.error(`Falha ao carregar notificações após ${MAX_RETRIES} tentativas.`);
        console.error(`Desistindo após ${MAX_RETRIES} tentativas: ${errorMessage}`);
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      setStoreLoading(false);
    };
  }, [user, setNotifications, setStoreLoading, setError]);

  // Função auxiliar para operações com retry
  const withRetry = async (
    operation: () => Promise<void>,
    successMsg: string,
    errorMsg: string,
    finallyFn?: () => void
  ) => {
    try {
      setLocalLoading(true);
      setError(null);
      setRetryCount(0);
      
      await operation();
      
      setSuccessMessage(successMsg);
      toast.success(successMsg);
    } catch (error: unknown) {
      console.error(`${errorMsg}:`, error);
      const errorMessage = error instanceof Error ? error.message : errorMsg;
      setError(errorMessage);
      
      // Tentar novamente se ainda não atingiu o limite
      if (retryCount < MAX_RETRIES) {
        setRetryCount(prev => prev + 1);
        const timeout = Math.min(1000 * (2 ** retryCount), 30000);
        
        setTimeout(() => withRetry(operation, successMsg, errorMsg, finallyFn), timeout);
        toast.info(`Tentando novamente em ${timeout/1000} segundos...`);
      } else {
        toast.error(`${errorMsg} após ${MAX_RETRIES} tentativas.`);
      }
    } finally {
      if (finallyFn) finallyFn();
      else setLocalLoading(false);
    }
  };

  const createNotification = useCallback(async (
    notification: Omit<Notification, 'id' | 'createdAt' | 'read'>
  ) => {
    await withRetry(
      async () => await notificationService.createNotification(notification),
      "Notificação criada com sucesso",
      "Erro ao criar notificação"
    );
  }, [retryCount]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!notificationId) {
      console.error('ID de notificação não fornecido');
      toast.error('ID de notificação não fornecido');
      return;
    }
    
    await withRetry(
      async () => await notificationService.markAsRead(notificationId),
      "Notificação marcada como lida",
      "Erro ao marcar notificação como lida"
    );
  }, [retryCount]);

  const markAllAsRead = useCallback(async () => {
    if (!user?.uid) {
      console.error('Usuário não está logado');
      toast.error('Usuário não está logado');
      return;
    }
    
    await withRetry(
      async () => await notificationService.markAllAsRead(user.uid),
      "Todas as notificações marcadas como lidas",
      "Erro ao marcar todas notificações como lidas"
    );
  }, [user, retryCount]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!notificationId) {
      console.error('ID de notificação não fornecido');
      toast.error('ID de notificação não fornecido');
      return;
    }
    
    await withRetry(
      async () => await notificationService.deleteNotification(notificationId),
      "Notificação excluída com sucesso",
      "Erro ao excluir notificação"
    );
  }, [retryCount]);

  const clearAll = useCallback(async () => {
    if (!user?.uid) {
      console.error('Usuário não está logado');
      toast.error('Usuário não está logado');
      return;
    }
    
    await withRetry(
      async () => await notificationService.clearAll(user.uid),
      "Todas as notificações foram removidas",
      "Erro ao remover todas as notificações"
    );
  }, [user, retryCount]);

  return {
    notifications,
    loading,
    error,
    successMessage,
    createNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll
  };
}