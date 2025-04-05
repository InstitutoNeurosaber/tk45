import { useEffect, useState, useCallback, useRef } from 'react';
import { YjsProvider } from '../lib/yjs';
import { useAuthStore } from '../stores/authStore';
import { useTicketStore } from '../stores/ticketStore';
import type { Comment } from '../types/ticket';
import { ticketService } from '../services/ticketService';

// Fila para comentários que falham ao serem enviados para armazenamento offline
let pendingCommentQueue: {ticketId: string, comment: Omit<Comment, 'id'>}[] = [];

export function useCollaborativeComments(ticketId: string) {
  const { user, userData } = useAuthStore();
  const { addComment: addTicketComment, getTicketById } = useTicketStore();
  const [provider, setProvider] = useState<YjsProvider | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const providerRef = useRef<YjsProvider | null>(null);
  const connectionCheckInterval = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const queueProcessorRef = useRef<NodeJS.Timeout>();
  const syncCompletedRef = useRef(false);
  const networkOnlineRef = useRef(navigator.onLine);

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

  // Verificar conexão com a internet de forma mais robusta
  useEffect(() => {
    const handleOnline = () => {
      console.log('[Comments] Conexão com a internet detectada.');
      networkOnlineRef.current = true;
      
      // Tentar reiniciar o provedor se estiver desconectado
      if (!isConnected && providerRef.current) {
        console.log('[Comments] Tentando reconectar após detecção de conexão com a internet...');
        reconnectAttempts.current = 0;
        providerRef.current.reconnect();
        
        // Agendar uma verificação do estado de conexão
        setTimeout(() => {
          if (providerRef.current && providerRef.current.isConnected()) {
            setIsConnected(true);
            setError(null);
          } else {
            setConnectionAttempts(prev => prev + 1);
          }
        }, 2000);
      }
      
      // Processar fila de comentários pendentes
      if (pendingCommentQueue.length > 0) {
        processCommentQueue();
      }
    };
    
    const handleOffline = () => {
      console.log('[Comments] Conexão com a internet perdida.');
      networkOnlineRef.current = false;
      setIsConnected(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Verificar conexão atual no momento do setup
    if (navigator.onLine && !isConnected && providerRef.current) {
      console.log('[Comments] Dispositivo online no setup, verificando conexão do provedor...');
      setTimeout(() => {
        if (providerRef.current && providerRef.current.isConnected()) {
          setIsConnected(true);
        }
      }, 1000);
    }
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isConnected, processCommentQueue]);

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
        console.log('[Comments] Initial comments from YJS:', initialComments);
        
        // Carregar comentários do Firestore e adicionar ao YJS se não existirem
        const loadFirestoreComments = async () => {
          try {
            console.log('[Comments] Loading ticket data from Firestore to sync comments');
            // Buscar o ticket com comentários do Firebase
            const ticketData = await getTicketById(ticketId);
            
            if (ticketData && ticketData.comments && ticketData.comments.length > 0) {
              console.log('[Comments] Found comments in Firestore:', ticketData.comments.length);
              
              // Para cada comentário no Firestore, checar se já existe no YJS
              const existingCommentIds = initialComments.map(c => c.id);
              let commentsAdded = 0;
              
              // Adicionar apenas comentários que não existem no YJS
              for (const comment of ticketData.comments) {
                if (!existingCommentIds.includes(comment.id)) {
                  console.log('[Comments] Adding Firestore comment to YJS:', comment.id);
                  yjsProvider.addComment(comment, false); // false indica para não propagar ao Firestore
                  commentsAdded++;
                }
              }
              
              if (commentsAdded > 0) {
                console.log(`[Comments] Added ${commentsAdded} comments from Firestore to YJS`);
                
                // Obter comentários atualizados
                const updatedComments = yjsProvider.getCommentsArray().toArray();
                setComments(updatedComments);
              }
            } else {
              console.log('[Comments] No comments found in Firestore or unable to load ticket data');
            }
            
            // Marcar como inicializado
            setIsInitialized(true);
            syncCompletedRef.current = true;
          } catch (error) {
            console.error('[Comments] Error loading Firestore comments:', error);
            setIsInitialized(true); // Marcar como inicializado mesmo com erro
            syncCompletedRef.current = true;
          }
        };
        
        // Chamar a função assíncrona
        loadFirestoreComments();

        // Definir comentários iniciais do YJS enquanto carrega do Firestore
        setComments(initialComments);

        // Observar mudanças nos comentários em tempo real
        const unobserveComments = yjsProvider.observeComments(() => {
          if (!yjsProvider) return;
          const newComments = yjsProvider.getCommentsArray().toArray();
          console.log('[Comments] Comments updated in YJS:', newComments);
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

        // Monitorar estado da conexão de forma mais agressiva
        const checkConnection = () => {
          if (!yjsProvider) return;
          
          const connected = yjsProvider.isConnected();
          console.log('[Comments] Connection status check:', connected);
          
          // Atualizar estado de conexão apenas se mudar para evitar renderizações desnecessárias
          if (connected !== isConnected) {
            console.log('[Comments] Connection status changed to:', connected);
            setIsConnected(connected);
          }

          // Se offline, verificar se temos uma conexão com a internet
          if (!connected && navigator.onLine && reconnectAttempts.current < maxReconnectAttempts) {
            console.log('[Comments] Dispositivo online mas provedor desconectado. Tentando reconectar...');
            reconnectAttempts.current++;
            yjsProvider.reconnect();
            setConnectionAttempts(prev => prev + 1);
          } else if (connected) {
            // Resetar contadores quando conectado
            reconnectAttempts.current = 0;
            setConnectionAttempts(0);
            setError(null);
          }
        };

        // Verificar conexão inicialmente e periodicamente (a cada 10 segundos)
        checkConnection();
        connectionCheckInterval.current = setInterval(checkConnection, 10000);

        setProvider(yjsProvider);
        
        // Verificar conexão após um curto delay para dar tempo ao provedor de se conectar
        setTimeout(() => {
          const connectionStatus = yjsProvider.isConnected();
          console.log('[Comments] Initial connection check result:', connectionStatus);
          setIsConnected(connectionStatus);
          if (!connectionStatus && navigator.onLine) {
            console.log('[Comments] Initial connection failed but device is online. Scheduling retry...');
            setTimeout(() => {
              if (yjsProvider && !yjsProvider.isConnected() && navigator.onLine) {
                console.log('[Comments] Automatic reconnection attempt...');
                yjsProvider.reconnect();
              }
            }, 2000);
          }
        }, 1500);

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
  }, [ticketId, user, userData, processCommentQueue, getTicketById, isConnected, connectionAttempts]);

  const addComment = useCallback(async (comment: Omit<Comment, 'id'>) => {
    const currentProvider = providerRef.current;

    if (!currentProvider) {
      console.error('[Comments] Provider not initialized');
      throw new Error('Chat não inicializado');
    }

    console.log('[Comments] Adicionando comentário:', comment);
    console.log('[Comments] Ticket ID para o comentário:', ticketId);
    console.log('[Comments] Estado da conexão:', isConnected, 'Internet:', navigator.onLine);

    try {
      const commentWithId: Comment = {
        ...comment,
        id: crypto.randomUUID()
      };

      console.log('[Comments] Adicionando comentário ao provedor YJS com ID:', commentWithId.id);
      const success = currentProvider.addComment(commentWithId, true); // true indica para propagar ao Firestore
      
      if (!success) {
        console.error('[Comments] Falha ao adicionar comentário ao provedor YJS');
        throw new Error('Falha ao adicionar comentário ao sistema colaborativo');
      }
      
      console.log('[Comments] Comentário adicionado com sucesso ao provedor YJS');

      // Sempre adicionar o comentário ao Firestore, independentemente do estado de conexão do YJS
      try {
        console.log('[Comments] Adicionando comentário ao ticket store para garantir persistência...');
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
        console.log('[Comments] Comentário adicionado com sucesso ao Firestore');
        
        // Se estávamos tentando reconectar, verificar se agora estamos conectados
        if (!isConnected && currentProvider) {
          const nowConnected = currentProvider.isConnected();
          if (nowConnected) {
            console.log('[Comments] Conexão restaurada durante adição de comentário');
            setIsConnected(true);
          }
        }
      } catch (firestoreError) {
        console.error('[Comments] Erro ao adicionar comentário ao Firestore:', firestoreError);
        
        // Adicionar à fila para tentativas posteriores apenas se falhar no Firestore
        // O comentário já foi adicionado no YJS local
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
        const newComment = await addTicketComment(ticketId, {
          content: comment.content,
          userId: comment.userId,
          userName: comment.userName
        });
        console.log('[Comments] Fallback bem-sucedido: comentário adicionado ao ticket store diretamente');
        
        return newComment;
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
  }, [ticketId, addTicketComment, isConnected]);

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

  // Função para forçar reconexão
  const forceReconnect = useCallback(() => {
    if (providerRef.current) {
      console.log('[Comments] Forçando reconexão manualmente...');
      reconnectAttempts.current = 0;
      providerRef.current.reconnect();
      setConnectionAttempts(prev => prev + 1);
      
      // Verificar se a conexão foi reestabelecida após um delay
      setTimeout(() => {
        if (providerRef.current && providerRef.current.isConnected()) {
          console.log('[Comments] Reconexão manual bem-sucedida');
          setIsConnected(true);
          setError(null);
        } else {
          console.log('[Comments] Reconexão manual falhou');
          // Tentar novamente com outro método se ainda estiver online
          if (navigator.onLine) {
            console.log('[Comments] Tentando método alternativo de reconexão...');
            // Aqui poderia implementar outras estratégias de reconexão
          }
        }
      }, 2000);
    }
  }, []);

  return {
    comments,
    activeUsers,
    typingUsers: Array.from(typingUsers),
    error,
    isConnected,
    isInitialized,
    isOnline: navigator.onLine,
    addComment,
    setTypingStatus,
    forceReconnect
  };
}