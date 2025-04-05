import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Awareness } from 'y-protocols/awareness';
import type { Comment } from '../types/ticket';

// Contador de salas abertas para evitar múltiplas conexões simultâneas
const activeRoomCounter: Record<string, number> = {};

// Mapa de instâncias para evitar duplicação de provedores
const providerInstances: Record<string, YjsProvider> = {};

// Flag global para desativar WebRTC quando houver problemas críticos
let webrtcGloballyDisabled = false;

export class YjsProvider {
  private doc!: Y.Doc;
  private provider: WebrtcProvider | null = null;
  private persistence!: IndexeddbPersistence;
  private awareness!: Awareness;
  private commentsArray!: Y.Array<Comment>;
  private roomId!: string;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private retryCount = 0;
  private offlineMode = true; // Começar offline por padrão
  private cleanupFunctions: Array<() => void> = [];
  private providerInitialized = false;
  private documentDestroyed = false;
  private webrtcDisabled = false;
  private initializationError = false;
  
  constructor(roomId: string, userId: string, userName: string) {
    // Verificar se já existe uma instância para esta sala
    if (providerInstances[roomId]) {
      console.log(`[YJS] Reutilizando instância existente para sala ${roomId}`);
      return providerInstances[roomId];
    }

    this.roomId = roomId;
    this.webrtcDisabled = webrtcGloballyDisabled;
    
    // Incrementar contador para esta sala
    activeRoomCounter[roomId] = (activeRoomCounter[roomId] || 0) + 1;
    console.log(`[YJS] Iniciando provedor para sala ${roomId} (Total instâncias: ${activeRoomCounter[roomId]})`);
    
    try {
      // Usar um único documento para cada sala
      this.doc = new Y.Doc();
      
      // Inicializar array de comentários
      this.commentsArray = this.doc.getArray('comments');
      
      // Configurar persistência local (sempre funciona independente de WebRTC)
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
  
      // Registrar esta instância para reutilização
      providerInstances[roomId] = this;
  
      // Inicializar em modo online apenas se WebRTC não estiver desativado globalmente
      if (!this.webrtcDisabled) {
        setTimeout(() => {
          if (!this.documentDestroyed && !this.providerInitialized) {
            this.initializeProvider();
          }
        }, 500);
      } else {
        console.log(`[YJS] WebRTC desativado globalmente. Operando em modo offline para sala ${roomId}`);
      }
      
      // Debug: Monitorar mudanças no array de comentários
      const observeCallback = () => {
        console.log(`[YJS] Comments updated (${roomId}):`, this.commentsArray.toArray().map(c => 
          ({ id: c.id, content: c.content?.substring(0, 20) + '...' })));
      };
      this.commentsArray.observe(observeCallback);
      this.cleanupFunctions.push(() => {
        this.commentsArray.unobserve(observeCallback);
      });
      
      // Eventos de conexão com a internet
      const onlineHandler = () => {
        console.log('[YJS] Detecção de conexão online.');
        
        // Só tenta reconectar se WebRTC estiver ativo
        if (!this.webrtcDisabled && !this.documentDestroyed && !this.provider?.connected && !this.initializationError) {
          console.log('[YJS] Tentando reconectar após detecção de conexão com a internet...');
          this.retryCount = 0;
          
          // Inicializar provider se não estiver inicializado
          if (!this.providerInitialized) {
            this.initializeProvider();
          } else if (this.provider) {
            // Ou tentar reconectar o provider existente
            this.connect();
          }
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
      
      this.cleanupFunctions.push(() => {
        window.removeEventListener('online', onlineHandler);
        window.removeEventListener('offline', offlineHandler);
      });
      
    } catch (error) {
      console.error(`[YJS] Erro crítico na inicialização do YjsProvider (${roomId}):`, error);
      this.documentDestroyed = true;
      this.offlineMode = true;
      this.initializationError = true;
      
      // Remove da lista de instâncias para forçar recriação em tentativas futuras
      delete providerInstances[roomId];
    }
  }

  private initializeProvider() {
    if (this.providerInitialized || this.documentDestroyed || this.webrtcDisabled || this.initializationError) {
      console.log(`[YJS] Provider não será inicializado para sala ${this.roomId}:`);
      console.log(`- Já inicializado: ${this.providerInitialized}`);
      console.log(`- Documento destruído: ${this.documentDestroyed}`);
      console.log(`- WebRTC desativado: ${this.webrtcDisabled}`);
      console.log(`- Erro na inicialização: ${this.initializationError}`);
      return;
    }
    
    try {
      console.log(`[YJS] Inicializando WebRTC provider para sala ${this.roomId}`);
      
      // Configuração simplificada
      this.provider = new WebrtcProvider(this.roomId, this.doc, {
        signaling: [
          'wss://signaling.yjs.dev'
        ],
        awareness: this.awareness,
        maxConns: 10,
        filterBcConns: true
      });

      // Desativar logs do provider para reduzir ruído
      // @ts-ignore
      this.provider.logger?.disable?.();

      // Monitorar conexões
      const statusHandler = (event: any) => {
        const status = event?.status || (event?.connected ? 'connected' : 'disconnected');
        console.log(`[YJS] Connection status (${this.roomId}):`, status);
        
        if (status === 'connected') {
          this.offlineMode = false;
          this.retryCount = 0;
          
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }
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
      this.initializationError = true;
      
      // Desativar WebRTC para esta sala após erro crítico
      this.webrtcDisabled = true;
      
      // Para erros específicos relacionados ao disable, desativar globalmente
      if (error instanceof Error && 
          (error.message.includes('Cannot read properties of undefined') || 
           error.message.includes('disable'))) {
        console.error(`[YJS] Erro crítico de inicialização. Desativando WebRTC globalmente.`);
        webrtcGloballyDisabled = true;
        
        // Remover todas as instâncias ativas para forçar recriação em modo offline
        Object.keys(providerInstances).forEach(key => {
          const instance = providerInstances[key];
          if (instance.provider) {
            try {
              instance.provider.disconnect();
              instance.provider.destroy();
              instance.provider = null;
            } catch (e) {
              // Ignorar erros ao limpar
            }
          }
          instance.webrtcDisabled = true;
          instance.offlineMode = true;
        });
      }
    }
  }

  private connect() {
    if (!this.provider || this.documentDestroyed || this.webrtcDisabled) return;
    
    console.log(`[YJS] Iniciando conexão (${this.roomId})...`);
    try {
      this.provider.connect();
      
      // Timeout para verificar se a conexão foi estabelecida
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
      }
      
      this.connectionTimeout = setTimeout(() => {
        // Se após 5 segundos não conectou, assumir modo offline
        if (this.provider && !this.provider.connected) {
          console.log(`[YJS] Timeout de conexão (${this.roomId}). Entrando em modo offline.`);
          this.offlineMode = true;
        }
      }, 5000);
    } catch (error) {
      console.error(`[YJS] Erro de conexão (${this.roomId}):`, error);
      this.offlineMode = true;
    }
  }

  private disconnect() {
    if (!this.provider) return;
    
    console.log(`[YJS] Desconectando provedor para sala ${this.roomId}`);
    try {
      this.provider.disconnect();
    } catch (error) {
      console.error(`[YJS] Erro ao desconectar provedor (${this.roomId}):`, error);
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
      console.log(`[YJS] Provider já destruído (${this.roomId}), ignorando`);
      return;
    }
    
    console.log(`[YJS] Destruindo provedor (${this.roomId})...`);
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
        console.error('[YJS] Erro na função de limpeza:', e);
      }
    });
    
