import { create } from 'zustand';
import { 
  collection, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc, 
  getDocs,
  query,
  where,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from './authStore';
import type { WebhookConfig, WebhookEvent, WebhookPayload } from '../types/webhook';

interface WebhookState {
  webhooks: WebhookConfig[];
  loading: boolean;
  error: string | null;
  fetchWebhooks: (userId: string) => Promise<void>;
  createWebhook: (webhook: Omit<WebhookConfig, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateWebhook: (id: string, data: Partial<WebhookConfig>) => Promise<void>;
  deleteWebhook: (id: string) => Promise<void>;
  sendWebhookNotification: (event: WebhookEvent, data: unknown) => Promise<void>;
  testWebhook: (webhookId: string, payload: WebhookPayload) => Promise<void>;
}

export const useWebhookStore = create<WebhookState>()(
  (set, get) => ({
    webhooks: [],
    loading: false,
    error: null,
    
    fetchWebhooks: async (userId: string) => {
      set({ loading: true, error: null });
      
      try {
        console.log('[WebhookStore] Buscando webhooks para userId:', userId);
        
        // Criar webhooks de teste se não existirem
        await criarWebhooksTesteSeNecessario(userId);

        // Buscar todos os webhooks do usuário
        const colQuery = query(
          collection(db, 'webhooks_config'),
          where('userId', '==', userId),
          orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(colQuery);
        
        if (snapshot.empty) {
          console.log('[WebhookStore] Nenhum webhook encontrado para o usuário');
          set({ webhooks: [], loading: false });
          return;
        }
        
        const webhooks = snapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate()
        })) as WebhookConfig[];
        
        console.log('[WebhookStore] Webhooks encontrados:', webhooks.length);
        set({ webhooks, loading: false });
        
      } catch (error) {
        console.error('[WebhookStore] Erro ao buscar webhooks:', error);
        set({ error: 'Erro ao buscar webhooks', loading: false });
      }
    },

    createWebhook: async (webhookData) => {
      try {
        set({ loading: true, error: null });
        const now = Timestamp.now();
        
        // Garantir que o userId está tanto no objeto principal quanto no headers
        const dataWithUserIdInHeaders = {
          ...webhookData,
          headers: {
            ...(webhookData.headers || {}),
            userId: webhookData.userId  // Adiciona userId ao headers
          }
        };
        
        console.log('Criando webhook com dados:', JSON.stringify(dataWithUserIdInHeaders));
        
        const webhooksRef = collection(db, 'webhooks_config');
        const docRef = await addDoc(webhooksRef, {
          ...dataWithUserIdInHeaders,
          createdAt: now,
          updatedAt: now
        });

        const newWebhook: WebhookConfig = {
          id: docRef.id,
          ...dataWithUserIdInHeaders,
          createdAt: now.toDate(),
          updatedAt: now.toDate()
        };

        set(state => ({
          webhooks: [newWebhook, ...state.webhooks],
          loading: false
        }));

        // Também vamos salvar na coleção webhooks para garantir compatibilidade
        try {
          const webhooksRef = collection(db, 'webhooks');
          await addDoc(webhooksRef, {
            id: docRef.id,
            active: dataWithUserIdInHeaders.active,
            createdAt: now,
            updatedAt: now,
            events: dataWithUserIdInHeaders.events,
            headers: {
              name: dataWithUserIdInHeaders.name,
              url: dataWithUserIdInHeaders.url,
              testUrl: dataWithUserIdInHeaders.testUrl,
              userId: dataWithUserIdInHeaders.userId
            }
          });
          console.log('Webhook também salvo na coleção webhooks');
        } catch (error) {
          console.error('Erro ao salvar webhook na coleção webhooks:', error);
        }
      } catch (error) {
        console.error('Erro ao criar webhook:', error);
        set({ error: error instanceof Error ? error.message : 'Erro ao criar webhook', loading: false });
        throw error;
      }
    },

    updateWebhook: async (id: string, data: Partial<WebhookConfig>) => {
      try {
        set({ loading: true, error: null });
        const webhookRef = doc(db, 'webhooks_config', id);
        
        await updateDoc(webhookRef, {
          ...data,
          updatedAt: Timestamp.now()
        });

        set(state => ({
          webhooks: state.webhooks.map(webhook =>
            webhook.id === id
              ? { ...webhook, ...data, updatedAt: new Date() }
              : webhook
          ),
          loading: false
        }));
      } catch (error) {
        console.error('Erro ao atualizar webhook:', error);
        set({ error: error instanceof Error ? error.message : 'Erro ao atualizar webhook', loading: false });
        throw error;
      }
    },

    deleteWebhook: async (id: string) => {
      try {
        set({ loading: true, error: null });
        
        // Deletar da coleção principal
        await deleteDoc(doc(db, 'webhooks_config', id));
        
        // Tentar deletar da coleção antiga também
        try {
          const oldWebhooksQuery = query(
            collection(db, 'webhooks'),
            where('id', '==', id)
          );
          const snapshot = await getDocs(oldWebhooksQuery);
          
          for (const doc of snapshot.docs) {
            await deleteDoc(doc.ref);
          }
        } catch (oldWebhookError) {
          console.warn('Erro ao tentar deletar webhook da coleção antiga:', oldWebhookError);
        }
        
        set(state => ({
          webhooks: state.webhooks.filter(webhook => webhook.id !== id),
          loading: false
        }));
      } catch (error) {
        console.error('Erro ao deletar webhook:', error);
        set({ error: error instanceof Error ? error.message : 'Erro ao deletar webhook', loading: false });
        throw error;
      }
    },

    testWebhook: async (webhookId: string, payload: WebhookPayload) => {
      try {
        const webhook = get().webhooks.find(w => w.id === webhookId);
        if (!webhook) {
          throw new Error('Webhook não encontrado');
        }

        const url = webhook.testUrl || webhook.url;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(webhook.headers || {})
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error ${response.status}: ${errorText}`);
        }

        return response.json();
      } catch (error) {
        console.error('Erro ao testar webhook:', error);
        throw error;
      }
    },

    sendWebhookNotification: async (event: WebhookEvent, data: unknown) => {
      const { webhooks } = get();
      const activeWebhooks = webhooks.filter(webhook => 
        webhook.active && webhook.events.includes(event)
      );

      if (activeWebhooks.length === 0) {
        return;
      }

      const payload: WebhookPayload = {
        event,
        data,
        timestamp: new Date().toISOString(),
        user: {
          id: 'system',
          email: 'system@example.com',
          name: 'Sistema'
        }
      };

      const results = await Promise.allSettled(
        activeWebhooks.map(async webhook => {
          try {
            const url = (data as any).isTest && webhook.testUrl ? webhook.testUrl : webhook.url;
            
            // Log para debug - verificar URL do webhook
            console.log(`[WebhookStore] Enviando webhook para: ${url}`);
            console.log(`[WebhookStore] Chamando: ${url} para evento ${event}`);
            
            // Verificar e corrigir a URL se necessário (somente para domínios relacionados)
            let correctedUrl = url;
            if (url.includes('webhook.sistemaneurousaber.com.br')) {
              correctedUrl = url.replace(
                'webhook.sistemaneurousaber.com.br', 
                'webhook.sistemaneurosaber.com.br'
              );
              console.log(`[WebhookStore] Corrigindo URL do webhook para: ${correctedUrl}`);
            }
            
            // Verificar o caminho - se for /webhooks/ (plural) mudar para /webhook/ (singular)
            if (correctedUrl.includes('/webhooks/')) {
              correctedUrl = correctedUrl.replace('/webhooks/', '/webhook/');
              console.log(`[WebhookStore] Corrigindo caminho do webhook: mudando para singular`);
            }
            
            // Agora usamos a URL corrigida
            const response = await fetch(correctedUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(webhook.headers || {})
              },
              body: JSON.stringify(payload)
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`HTTP error ${response.status}: ${errorText}`);
            }

            return {
              webhookId: webhook.id,
              success: true
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to send webhook to ${webhook.url}: ${errorMessage}`);
          }
        })
      );

      const errors = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map(result => result.reason.message);

      if (errors.length > 0) {
        throw new Error(errors.join('\n'));
      }
    }
  })
);

