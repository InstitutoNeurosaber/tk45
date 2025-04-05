import React, { useState, useRef, useEffect } from 'react';
import { Send, User, AlertCircle, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { useCollaborativeComments } from '../hooks/useCollaborativeComments';
import { useAuthStore } from '../stores/authStore';
import { useTicketStore } from '../stores/ticketStore';
import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import type { Ticket, Comment } from '../types/ticket';
import { clickupService } from '../services/clickupService';

interface CollaborativeCommentsProps {
  ticket: Ticket;
  onCommentAdded?: (comment: Comment) => void;
}

export function CollaborativeComments({ ticket, onCommentAdded }: CollaborativeCommentsProps) {
  const { user, userData } = useAuthStore();
  const { addComment: addTicketComment } = useTicketStore();
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const commentListRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const { 
    comments,
    error: chatError,
    isConnected,
    addComment
  } = useCollaborativeComments(ticket.id);

  // Scroll para o final quando novos comentários são adicionados
  useEffect(() => {
    if (commentListRef.current) {
      commentListRef.current.scrollTop = commentListRef.current.scrollHeight;
    }
  }, [comments]);

  // Sincronizar comentários com o ClickUp
  const syncWithClickUp = async () => {
    if (!ticket.taskId) return;
    
    setIsSyncing(true);
    setSyncError(null);

    try {
      const isConfigured = await clickupService.isConfigured();
      if (!isConfigured) {
        setSyncError('Integração com ClickUp não configurada');
        return;
      }

      // Buscar comentários do ClickUp
      const clickupComments = await clickupService.getComments(ticket.taskId);
      
      // Comparar e adicionar comentários que não existem no sistema
      for (const clickupComment of clickupComments) {
        const exists = comments.some(c => c.id === clickupComment.id);
        if (!exists) {
          await addComment(clickupComment);
        }
      }
    } catch (error) {
      console.error('Erro ao sincronizar com ClickUp:', error);
      setSyncError('Erro ao sincronizar comentários com o ClickUp');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting || !user || !userData) return;

    setIsSubmitting(true);
    setError(null);
    setSyncError(null);

    try {
      const comment = {
        content: newComment.trim(),
        userId: user.uid,
        userName: userData.name,
        ticketId: ticket.id,
        createdAt: new Date()
      };

      // Adicionar comentário localmente
      const savedComment = await addComment(comment);
      
      if (onCommentAdded) {
        onCommentAdded(savedComment);
      }

      // Sincronizar com ClickUp se houver taskId
      if (ticket.taskId) {
        try {
          const isConfigured = await clickupService.isConfigured();
          if (isConfigured) {
            await clickupService.addComment(ticket.taskId, savedComment);
          }
        } catch (syncError) {
          console.error('Erro ao sincronizar com ClickUp:', syncError);
          setSyncError('Erro ao sincronizar comentário com o ClickUp');
        }
      }
      
      setNewComment('');
    } catch (error) {
      console.error('Erro ao enviar comentário:', error);
      setError(error instanceof Error ? error.message : 'Erro ao enviar comentário');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !user || !userData) return;

    setIsSubmitting(true);
    setError(null);
    setSyncError(null);

    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;

        const fileId = uuidv4();
        const fileRef = ref(storage, `comments/${ticket.id}/${fileId}-${file.name}`);
        
        await uploadBytes(fileRef, file);
        const imageUrl = await getDownloadURL(fileRef);
        
        const comment = await addComment({
          content: `![${file.name}](${imageUrl})`,
          userId: user.uid,
          userName: userData.name,
          ticketId: ticket.id,
          createdAt: new Date()
        });

        if (onCommentAdded) {
          onCommentAdded(comment);
        }

        // Sincronizar com ClickUp se houver taskId
        if (ticket.taskId) {
          try {
            const isConfigured = await clickupService.isConfigured();
            if (isConfigured) {
              await clickupService.addComment(ticket.taskId, comment);
            }
          } catch (syncError) {
            console.error('Erro ao sincronizar imagem com ClickUp:', syncError);
            setSyncError('Erro ao sincronizar imagem com o ClickUp');
          }
        }
      }
    } catch (error) {
      console.error('Erro ao enviar imagem:', error);
      setError('Erro ao enviar imagem');
    } finally {
      setIsSubmitting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderCommentContent = (content: string) => {
    const imageMatch = content.match(/!\[(.*?)\]\((.*?)\)/);
    if (imageMatch) {
      const [, alt, src] = imageMatch;
      return (
        <img 
          src={src} 
          alt={alt} 
          className="max-w-full rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => window.open(src, '_blank')}
        />
      );
    }
    return content;
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Cabeçalho com botão de sincronização */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Comentários</h3>
        {ticket.taskId && (
          <button
            onClick={syncWithClickUp}
            disabled={isSyncing}
            className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sincronizar com ClickUp
              </>
            )}
          </button>
        )}
      </div>

      {/* Lista de Comentários */}
      <div 
        ref={commentListRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ height: '500px' }}
      >
        {comments.map((comment) => (
          <div 
            key={comment.id}
            className="bg-white rounded-lg shadow-sm p-4 border border-gray-200"
          >
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">
                  {comment.userName || 'Usuário'}
                </div>
                <div className="text-xs text-gray-500">
                  {formatDateTime(comment.createdAt)}
                </div>
              </div>
            </div>
            <div className="text-gray-700 whitespace-pre-wrap pl-10">
              {renderCommentContent(comment.content)}
            </div>
          </div>
        ))}

        {comments.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            Nenhum comentário ainda. Seja o primeiro a comentar!
          </div>
        )}
      </div>

      {/* Formulário de Novo Comentário */}
      <div className="p-4 bg-white border-t border-gray-200">
        {(error || syncError) && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
            {error || syncError}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex space-x-2">
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Digite seu comentário..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                disabled={isSubmitting || !isConnected}
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
                multiple
                aria-label="Selecionar imagens para envio"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                disabled={isSubmitting || !isConnected}
              >
                <ImageIcon className="h-5 w-5 mr-2 text-gray-500" />
                Anexar Imagem
              </button>
            </div>
            
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting || !isConnected}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isSubmitting ? (
                'Enviando...'
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" />
                  Enviar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}