    // Destruir provider
    try {
      if (this.provider) {
        this.provider.destroy();
        this.provider = null;
      }
    } catch (e) {
      console.error(`[YJS] Erro ao destruir provider (${this.roomId}):`, e);
    }
    
    // Destruir persistence e doc
    try {
      this.persistence.destroy();
    } catch (e) {
      console.error(`[YJS] Erro ao destruir persistence (${this.roomId}):`, e);
    }
    
    try {
      this.doc.destroy();
    } catch (e) {
      console.error(`[YJS] Erro ao destruir doc (${this.roomId}):`, e);
    }
  }

  public getCommentsArray() {
    return this.commentsArray;
  }

  public observeComments(callback: (event: Y.YArrayEvent<any>) => void) {
    console.log(`[YJS] Adicionando observador de comentários (${this.roomId})`);
    this.commentsArray.observe(callback);
    return () => {
      if (this.documentDestroyed) return;
      console.log(`[YJS] Removendo observador de comentários (${this.roomId})`);
      this.commentsArray.unobserve(callback);
    };
  }

  public addComment(comment: Comment, persistToFirestore: boolean = true) {
    if (this.documentDestroyed) {
      console.warn(`[YJS] Tentativa de adicionar comentário em documento destruído (${this.roomId})`);
      return false;
    }
    
    try {
      console.log(`[YJS] Adicionando comentário à sala ${this.roomId}:`, comment);
      this.commentsArray.push([comment]);
      
      // Log para depuração: verificar se o comentário foi adicionado
      const comments = this.commentsArray.toArray();
      console.log(`[YJS] Comentários após adição (${this.roomId}, total: ${comments.length}):`, 
        comments.map(c => ({ id: c.id, content: c.content?.substring(0, 20) + '...' })));
      
      return true;
    } catch (error) {
      console.error(`[YJS] Erro ao adicionar comentário (${this.roomId}):`, error);
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
    // Simplified: consider connected when in offline mode (for local operations)
    // or when the WebRTC provider is actually connected
    return !this.documentDestroyed && (this.offlineMode || (this.provider?.connected === true));
  }

  public reconnect() {
    console.log(`[YJS] Reconexão manual solicitada (${this.roomId})`);
    
    if (this.documentDestroyed) {
      console.log(`[YJS] Não é possível reconectar - documento destruído (${this.roomId})`);
      return;
    }
    
    if (this.webrtcDisabled) {
      console.log(`[YJS] WebRTC desativado para esta sala. Operando apenas em modo offline.`);
      return;
    }
    
    if (this.initializationError) {
      console.log(`[YJS] Erro de inicialização anterior. Tentando reinicializar...`);
      this.initializationError = false;
    }
    
    this.disconnect();
    
    if (!this.providerInitialized) {
      this.initializeProvider();
    } else if (this.provider) {
      this.connect();
    }
  }

  // Método para forçar modo offline (útil para desenvolvimento)
  public forceOfflineMode() {
    console.log(`[YJS] Forçando modo offline para sala ${this.roomId}`);
    this.disconnect();
    this.offlineMode = true;
    this.webrtcDisabled = true;
  }
}