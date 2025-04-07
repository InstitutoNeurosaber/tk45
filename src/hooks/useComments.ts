import { useState, useEffect, useCallback } from 'react';
import { 
  doc, 
  onSnapshot, 
  updateDoc, 
  Timestamp, 
  DocumentSnapshot,
  arrayUnion,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  startAfter
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../stores/authStore';
import type { Comment, MessageType, MessageStatus } from '../types/ticket';

const MESSAGES_PER_PAGE = 50;
const MAX_MESSAGES_IN_DOCUMENT = 100;

export function useComments(ticketId: string) {
  const { user, userData } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastMessageTimestamp, setLastMessageTimestamp] = useState<Date | null>(null);

  // Carregar mensagens antigas
  const loadMoreMessages = useCallback(async () => {
    if (!hasMore || !ticketId) return;

    try {
      setLoading(true);
      const messagesRef = collection(db, 'tickets', ticketId, 'messages');
      const q = query(
        messagesRef,
        orderBy('createdAt', 'desc'),
        limit(MESSAGES_PER_PAGE),
        ...(lastMessageTimestamp ? [startAfter(lastMessageTimestamp)] : [])
      );

      const snapshot = await getDocs(q);
      const newMessages = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt.toDate()
      })) as Comment[];

      setComments(prev => [...prev, ...newMessages]);
      setHasMore(snapshot.docs.length === MESSAGES_PER_PAGE);
      
      if (snapshot.docs.length > 0) {
        setLastMessageTimestamp(snapshot.docs[snapshot.docs.length - 1].data().createdAt);
      }
    } catch (err) {
      console.error('[useComments] Erro ao carregar mais mensagens:', err);
      setError('Erro ao carregar mais mensagens');
    } finally {
      setLoading(false);
    }
  }, [ticketId, hasMore, lastMessageTimestamp]);

  // Observar novas mensagens
  useEffect(() => {
    if (!ticketId) return;
    
    console.log('[useComments] Iniciando observação do ticket:', ticketId);
    const ticketRef = doc(db, 'tickets', ticketId);
    setLoading(true);

    const unsubscribe = onSnapshot(ticketRef, 
      (snapshot: DocumentSnapshot) => {
        try {
          const data = snapshot.data();
          console.log('[useComments] Dados do ticket:', data);
          
          if (!data) {
            console.warn('[useComments] Ticket não encontrado');
            setComments([]);
            return;
          }

          const recentMessages = data.recentMessages || [];
          console.log('[useComments] Mensagens recentes:', recentMessages);

          const formattedMessages = recentMessages.map((message: any) => ({
            id: message.id,
            content: message.content,
            type: message.type || 'text',
            status: message.status || 'sent',
            userId: message.userId,
            userName: message.userName,
            ticketId: ticketId,
            createdAt: message.createdAt.toDate(),
            updatedAt: message.updatedAt?.toDate(),
            deletedAt: message.deletedAt?.toDate(),
            replyTo: message.replyTo,
            metadata: message.metadata
          }));

          console.log('[useComments] Mensagens formatadas:', formattedMessages);
          setComments(formattedMessages);
          setError(null);
        } catch (err) {
          console.error('[useComments] Erro ao carregar mensagens:', err);
          setError('Erro ao carregar mensagens');
        } finally {
          setLoading(false);
        }
      }
    );

    return () => {
      console.log('[useComments] Limpando subscription do ticket:', ticketId);
      unsubscribe();
    };
  }, [ticketId]);

  const addComment = useCallback(async (
    content: string, 
    type: MessageType = 'text',
    replyTo?: string,
    metadata?: Comment['metadata']
  ) => {
    if (!user || !userData) {
      throw new Error('Usuário não autenticado');
    }

    try {
      console.log('[useComments] Adicionando nova mensagem ao ticket:', ticketId);
      const ticketRef = doc(db, 'tickets', ticketId);
      const now = Timestamp.now();
      const messageId = crypto.randomUUID();

      const newMessage: Comment = {
        id: messageId,
        content,
        type,
        status: 'sending',
        userId: user.uid,
        userName: userData.name,
        ticketId,
        createdAt: now.toDate(),
        replyTo,
        metadata
      };

      console.log('[useComments] Nova mensagem:', newMessage);

      // Adicionar à lista de mensagens recentes
      await updateDoc(ticketRef, {
        recentMessages: arrayUnion({
          ...newMessage,
          createdAt: now,
          status: 'sent'
        }),
        updatedAt: now
      });

      // Se exceder o limite, mover mensagens antigas para subcoleção
      const currentMessages = comments.length;
      if (currentMessages > MAX_MESSAGES_IN_DOCUMENT) {
        const oldMessages = comments.slice(0, currentMessages - MAX_MESSAGES_IN_DOCUMENT);
        const messagesRef = collection(db, 'tickets', ticketId, 'messages');
        
        // TODO: Implementar batch write para mover mensagens antigas
        console.log('[useComments] Movendo mensagens antigas para subcoleção:', oldMessages.length);
      }
      
      console.log('[useComments] Mensagem adicionada com sucesso');
    } catch (err) {
      console.error('[useComments] Erro ao adicionar mensagem:', err);
      throw new Error('Erro ao enviar mensagem');
    }
  }, [ticketId, user, userData, comments]);

  return {
    comments,
    loading,
    error,
    addComment,
    loadMoreMessages,
    hasMore
  };
}