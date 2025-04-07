import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Awareness } from 'y-protocols/awareness';

// Contador de salas abertas para evitar múltiplas conexões simultâneas
const activeRoomCounter: Record<string, number> = {};

// Mapa de instâncias para evitar duplicação de provedores
const providerInstances: Record<string, YjsProvider> = {};

export class YjsProvider {
  private doc: Y.Doc;
  private provider: WebrtcProvider;
  private persistence: IndexeddbPersistence;
  private awareness: any;
  private roomId: string;
  private userId: string;
  private documentDestroyed: boolean = false;

  constructor(roomId: string, userId: string) {
    this.roomId = roomId;
    this.userId = userId;
    this.doc = new Y.Doc();
    
    // Configurar provedor WebRTC
    this.provider = new WebrtcProvider(`ticket-${roomId}`, this.doc, {
      signaling: ['wss://y-webrtc-signaling.herokuapp.com']
    });

    // Configurar persistência local
    this.persistence = new IndexeddbPersistence(`ticket-${roomId}`, this.doc);
    
    // Configurar awareness
    this.awareness = this.provider.awareness;
    this.awareness.setLocalStateField('user', { id: userId });
  }

  public observeConnectionStatus(callback: (status: 'connected' | 'disconnected') => void) {
    const handleConnectionChange = () => {
      const status = this.provider.connected ? 'connected' : 'disconnected';
      callback(status);
    };

    this.provider.on('status', handleConnectionChange);
    handleConnectionChange(); // Estado inicial

    return () => {
      this.provider.off('status', handleConnectionChange);
    };
  }

  public isConnected(): boolean {
    return this.provider.connected;
  }

  public reconnect(): void {
    if (!this.provider.connected) {
      this.provider.connect();
    }
  }

  public destroy(): void {
    this.documentDestroyed = true;
    this.provider.destroy();
    this.persistence.destroy();
    this.doc.destroy();
  }
}