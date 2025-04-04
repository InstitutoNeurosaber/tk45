import { useEffect, useState, useCallback, useRef } from 'react';
import { YjsProvider } from '../lib/yjs';
import { useAuthStore } from '../stores/authStore';
import { useTicketStore } from '../stores/ticketStore';
import type { Comment } from '../types/ticket';

// Fila para comentários que falham ao serem enviados para armazenamento offline
let pendingCommentQueue: {ticketId: string, comment: Omit<Comment, 'id'>}[] = [];

export function useCollaborativeComments(ticketId: string) {
  const { user, userData } = useAuthStore();
  const { addComment: addTicketComment } = useTicketStore();
  const [provider, setProvider] = useState<YjsProvider | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const providerRef = useRef<YjsProvider | null>(null);
  const connectionCheckInterval = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const queueProcessorRef = useRef<NodeJS.Timeout>();

  // Função para processar a fila de comentários pendentes
  const processCommentQueue = useCallback(() => {
    // Filtrar comentários para este ticket
    const ticketComments = pendingCommentQueue.filter(item => item.ticketId === ticketId);
    
    if (ticketComments.length > 0) {
      console.log(`[Comments] Tentando processar ${ticketComments.length} comentários pendentes`);
      
      // Processar cada comentário pendente
      for (const item of ticketComments) {
        addTicketComment(item.ticketId, {
          content: item.comment.content,
          userId: item.comment.userId,
          userName: item.comment.userName
        })
          .then(() => {
            console.log('[Comments] Comentário pendente enviado com sucesso');
            // Remover da fila global
            pendingCommentQueue = pendingCommentQueue.filter(
              queueItem => !(queueItem.ticketId === item.ticketId && 
                            queueItem.comment.content === item.comment.content)
            );
          })
          .catch(error => {
            console.error('[Comments] Falha ao enviar comentário pendente:', error);
          });
      }
    }
  }, [ticketId, addTicketComment]);

  useEffect(() => {
    // Configurar processamento periódico da fila
    queueProcessorRef.current = setInterval(() => {
      if (pendingCommentQueue.length > 0) {
        processCommentQueue();
      }
    }, 30000); // Tentar a cada 30 segundos
    
    return () => {
      if (queueProcessorRef.current) {
        clearInterval(queueProcessorRef.current);
      }
    };
  }, [processCommentQueue]);

  // Tentar processar a fila quando a conexão se restabelecer
  useEffect(() => {
    if (isConnected && pendingCommentQueue.length > 0) {
      processCommentQueue();
    }
  }, [isConnected, processCommentQueue]);

  useEffect(() => {
    if (!user || !userData || !ticketId) return;

    let providerInstance: YjsProvider | null = null;
    
    console.log('[Comments] Initializing collaborative system for ticket:', ticketId);

    const initializeProvider = () => {
      try {
        console.log('[Comments] Creating YJS provider...');
        const yjsProvider = new YjsProvider(
          `ticket-${ticketId}`,
          user.uid,
          userData.name
        );
        providerRef.current = yjsProvider;
        providerInstance = yjsProvider;

        // Carregar comentários iniciais
        const commentsArray = yjsProvider.getCommentsArray();
        const initialComments = commentsArray.toArray();
        console.log('[Comments] Initial comments:', initialComments);
        setComments(initialComments);

        // Observar mudanças nos comentários em tempo real
        const unobserveComments = yjsProvider.observeComments(() => {
          if (!yjsProvider) return;
          const newComments = yjsProvider.getCommentsArray().toArray();
          console.log('[Comments] Comments updated:', newComments);
          setComments(newComments);
        });

        // Observar usuários ativos
        const awareness = yjsProvider.getAwareness();
        const updateActiveUsers = () => {
          if (!yjsProvider) return;
          const users = yjsProvider.getActiveUsers();
          console.log('[Comments] Active users updated:', users);
          setActiveUsers(users);
          
          // Atualizar usuários digitando
          const typingSet = new Set<string>();
          Array.from(awareness.getStates().entries()).forEach(([clientId, state]) => {
            if (state.typing && state.user && state.user.id) {
              typingSet.add(state.user.id);
            }
          });
          setTypingUsers(typingSet);
        };

        awareness.on('change', updateActiveUsers);
        updateActiveUsers();

        // Monitorar estado da conexão
        const checkConnection = () => {
          if (!yjsProvider) return;
          const connected = yjsProvider.isConnected();
          console.log('[Comments] Connection status:', connected);
          setIsConnected(connected);

          if (!connected && reconnectAttempts.current < maxReconnectAttempts) {
            console.log('[Comments] Attempting to reconnect...');
            reconnectAttempts.current++;
            yjsProvider.reconnect();
          }
        };

        // Verificar conexão inicialmente e periodicamente (menos frequente)
        checkConnection();
        connectionCheckInterval.current = setInterval(checkConnection, 15000); // 15 segundos em vez de 5s

        setProvider(yjsProvider);
        setError(null);
        setIsConnected(true);

        // Processar a fila logo após a inicialização
        if (pendingCommentQueue.length > 0) {
          setTimeout(processCommentQueue, 2000);
        }

        return () => {
          console.log('[Comments] Cleaning up provider...');
          if (connectionCheckInterval.current) {
            clearInterval(connectionCheckInterval.current);
            connectionCheckInterval.current = undefined;
          }
          
          unobserveComments();
          awareness.off('change', updateActiveUsers);
        };
      } catch (error) {
        console.error('[Comments] Error initializing provider:', error);
        setError(error instanceof Error ? error.message : 'Erro ao conectar ao chat colaborativo');
        setIsConnected(false);
        
        return undefined;
      }
    };

    // Inicializar provedor
    const cleanup = initializeProvider();
    
    // Função de limpeza para o efeito
    return () => {
      console.log('[Comments] Cleaning up collaborative comments hook for ticket:', ticketId);
      
      // Limpar verificadores
      if (connectionCheckInterval.current) {
        clearInterval(connectionCheckInterval.current);
        connectionCheckInterval.current = undefined;
      }
      
      // Executar limpeza específica
      if (cleanup) {
        cleanup();
      }
      
      // Destruir provedor (importante para evitar conexões pendentes)
      if (providerRef.current) {
        console.log('[Comments] Destroying YJS provider');
        
        // Importante: não atribuir null ao providerRef.current antes de destruir
        const provider = providerRef.current;
        
        // Enfileirar a destruição para garantir que aconteça após esta função de efeito
        setTimeout(() => {
          try {
            provider.destroy();
          } catch (e) {
            console.error('[Comments] Error destroying provider:', e);
          }
        }, 0);
        
        // Agora sim podemos limpar a referência
        providerRef.current = null;
      }
    };
  }, [ticketId, user, userData, processCommentQueue]);

  const addComment = useCallback(async (comment: Omit<Comment, 'id'>) => {
    const currentProvider = providerRef.current;

    if (!currentProvider) {
      console.error('[Comments] Provider not initialized');
      throw new Error('Chat não inicializado');
    }

    console.log('[Comments] Adicionando comentário:', comment);
    console.log('[Comments] Ticket ID para o comentário:', ticketId);

    try {
      const commentWithId: Comment = {
        ...comment,
        id: crypto.randomUUID()
      };

      console.log('[Comments] Adicionando comentário ao provedor YJS com ID:', commentWithId.id);
      const success = currentProvider.addComment(commentWithId);
      
      if (!success) {
        console.error('[Comments] Falha ao adicionar comentário ao provedor YJS');
        throw new Error('Falha ao adicionar comentário ao sistema colaborativo');
      }
      
      console.log('[Comments] Comentário adicionado com sucesso ao provedor YJS');

      // Adicionar o comentário ao banco de dados para garantir que o webhook seja acionado
      try {
        console.log('[Comments] Adicionando comentário ao ticket store para acionar webhook...');
        console.log('[Comments] Dados para o ticketStore:', {
          ticketId,
          content: comment.content,
          userId: comment.userId,
          userName: comment.userName
        });
        
        await addTicketComment(ticketId, {
          content: comment.content,
          userId: comment.userId,
          userName: comment.userName
        });
        console.log('[Comments] Comentário adicionado com sucesso ao ticket store, webhook deveria ter sido acionado');
        
        // MÉTODO ALTERNATIVO: Tentar chamar o webhook diretamente como fallback
        console.log('[Comments] Tentando enviar webhook diretamente como método alternativo');
        try {
          // URL direta para webhook em produção
          const webhookUrl = 'https://webhook.sistemaneurosaber.com.br/webhook/comentario';
          
          console.log('[Comments] Usando URL de produção diretamente:', webhookUrl);
          
          const payload = {
            event: 'ticket.status_changed',
            data: {
              ticketId,
              status: 'commented',
              previousStatus: 'open',
              userId: comment.userId,
              userName: comment.userName,
              comment: {
                ...comment, 
                id: commentWithId.id,
                createdAt: new Date()
              }
            },
            timestamp: new Date().toISOString(),
            userId: comment.userId,
            userName: comment.userName
          };
          
          console.log('[Comments] Payload para webhook direto:', JSON.stringify(payload, null, 2));
          
          const webhookResponse = await fetch('https://tickets.sistemaneurosaber.com.br/.netlify/functions/webhook-proxy', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ...payload,
              targetUrl: webhookUrl
            })
          });
          
          console.log('[Comments] Status da resposta do webhook:', webhookResponse.status);
          
          if (webhookResponse.ok) {
            const responseData = await webhookResponse.json();
            console.log('[Comments] Webhook alternativo enviado com sucesso:', responseData);
          } else {
            const errorText = await webhookResponse.text();
            console.warn('[Comments] Webhook alternativo falhou:', webhookResponse.status, errorText);
          }
        } catch (directWebhookError) {
          console.error('[Comments] Erro ao tentar webhook direto:', directWebhookError);
        }
      } catch (webhookError) {
        console.error('[Comments] Erro ao adicionar comentário ao ticket store:', webhookError);
        
        // Adicionar à fila para tentativas posteriores
        pendingCommentQueue.push({
          ticketId,
          comment
        });
        
        console.log('[Comments] Comentário adicionado à fila pendente para processamento posterior');
      }

      console.log('[Comments] Processo de adição de comentário concluído com sucesso');
      return commentWithId;
    } catch (error) {
      console.error('[Comments] Erro ao adicionar comentário:', error);
      
      // Se falhar ao adicionar ao colaborativo, tenta adicionar diretamente ao banco
      try {
        console.log('[Comments] Fallback: tentando adicionar diretamente ao ticket store');
        await addTicketComment(ticketId, {
          content: comment.content,
          userId: comment.userId,
          userName: comment.userName
        });
        console.log('[Comments] Fallback bem-sucedido: comentário adicionado ao ticket store diretamente');
        
        return {
          ...comment,
          id: crypto.randomUUID()
        };
      } catch (fallbackError) {
        console.error('[Comments] Fallback falhou:', fallbackError);
        
        // Adicionar à fila para tentativas posteriores
        pendingCommentQueue.push({
          ticketId,
          comment
        });
        
        console.error('[Comments] Comentário adicionado à fila pendente após falha no fallback');
        throw new Error('Não foi possível salvar o comentário. Tentaremos novamente quando a conexão for restabelecida.');
      }
    }
  }, [ticketId, addTicketComment]);

  const setTypingStatus = useCallback((isTyping: boolean) => {
    const currentProvider = providerRef.current;
    if (!currentProvider || !user) return;

    try {
      const awareness = currentProvider.getAwareness();
      const currentState = awareness.getLocalState() || {};
      
      awareness.setLocalState({
        ...currentState,
        typing: isTyping
      });
      
      console.log('[Comments] Typing status updated:', isTyping);
    } catch (error) {
      console.error('[Comments] Error updating typing status:', error);
    }
  }, [user]);

  return {
    comments,
    activeUsers,
    typingUsers: Array.from(typingUsers),
    error,
    isConnected,
    addComment,
    setTypingStatus
  };
}