import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Awareness } from 'y-protocols/awareness';
import type { Comment } from '../types/ticket';

// Contador de salas abertas para evitar múltiplas conexões simultâneas
const activeRoomCounter: Record<string, number> = {};

// Mapa de instâncias para evitar duplicação de provedores
const providerInstances: Record<string, YjsProvider> = {};

export class YjsProvider {
  private doc!: Y.Doc;
  private provider: WebrtcProvider | null = null;
  private persistence!: IndexeddbPersistence;
  private awareness!: Awareness;
  private commentsArray!: Y.Array<Comment>;
  private roomId!: string;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private maxRetries = 2; // Reduzido para evitar muitas tentativas 
  private retryCount = 0;
  private retryDelay = 3000;
  private offlineMode = false;
  private cleanupFunctions: Array<() => void> = [];
  private providerInitialized = false;
  private documentDestroyed = false;
  private reconnectAttempted = false;

  constructor(roomId: string, userId: string, userName: string) {
    // Verificar se já existe uma instância para esta sala
    if (providerInstances[roomId]) {
      console.log(`[YJS] Reutilizando instância existente para sala ${roomId}`);
      const instance = providerInstances[roomId];
      
      // Copiar todas as propriedades necessárias da instância existente
      Object.getOwnPropertyNames(instance).forEach(prop => {
        if (prop !== 'constructor' && typeof prop === 'string') {
          // @ts-ignore
          this[prop] = instance[prop];
        }
      });
      
      return instance;
    }

    this.roomId = roomId;
    
    // Incrementar contador para esta sala
    activeRoomCounter[roomId] = (activeRoomCounter[roomId] || 0) + 1;
    console.log(`[YJS] Iniciando provedor para sala ${roomId} (Total instâncias: ${activeRoomCounter[roomId]})`);
    
    try {
      // Usar um único documento para cada sala
      this.doc = new Y.Doc();
      
      // Inicializar array de comentários
      this.commentsArray = this.doc.getArray('comments');
      
      // Configurar persistência local
      this.persistence = new IndexeddbPersistence(roomId, this.doc);
      this.persistence.on('synced', () => {
        console.log(`[YJS] Dados locais sincronizados (${roomId})`);
      });
      
      // Criação do awareness primeiro
      this.awareness = new Awareness(this.doc);
      
      // Configurar informações do usuário
      this.awareness.setLocalStateField('user', {
        name: userName,
        id: userId,
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`
      });
  
      // Registrar esta instância para reutilização ANTES de iniciar o provider
      providerInstances[roomId] = this;
  
      // Inicialização atrasada do provider para evitar conexões desnecessárias
      setTimeout(() => {
        if (!this.providerInitialized && !this.documentDestroyed) {
          this.initializeProvider();
        }
      }, 500);
    } catch (error) {
      console.error(`[YJS] Erro crítico na inicialização do YjsProvider (${roomId}):`, error);
      this.documentDestroyed = true; // Marcar como destruído para evitar tentativas futuras
      this.offlineMode = true;
      return;
    }
    
    // Verificar quando a conexão com a internet está disponível
    const onlineHandler = () => {
      console.log('[YJS] Detecção de conexão online. Reconectando...');
      this.offlineMode = false;
      
      // Só tenta reconectar se não estiver já conectado
      if (!this.provider?.connected && !this.reconnectAttempted && !this.documentDestroyed) {
        this.reconnectAttempted = true;
        this.retryCount = 0;
        
        setTimeout(() => {
          this.reconnectAttempted = false; // Reset do flag após a tentativa
          if (!this.documentDestroyed && !this.provider?.connected) {
            this.initializeProvider();
          }
        }, 1000);
      }
    };
    
    const offlineHandler = () => {
      console.log('[YJS] Detecção de conexão offline. Operando apenas localmente.');
      this.offlineMode = true;
      // Desconectar para evitar tentativas de reconexão
      this.disconnect();
    };
    
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    
    // Adicionar para limpeza posterior
    this.cleanupFunctions.push(() => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    });
    
    // Debug: Monitorar mudanças no array de comentários
    const observeCallback = () => {
      console.log(`[YJS] Comments updated (${roomId}):`, this.commentsArray.toArray());
    };
    this.commentsArray.observe(observeCallback);
    this.cleanupFunctions.push(() => {
      this.commentsArray.unobserve(observeCallback);
    });
  }

  private initializeProvider() {
    if (this.providerInitialized || this.documentDestroyed) {
      console.log(`[YJS] Provider já inicializado ou documento destruído (${this.roomId}), ignorando.`);
      return;
    }
    
    try {
      console.log(`[YJS] Inicializando WebRTC provider para sala ${this.roomId}`);
      
      // Configuração aprimorada para lidar com ambientes corporativos 
      this.provider = new WebrtcProvider(this.roomId, this.doc, {
        signaling: [
          'wss://signaling.yjs.dev'
        ],
        awareness: this.awareness,
        maxConns: 10, // Limitado para reduzir carga
        filterBcConns: true,
        peerOpts: {
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' }
            ]
          }
        }
      });

      // Desativar logs do provider para reduzir ruído
      // @ts-ignore
      this.provider.logger.disable();

      // Monitorar conexões
      const statusHandler = (event: any) => {
        const status = event?.status || (event?.connected ? 'connected' : 'disconnected');
        console.log(`[YJS] Connection status (${this.roomId}):`, status);
        
        if (status === 'connected') {
          this.retryCount = 0;
          this.offlineMode = false;
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }
        } else if (status === 'disconnected' && !this.documentDestroyed && this.retryCount < this.maxRetries) {
          // Só tentar reconectar se não excedeu o máximo de tentativas
          this.disconnect(); // Desconectar completamente antes de tentar reconectar
          this.tryReconnect();
        }
      };

      this.provider.on('status', statusHandler);
      this.cleanupFunctions.push(() => {
        this.provider?.off('status', statusHandler);
      });
      
      this.providerInitialized = true;
      
      // Iniciar conexão com timeout
      this.connect();
    } catch (error) {
      console.error(`[YJS] Error initializing provider (${this.roomId}):`, error);
      this.offlineMode = true;
      this.retryCount = this.maxRetries; // Impedir novas tentativas após erro crítico
    }
  }

  private connect() {
    if (!this.provider || this.documentDestroyed) return;
    
    console.log(`[YJS] Initiating connection (${this.roomId})...`);
    try {
      this.provider.connect();
      
      // Definir timeout para verificar se a conexão foi estabelecida
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
      }
      
      this.connectionTimeout = setTimeout(() => {
        if (this.provider && !this.provider.connected && !this.documentDestroyed && this.retryCount < this.maxRetries) {
          console.log(`[YJS] Connection timeout (${this.roomId})`);
          this.disconnect();
          this.tryReconnect();
        } else if (this.retryCount >= this.maxRetries) {
          console.log(`[YJS] Max retries reached (${this.roomId}). Staying in offline mode.`);
          this.offlineMode = true;
        }
      }, 5000);
    } catch (error) {
      console.error(`[YJS] Connection error (${this.roomId}):`, error);
      if (this.retryCount < this.maxRetries) {
        this.tryReconnect();
      } else {
        this.offlineMode = true;
      }
    }
  }

  private tryReconnect() {
    if (this.documentDestroyed) return;
    
    if (this.retryCount >= this.maxRetries) {
      console.log(`[YJS] Max retries reached (${this.roomId}). Switching to offline mode.`);
      this.offlineMode = true;
      return;
    }

    this.retryCount++;
    const delay = this.retryDelay * Math.pow(1.5, this.retryCount - 1);
    
    console.log(`[YJS] Attempting reconnect ${this.retryCount}/${this.maxRetries} in ${delay}ms (${this.roomId})`);
    
    setTimeout(() => {
      if (!this.documentDestroyed && !this.provider?.connected && this.retryCount <= this.maxRetries) {
        this.connect();
      } else if (this.retryCount > this.maxRetries) {
        console.log(`[YJS] No more reconnect attempts for (${this.roomId}). Staying in offline mode.`);
        this.offlineMode = true;
      }
    }, delay);
  }

  private disconnect() {
    if (!this.provider) return;
    
    console.log(`[YJS] Disconnecting provider for room ${this.roomId}`);
    try {
      this.provider.disconnect();
    } catch (error) {
      console.error(`[YJS] Error disconnecting provider (${this.roomId}):`, error);
    }
  }

  public getDoc() {
    return this.doc;
  }

  public getAwareness() {
    return this.awareness;
  }

  public destroy() {
    if (this.documentDestroyed) {
      console.log(`[YJS] Provider already destroyed (${this.roomId}), skipping`);
      return;
    }
    
    console.log(`[YJS] Destroying provider (${this.roomId})...`);
    this.documentDestroyed = true;
    
    // Remover este provedor da lista de instâncias
    if (providerInstances[this.roomId] === this) {
      delete providerInstances[this.roomId];
    }
    
    // Decrementar contador
    if (activeRoomCounter[this.roomId]) {
      activeRoomCounter[this.roomId]--;
      console.log(`[YJS] Removendo instância para sala ${this.roomId} (Restando: ${activeRoomCounter[this.roomId]})`);
      
      if (activeRoomCounter[this.roomId] <= 0) {
        delete activeRoomCounter[this.roomId];
      }
    }
    
    // Limpar timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    // Desconectar explicitamente antes de destruir
    this.disconnect();
    
    // Executar todas as funções de limpeza
    this.cleanupFunctions.forEach(cleanup => {
      try {
        cleanup();
      } catch (e) {
        console.error('[YJS] Error in cleanup function:', e);
      }
    });
    
    // Destruir provider
    try {
      if (this.provider) {
        this.provider.destroy();
        this.provider = null;
      }
    } catch (e) {
      console.error(`[YJS] Error destroying provider (${this.roomId}):`, e);
    }
    
    // Destruir persistence e doc
    try {
      this.persistence.destroy();
    } catch (e) {
      console.error(`[YJS] Error destroying persistence (${this.roomId}):`, e);
    }
    
    try {
      this.doc.destroy();
    } catch (e) {
      console.error(`[YJS] Error destroying doc (${this.roomId}):`, e);
    }
  }

  public getCommentsArray() {
    return this.commentsArray;
  }

  public observeComments(callback: (event: Y.YArrayEvent<any>) => void) {
    console.log(`[YJS] Adding comments observer (${this.roomId})`);
    this.commentsArray.observe(callback);
    return () => {
      if (this.documentDestroyed) return;
      console.log(`[YJS] Removing comments observer (${this.roomId})`);
      this.commentsArray.unobserve(callback);
    };
  }

  public addComment(comment: Comment, persistToFirestore: boolean = true) {
    if (this.documentDestroyed) {
      console.warn(`[YJS] Tentativa de adicionar comentário em documento destruído (${this.roomId})`);
      return false;
    }
    
    try {
      console.log(`[YJS] Adding comment to room ${this.roomId}:`, comment);
      this.commentsArray.push([comment]);
      
      // Log para depuração: verificar se o comentário foi adicionado
      const comments = this.commentsArray.toArray();
      console.log(`[YJS] Comments after adding (${this.roomId}, total: ${comments.length}):`, 
        comments.map(c => ({ id: c.id, content: c.content?.substring(0, 20) + '...' })));
      
      return true;
    } catch (error) {
      console.error(`[YJS] Error adding comment (${this.roomId}):`, error);
      return false;
    }
  }

  public getActiveUsers() {
    const states = this.awareness.getStates();
    return Array.from(states.entries())
      .map(([clientId, state]) => ({
        clientId,
        user: state.user
      }))
      .filter(({ user }) => user);
  }

  public isConnected() {
    // Consideramos "conectado" mesmo no modo offline
    // para permitir operações locais
    return (this.provider?.connected || this.offlineMode) && !this.documentDestroyed;
  }

  public reconnect() {
    console.log(`[YJS] Manual reconnect requested (${this.roomId})`);
    if (this.documentDestroyed) {
      console.log(`[YJS] Cannot reconnect - document destroyed (${this.roomId})`);
      return;
    }
    
    // Evitar múltiplas reconexões em sequência
    if (this.reconnectAttempted) {
      console.log(`[YJS] Reconnect already in progress (${this.roomId}), skipping`);
      return;
    }
    
    this.reconnectAttempted = true;
    
    // Se excedeu tentativas, não permitir mais tentativas manuais
    if (this.retryCount >= this.maxRetries) {
      console.log(`[YJS] Max retry attempts reached (${this.roomId}). Staying in offline mode.`);
      this.offlineMode = true;
      this.reconnectAttempted = false;
      return;
    }
    
    this.retryCount = 0;
    this.offlineMode = false;
    
    this.disconnect();
    
    try {
      // Reinicializar provider se necessário
      if (!this.providerInitialized) {
        this.initializeProvider();
      } else {
        this.connect();
      }
    } catch (error) {
      console.error(`[YJS] Error during manual reconnect (${this.roomId}):`, error);
      this.offlineMode = true;
      this.retryCount = this.maxRetries; // Impedir novas tentativas após erro crítico
    }
    
    // Reset flag após um tempo
    setTimeout(() => {
      this.reconnectAttempted = false;
    }, 5000);
  }
}