import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  doc, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  Timestamp, 
  updateDoc,
  getDoc,
  deleteDoc,
  DocumentData,
  QueryDocumentSnapshot,
  QuerySnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuthStore } from '../stores/authStore';
import { v4 as uuidv4 } from 'uuid';
import { clickupService } from '../services/clickupService';
import { getAuth } from 'firebase/auth';

// Interfaces para usar no hook
interface Comment {
  id: string;
  ticketId: string;
  content: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  createdAt: Date;
  attachments?: CommentAttachment[];
}

interface CommentAttachment {
  id: string;
  url: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: Date;
}

export function useComments(ticketId: string) {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar comentários em tempo real
  useEffect(() => {
    if (!ticketId) {
      setLoading(false);
      setError('ID do ticket não fornecido');
      return;
    }

    if (!user) {
      setLoading(false);
      setError('É necessário estar autenticado para visualizar comentários');
      return;
    }

    setLoading(true);
    setError(null);

    const commentsRef = collection(db, 'tickets', ticketId, 'comments');
    const commentsQuery = query(commentsRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      commentsQuery,
      (snapshot: any) => {
        const commentsList = snapshot.docs.map((doc: any) => {
          const data = doc.data();
          return {
            id: doc.id,
            content: data.content,
            userId: data.userId,
            userName: data.userName,
            userPhotoURL: data.userPhotoURL,
            createdAt: data.createdAt.toDate(),
            attachments: data.attachments || []
          };
        });

        setComments(commentsList);
        setLoading(false);
      },
      (err: Error) => {
        console.error('Erro ao carregar comentários:', err);
        
        const firebaseErr = err as Error;
        if ('code' in firebaseErr && typeof firebaseErr.code === 'string') {
          if (firebaseErr.code === 'permission-denied') {
            setError('Permissão negada. Verifique se você está autenticado e tem acesso a este ticket.');
          } else if (firebaseErr.code === 'not-found') {
            setError('Ticket não encontrado ou excluído.');
          } else {
            setError('Erro ao carregar comentários: ' + err.message);
          }
        } else {
          setError('Erro ao carregar comentários: ' + err.message);
        }
        
        setLoading(false);
      }
    );

    // Limpar o listener ao desmontar
    return () => unsubscribe();
  }, [ticketId, user]);

  // Adicionar um novo comentário
  const addComment = useCallback(async (content: string) => {
    if (!user) {
      setError('É necessário estar autenticado para comentar');
      return;
    }

    if (!content.trim()) {
      setError('O comentário não pode estar vazio');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const commentsRef = collection(db, 'tickets', ticketId, 'comments');
      
      // Adicionar o comentário de forma simples
      await addDoc(commentsRef, {
        content: content.trim(),
        userId: user.uid,
        userName: user.displayName || 'Usuário',
        userPhotoURL: user.photoURL || null,
        createdAt: Timestamp.now(),
        attachments: []
      });

      // Atualizar o contador do ticket, mas sem bloquear a conclusão da ação
      try {
        const ticketRef = doc(db, 'tickets', ticketId);
        const ticketDoc = await getDoc(ticketRef);
        
        if (ticketDoc.exists()) {
          const ticketData = ticketDoc.data();
          const currentCount = ticketData.commentCount || 0;
          
          // Sincronizar o comentário com o ClickUp, se houver taskId
          if (ticketData.taskId) {
            try {
              await clickupService.addCommentToTask(
                ticketData.taskId,
                content.trim(),
                user.displayName || 'Usuário'
              );
              console.log(`Comentário sincronizado com ClickUp na tarefa ${ticketData.taskId}`);
            } catch (clickupError) {
              console.warn('Não foi possível sincronizar o comentário com o ClickUp:', clickupError);
              // Não tratar como erro crítico para não bloquear a adição do comentário no sistema
            }
          }
          
          await updateDoc(ticketRef, {
            commentCount: currentCount + 1,
            updatedAt: Timestamp.now()
          });
        }
      } catch (updateError) {
        console.warn('Não foi possível atualizar o contador de comentários, mas o comentário foi adicionado:', updateError);
        // Não tratar como erro crítico
      }

      setSubmitting(false);
    } catch (err: any) {
      console.error('Erro ao adicionar comentário:', err);
      
      if (err?.code === 'permission-denied') {
        setError('Permissão negada. Verifique se você está autenticado e tem acesso a este ticket.');
      } else {
        setError('Falha ao adicionar o comentário. Por favor, tente novamente.');
      }
      
      setSubmitting(false);
    }
  }, [ticketId, user]);

  // Fazer upload de imagem e adicionar como comentário
  const addImageComment = useCallback(async (file: File) => {
    if (!user) {
      setError('É necessário estar autenticado para comentar');
      return;
    }

    if (!file) {
      setError('Nenhuma imagem selecionada');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Verificar se é uma imagem
      if (!file.type.startsWith('image/')) {
        throw new Error('O arquivo selecionado não é uma imagem');
      }

      const fileId = uuidv4();
      const fileRef = ref(storage, `comments/${ticketId}/${fileId}-${file.name}`);
      
      // Upload para o Storage
      await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(fileRef);
      
      // Criar anexo
      const attachment: CommentAttachment = {
        id: fileId,
        url: downloadUrl,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        createdAt: new Date()
      };

      // Adicionar comentário com a imagem
      const commentsRef = collection(db, 'tickets', ticketId, 'comments');
      
      await addDoc(commentsRef, {
        content: `![${file.name}](${downloadUrl})`,
        userId: user.uid,
        userName: user.displayName || 'Usuário',
        userPhotoURL: user.photoURL || null,
        createdAt: Timestamp.now(),
        attachments: [attachment]
      });

      // Atualizar o contador do ticket, mas sem bloquear a conclusão da ação
      try {
        const ticketRef = doc(db, 'tickets', ticketId);
        const ticketDoc = await getDoc(ticketRef);
        
        if (ticketDoc.exists()) {
          const ticketData = ticketDoc.data();
          const currentCount = ticketData.commentCount || 0;
          
          // Sincronizar o comentário com o ClickUp, se houver taskId
          if (ticketData.taskId) {
            try {
              const commentText = `**${user.displayName || 'Usuário'} enviou uma imagem:** ${file.name}\n${downloadUrl}`;
              await clickupService.addCommentToTask(
                ticketData.taskId,
                commentText
              );
              console.log(`Comentário com imagem sincronizado com ClickUp na tarefa ${ticketData.taskId}`);
            } catch (clickupError) {
              console.warn('Não foi possível sincronizar o comentário com imagem para o ClickUp:', clickupError);
              // Não tratar como erro crítico para não bloquear a adição do comentário no sistema
            }
          }
          
          await updateDoc(ticketRef, {
            commentCount: currentCount + 1,
            updatedAt: Timestamp.now()
          });
        }
      } catch (updateError) {
        console.warn('Não foi possível atualizar o contador de comentários, mas a imagem foi adicionada:', updateError);
        // Não tratar como erro crítico
      }

      setSubmitting(false);
    } catch (err: any) {
      console.error('Erro ao adicionar imagem:', err);
      
      if (err?.code === 'permission-denied') {
        setError('Permissão negada. Verifique se você está autenticado e tem acesso a este ticket.');
      } else if (err?.code && err.code.includes('storage')) {
        setError('Falha ao fazer upload da imagem. Verifique se você tem permissão para enviar arquivos.');
      } else {
        setError(err instanceof Error ? err.message : 'Falha ao adicionar a imagem');
      }
      
      setSubmitting(false);
    }
  }, [ticketId, user]);

  // Remover um comentário
  const deleteComment = useCallback(async (commentId: string) => {
    if (!user) {
      setError('É necessário estar autenticado para excluir um comentário');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Encontrar o comentário para verificar se o usuário é o autor
      const comment = comments.find(c => c.id === commentId);
      
      if (!comment) {
        throw new Error('Comentário não encontrado');
      }
      
      // Verificar se é o autor ou admin
      const isAdmin = user.email?.endsWith('@neurosaber.com.br') || false;
      if (comment.userId !== user.uid && !isAdmin) {
        throw new Error('Você não tem permissão para excluir este comentário');
      }

      // Excluir anexos do Storage, se houver
      if (comment.attachments && comment.attachments.length > 0) {
        for (const attachment of comment.attachments) {
          const fileRef = ref(storage, attachment.url);
          try {
            await deleteObject(fileRef);
          } catch (error) {
            console.warn('Erro ao excluir anexo:', error);
            // Continua mesmo se falhar ao excluir o arquivo
          }
        }
      }

      // Excluir o comentário
      const commentRef = doc(db, 'tickets', ticketId, 'comments', commentId);
      await deleteDoc(commentRef);

      // Decrementar o contador de comentários
      try {
        const ticketRef = doc(db, 'tickets', ticketId);
        const ticketDoc = await getDoc(ticketRef);
        
        if (ticketDoc.exists()) {
          const ticketData = ticketDoc.data();
          const currentCount = ticketData.commentCount || 0;
          
          // Nota: Atualmente o ClickUp não permite identificar facilmente qual comentário 
          // deve ser excluído, pois não temos uma correlação direta entre os IDs.
          // No futuro, seria possível adicionar o ID do comentário no sistema como 
          // parte do texto do comentário no ClickUp para permitir essa sincronização.
          
          // Envia um comentário informando sobre a exclusão, se houver taskId
          if (ticketData.taskId) {
            try {
              await clickupService.addCommentToTask(
                ticketData.taskId,
                `**Sistema:** Um comentário de ${comment.userName} foi excluído por ${user.displayName || 'Usuário'}.`
              );
              console.log('Notificação de exclusão de comentário enviada para o ClickUp');
            } catch (clickupError) {
              console.warn('Não foi possível enviar notificação de exclusão para o ClickUp:', clickupError);
              // Não tratar como erro crítico
            }
          }
          
          await updateDoc(ticketRef, {
            commentCount: Math.max(0, currentCount - 1),
            updatedAt: Timestamp.now()
          });
        }
      } catch (updateError) {
        console.warn('Não foi possível atualizar o contador de comentários, mas o comentário foi excluído:', updateError);
        // Não tratar como erro crítico
      }

      setSubmitting(false);
    } catch (err: any) {
      console.error('Erro ao excluir comentário:', err);
      
      if (err?.code === 'permission-denied') {
        setError('Permissão negada. Verifique se você está autenticado e tem permissão para excluir este comentário.');
      } else {
        setError(err instanceof Error ? err.message : 'Falha ao excluir o comentário');
      }
      
      setSubmitting(false);
    }
  }, [ticketId, user, comments]);

  return {
    comments,
    loading,
    submitting,
    error,
    addComment,
    addImageComment,
    deleteComment
  };
} 