// Função para criar webhooks de teste se não existirem
async function criarWebhooksTesteSeNecessario(userId: string) {
  try {
    console.log('[WebhookStore] Verificando e criando webhooks de teste para:', userId);
    
    // Verificar se já existe um webhook de comentário
    const colQuery = query(
      collection(db, 'webhooks_config'),
      where('userId', '==', userId),
      where('events', 'array-contains', 'ticket.status_changed')
    );
    
    const snapshot = await getDocs(colQuery);
    
    if (snapshot.empty) {
      console.log('[WebhookStore] Nenhum webhook encontrado, criando webhook de teste...');
      
      // Criar webhook de teste para comentários
      const webhookData = {
        name: 'Webhook de Teste para Comentários',
        url: 'https://api.neurosaber.com.br/webhook/comentario',
        events: ['ticket.created', 'ticket.updated', 'ticket.deleted', 'ticket.status_changed'],
        active: true,
        userId,
        headers: {
          'X-From-Testing': 'true'
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        description: 'Webhook de teste criado automaticamente'
      };
      
      // Adicionar apenas na nova coleção
      const docRef = await addDoc(collection(db, 'webhooks_config'), webhookData);
      console.log('[WebhookStore] Webhook de teste criado:', docRef.id);
      return true;
    } else {
      console.log('[WebhookStore] Já existem webhooks configurados:', snapshot.size);
      return false;
    }
  } catch (error) {
    console.error('[WebhookStore] Erro ao criar webhooks de teste:', error);
    return false;
  }
}