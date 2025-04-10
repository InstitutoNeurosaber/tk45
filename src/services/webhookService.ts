import { collection, query, where, getDocs, addDoc, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { WebhookConfig, WebhookEvent } from '../types/webhook';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { clickupStatusMap, clickupPriorityMap } from '../types/ticket';

// Configurar axios com retry e timeout mais longo
const axiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Configurar retry com backoff exponencial
axiosRetry(axiosInstance, { 
  retries: 3,
  retryDelay: (retryCount) => {
    return retryCount * 1000;
  },
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
           error.code === 'ECONNABORTED' ||
           (error.response?.status && error.response.status >= 500) || 
           false;
  },
  shouldResetTimeout: true
});

interface WebhookResponse {
  taskId?: string;
  gmailId?: string;
  status?: string;
  priority?: string;
}

interface WebhookPayload {
  event: WebhookEvent;
  data: unknown;
  timestamp: string;
  targetUrl?: string;
}

export const webhookService = {
  async getActiveWebhooks(event: WebhookEvent): Promise<WebhookConfig[]> {
    try {
      // Usar a coleção webhooks_config consistentemente
      const webhooksRef = collection(db, 'webhooks_config');
      const q = query(
        webhooksRef,
        where('active', '==', true),
        where('events', 'array-contains', event)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('Nenhum webhook ativo encontrado na coleção webhooks_config. Tentando coleção alternativa...');
        
        // Tentar a coleção original como fallback
        const alternativeRef = collection(db, 'webhooks');
        const alternativeQuery = query(
          alternativeRef,
          where('active', '==', true),
          where('events', 'array-contains', event)
        );
        
        const alternativeSnapshot = await getDocs(alternativeQuery);
        
        if (alternativeSnapshot.empty) {
          console.log('Nenhum webhook ativo encontrado em nenhuma coleção.');
          return [];
        }
        
        return alternativeSnapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
          updatedAt: doc.data().updatedAt.toDate()
        })) as WebhookConfig[];
      }
      
      return snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate()
      })) as WebhookConfig[];
    } catch (error) {
      console.error('Erro ao buscar webhooks:', error);
      return [];
    }
  },

  async sendWebhookNotification(event: WebhookEvent, data: unknown): Promise<WebhookResponse | undefined> {
    try {
      console.log('[WebhookService] ⚠️⚠️⚠️ INICIANDO sendWebhookNotification:', event);
      console.log('[WebhookService] Dados para envio:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
      
      // Temporariamente, apenas log para diagnosticar se este método está sendo chamado
      console.log('[WebhookService] ⚠️⚠️⚠️ MÉTODO SENDO EXECUTADO! ⚠️⚠️⚠️');
      console.log('[WebhookService] Dados do window.location:', {
        origin: window.location.origin,
        hostname: window.location.hostname,
        protocol: window.location.protocol,
        port: window.location.port,
        href: window.location.href
      });
      
      const webhooks = await this.getActiveWebhooks(event);
      
      console.log('[WebhookService] Webhooks ativos encontrados:', webhooks.length);

      if (webhooks.length === 0) {
        console.log('[WebhookService] ⚠️ Nenhum webhook ativo para o evento:', event);
        // Mostrar status do db para debugar
        try {
          const webhooksRef = collection(db, 'webhooks_config');
          const querySnapshot = await getDocs(webhooksRef);
          console.log(`[WebhookService] Total de configurações de webhook: ${querySnapshot.size}`);
          querySnapshot.forEach((doc: any) => {
            console.log(`[WebhookService] Webhook config: ${doc.id}`, doc.data());
          });
        } catch (dbError) {
          console.error('[WebhookService] Erro ao consultar webhooks no banco:', dbError);
        }
        return;
      }

      const baseUrl = window.location.origin;
      const ticketUrl = `${baseUrl}/tickets/${(data as any).id}`;

      // Buscar dados do criador do ticket
      const creatorData = await this.getTicketCreatorData((data as any).userId);

      // Preparar dados do webhook com tratamento seguro de datas
      const prepareWebhookData = () => {
        const deadlineDate = (data as any).deadline;
        let deadlineTimestamp: number | undefined;

        if (deadlineDate) {
          if (deadlineDate instanceof Date) {
            deadlineTimestamp = deadlineDate.getTime();
          } else if (typeof deadlineDate === 'string') {
            deadlineTimestamp = new Date(deadlineDate).getTime();
          }
        }

        const createdAtDate = (data as any).createdAt;
        const startDate = createdAtDate instanceof Date ? 
          createdAtDate.getTime() : 
          typeof createdAtDate === 'string' ? 
            new Date(createdAtDate).getTime() : 
            Date.now();

        // Limpar dados removendo campos undefined e funções
        const cleanData = JSON.parse(JSON.stringify({
          ...data,
          creator: creatorData,
          deadline: deadlineTimestamp ? {
            iso: new Date(deadlineTimestamp).toISOString(),
            timestamp: deadlineTimestamp
          } : undefined,
          url: ticketUrl,
          clickup: {
            status: (data as any).status ? clickupStatusMap[(data as any).status as keyof typeof clickupStatusMap] : undefined,
            priority: (data as any).priority ? clickupPriorityMap[(data as any).priority as keyof typeof clickupPriorityMap] : undefined,
            due_date: deadlineTimestamp,
            due_date_time: Boolean(deadlineTimestamp),
            time_estimate: 8640000,
            start_date: startDate,
            start_date_time: true,
            points: 3
          }
        }));

        return cleanData;
      };

      let webhookPayload: WebhookPayload = {
        event,
        data: prepareWebhookData(),
        timestamp: new Date().toISOString()
      };

      // Verificar se estamos em ambiente de desenvolvimento
      const isDevelopment = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1';
      
      console.log(`[Webhook] Ambiente de desenvolvimento: ${isDevelopment}; Origin: ${window.location.origin}`);

      // Enviar webhooks em paralelo
      const results = await Promise.allSettled(webhooks.map(async webhook => {
        try {
          // Usar sempre a URL principal do webhook
          let url = webhook.url;
          
          // Em ambiente de desenvolvimento, usar o proxy reverso
          if (isDevelopment) {
            // Se o webhook é para o endpoint do Neurosaber
            if (url.includes('sistemaneurosaber.com.br') || url.includes('api.neurosaber.com.br')) {
              // Usar o proxy em produção
              url = 'https://tickets.sistemaneurosaber.com.br/.netlify/functions/webhook-proxy';
              console.log(`[Webhook] Redirecionando requisição para proxy em produção: ${url}`);
              
              // Criar um novo payload com a URL original
              webhookPayload = {
                ...webhookPayload,
                targetUrl: webhook.url
              };
            }
          }
          
          // Adicionar headers necessários
          const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(webhook.headers || {})
          };

          console.log(`[Webhook] Enviando para ${url}:`, JSON.stringify(webhookPayload, null, 2));

          // Fazer a requisição POST
          const response = await axiosInstance({
            method: 'POST',
            url,
            headers,
            data: webhookPayload,
            validateStatus: (status) => {
              return status >= 200 && status < 300;
            }
          });

          console.log(`[Webhook] Enviado com sucesso para ${url}`, response.data);

          // Extrair dados da resposta
          const webhookResponse: WebhookResponse = {};
          
          // Extrair taskId
          if (response.data?.id) {
            webhookResponse.taskId = response.data.id;
          } else if (response.data?.taskId) {
            webhookResponse.taskId = response.data.taskId;
          } else if (response.data?.task?.id) {
            webhookResponse.taskId = response.data.task.id;
          } 

          // Se a URL contém clickup, priorizar o ID da tarefa do ClickUp
          // e ignorar gmailId
          if (webhook.url.toLowerCase().includes('clickup')) {
            // Formatos adicionais para extrair o ID do ClickUp
            if (response.data?.data?.id) {
              webhookResponse.taskId = response.data.data.id;
            }
            // Não extrair gmailId para webhooks do ClickUp
          } else {
            // Extrair gmailId para outros webhooks
            if (response.data?.gmailId) {
              webhookResponse.gmailId = response.data.gmailId;
            } else if (response.data?.gmail?.id) {
              webhookResponse.gmailId = response.data.gmail.id;
            } else if (response.data?.messageId) {
              webhookResponse.gmailId = response.data.messageId;
            }
          }

          // Extrair status e prioridade
          if (response.data?.status) {
            webhookResponse.status = response.data.status;
          }
          if (response.data?.priority) {
            webhookResponse.priority = response.data.priority;
          }

          return {
            success: true,
            url: webhook.url,
            response: webhookResponse
          } as const;
        } catch (error) {
          console.error(`[Webhook] Erro ao enviar webhook para ${webhook.url}:`, error);
          
          if (axios.isAxiosError(error)) {
            console.error('Detalhes do erro:', {
              status: error.response?.status,
              data: error.response?.data,
              headers: error.response?.headers,
              config: error.config
            });
          }

          // Adicionar à fila em caso de erro
          try {
            const queueRef = collection(db, 'webhook_queue');
            await addDoc(queueRef, {
              webhook: {
                id: webhook.id,
                url: webhook.url,
                headers: webhook.headers || {}
              },
              event,
              data: webhookPayload,
              status: 'pending',
              attempts: 0,
              maxAttempts: 3,
              createdAt: Timestamp.now(),
              nextAttempt: Timestamp.now(),
              error: error instanceof Error ? error.message : 'Erro desconhecido'
            });
            console.log(`Webhook adicionado à fila para retry: ${webhook.url}`);
          } catch (queueError) {
            console.error('Erro ao adicionar webhook à fila:', queueError);
          }
          
          return {
            success: false,
            url: webhook.url,
            error
          } as const;
        }
      }));

      // Filtrar resultados bem-sucedidos
      const successfulResults = results.filter(
        (result): result is PromiseFulfilledResult<{ success: true; url: string; response: WebhookResponse }> => 
          result.status === 'fulfilled' && result.value.success
      );

      // Se houver pelo menos um resultado bem-sucedido, retornar a primeira resposta
      if (successfulResults.length > 0) {
        return successfulResults[0].value.response;
      }

      // Se não houver resultados bem-sucedidos, logar os erros
      const errors = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map(result => result.reason);

      if (errors.length > 0) {
        console.error('[WebhookService] Erros ao enviar webhooks:', errors);
      }

      return undefined;

    } catch (error) {
      console.error('[Webhook] Erro ao enviar webhooks:', error);
      return undefined;
    }
  },

  async getTicketCreatorData(userId: string) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          id: userId,
          name: userData.name,
          email: userData.email,
          role: userData.role
        };
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar dados do criador:', error);
      return null;
    }
  }
};