import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, User, AlertCircle, Image as ImageIcon, CheckCircle, Clock } from 'lucide-react';
import { useCollaborativeComments } from '../hooks/useCollaborativeComments';
import { useAuthStore } from '../stores/authStore';
import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import type { Ticket, Comment } from '../types/ticket';

interface CollaborativeCommentsProps {
  ticket: Ticket;
  onCommentAdded?: (comment: Comment) => void;
}

export function CollaborativeComments({ ticket, onCommentAdded }: CollaborativeCommentsProps) {
  const { user, userData } = useAuthStore();
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [lastTypingUpdate, setLastTypingUpdate] = useState(0);
  const [localMessages, setLocalMessages] = useState<Comment[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const { 
    comments,
    activeUsers,
    error: chatError,
    isConnected,
    addComment,
    setTypingStatus,
    typingUsers
  } = useCollaborativeComments(ticket.id);

  // Combinar mensagens do servidor com mensagens locais ainda não confirmadas
  const allComments = [...comments, ...localMessages.filter(
    localMsg => !comments.some(serverMsg => serverMsg.id === localMsg.id)
  )];

  // Rolagem automática inteligente quando chegam novas mensagens
  useEffect(() => {
    // Verificar se o usuário está próximo ao final do chat
    const shouldScrollToBottom = () => {
      if (!chatContainerRef.current) return false;
      
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      // Scroll para o final se estiver a menos de 100px do final ou se a última mensagem é do usuário atual
      return scrollHeight - scrollTop - clientHeight < 100 || 
        (allComments.length > 0 && allComments[allComments.length - 1].userId === user?.uid);
    };
    
    if (shouldScrollToBottom() && lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [allComments, user?.uid]);

  // Efeito para gerenciar o indicador de digitação
  useEffect(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        setTypingStatus?.(false);
      }, 3000);
    }
    
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [isTyping, setTypingStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Verificar se está conectado
      if (!isConnected) {
        console.warn('[Comments] Tentando enviar comentário enquanto offline');
      }

      console.log('[Comments] Enviando novo comentário:', newComment);
      
      // Criar o comentário com todos os dados necessários
      const now = new Date();
      const comment = {
        content: newComment,
        userId: user?.uid || 'anônimo',
        userName: userData?.name || user?.displayName || 'Anônimo',
        createdAt: now,
        ticketId: ticket.id
      };
      
      console.log('[Comments] Estrutura de dados do comentário:', comment);
      
      // Salvar o comentário usando o hook colaborativo
      console.log('[Comments] Chamando addComment via hook...');
      const savedComment = await addComment(comment);
      console.log('[Comments] Comentário salvo com sucesso via hook:', savedComment);
      
      // Notificar o componente pai sobre o novo comentário se a callback existir
      if (onCommentAdded) {
        console.log('[Comments] Chamando callback onCommentAdded');
        onCommentAdded(savedComment);
        console.log('[Comments] Callback onCommentAdded executada');
      } else {
        console.log('[Comments] Sem callback onCommentAdded configurada');
      }
      
      // Limpar o estado do comentário e estado de submissão
      setNewComment('');
      setIsSubmitting(false);
      
      // Log extra para confirmar o envio do webhook
      console.log('[Comments] Comentário adicionado e webhook será enviado diretamente via fetch');
      
      // Envio direto do webhook via fetch (método confirmado como funcional)
      try {
        console.log('[Comments] Enviando webhook diretamente via fetch');
        
        // Preparar payload simplificado
        const webhookPayload = {
          targetUrl: 'https://webhook.sistemaneurosaber.com.br/webhook/comentario',
          event: 'ticket.comment_added',
          data: {
            ticketId: ticket.id,
            comment: {
              id: savedComment.id,
              content: savedComment.content,
              userId: savedComment.userId,
              userName: savedComment.userName,
              createdAt: new Date().toISOString()
            },
            ticket: {
              id: ticket.id,
              title: ticket.title
            }
          }
        };
        
        console.log('[Comments] Payload do webhook:', JSON.stringify(webhookPayload, null, 2));
        
        // Enviar diretamente para o proxy em produção
        const response = await fetch('https://tickets.sistemaneurosaber.com.br/.netlify/functions/webhook-proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload)
        });
        
        console.log('[Comments] Envio direto de webhook - status:', response.status);
        
        if (!response.ok) {
          console.error('[Comments] Erro ao enviar webhook:', response.status, response.statusText);
          const text = await response.text();
          console.log('[Comments] Resposta de erro completa:', text);
        } else {
          try {
            const result = await response.json();
            console.log('[Comments] Webhook enviado com sucesso - resposta:', result);
          } catch (jsonError) {
            console.error('[Comments] Erro ao processar resposta JSON:', jsonError);
            const text = await response.text();
            console.log('[Comments] Resposta texto puro:', text);
          }
        }
      } catch (webhookError) {
        console.error('[Comments] Erro ao enviar webhook diretamente:', webhookError);
      }
      
    } catch (error) {
      console.error('[Comments] Erro ao enviar comentário:', error);
      
      setError(error instanceof Error 
        ? error.message 
        : 'Não foi possível enviar o comentário. Tente novamente.');
      
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewComment(e.target.value);
    
    // Atualizar status de digitação com throttling
    const now = Date.now();
    if (!isTyping || now - lastTypingUpdate > 2000) {
      setIsTyping(true);
      setLastTypingUpdate(now);
      setTypingStatus?.(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    await handleFiles(files);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      await handleFiles(files);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await handleFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFiles = async (files: File[]) => {
    if (!user || !userData || !isConnected) return;

    try {
      setIsSubmitting(true);

      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          console.error('Arquivo não é uma imagem:', file.name);
          continue;
        }

        // Criar mensagem temporária local
        const tempId = uuidv4();
        const tempComment: Comment = {
          id: tempId,
          content: `Enviando imagem...`,
          userId: user.uid,
          userName: userData.name,
          ticketId: ticket.id,
          createdAt: new Date(),
          status: 'enviando'
        } as Comment;

        // Adicionar mensagem local enquanto aguarda upload
        setLocalMessages(prev => [...prev, tempComment]);

        try {
          const fileId = uuidv4();
          const fileRef = ref(storage, `comments/${ticket.id}/${fileId}-${file.name}`);
          
          await uploadBytes(fileRef, file);
          const imageUrl = await getDownloadURL(fileRef);
          
          // Remover mensagem temporária
          setLocalMessages(prev => prev.filter(msg => msg.id !== tempId));
          
          try {
            // Adicionar comentário com a imagem ao sistema colaborativo
            const comment = await addComment({
              content: `![${file.name}](${imageUrl})`,
              userId: user.uid,
              userName: userData.name,
              ticketId: ticket.id,
              createdAt: new Date()
            });

            // Chamar onCommentAdded para garantir que o comentário seja atualizado no ticket
            if (onCommentAdded) {
              console.log('Chamando onCommentAdded callback para imagem no ticket pai');
              onCommentAdded(comment);
            }
          } catch (commentError) {
            console.error('Erro ao adicionar imagem ao sistema colaborativo:', commentError);
            
            // Se falhar, tenta adicionar diretamente via callback
            if (onCommentAdded) {
              try {
                console.log('Tentando adicionar imagem diretamente via callback');
                const directComment: Comment = {
                  id: crypto.randomUUID(),
                  content: `![${file.name}](${imageUrl})`,
                  userId: user.uid,
                  userName: userData.name,
                  ticketId: ticket.id,
                  createdAt: new Date()
                };
                onCommentAdded(directComment);
              } catch (fallbackError) {
                console.error('Erro ao adicionar imagem via fallback:', fallbackError);
              }
            }
          }
        } catch (error) {
          console.error('Erro ao enviar imagem:', error);
          
          // Marcar mensagem temporária como falha
          setLocalMessages(prev => prev.map(msg => 
            msg.id === tempId ? { ...msg, content: 'Falha ao enviar imagem', status: 'erro' } : msg
          ));
        }
      }
    } catch (error) {
      console.error('Erro ao processar imagens:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const messageDate = new Date(date);
    
    if (messageDate.toDateString() === today.toDateString()) {
      return 'Hoje';
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    } else {
      return messageDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
  };

  const groupCommentsByDate = () => {
    const groups: Record<string, Comment[]> = {};
    
    allComments.forEach(comment => {
      const date = formatDate(comment.createdAt);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(comment);
    });

    return groups;
  };

  const isCurrentUser = (userId: string): boolean => {
    return user?.uid === userId;
  };

  const renderMessageStatus = (comment: Comment) => {
    if (comment.status === 'enviando') {
      return <Clock className="h-3 w-3 text-gray-400" />;
    } else if (comment.status === 'erro') {
      return <AlertCircle className="h-3 w-3 text-red-500" />;
    } else {
      return <CheckCircle className="h-3 w-3 text-blue-400" />;
    }
  };

  const renderCommentContent = (content: string) => {
    // Verifica se o conteúdo é uma imagem (formato Markdown)
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

  // Renderiza quem está digitando
  const renderTypingIndicator = () => {
    const typing = Array.from(typingUsers || []).filter(id => id !== user?.uid);
    
    if (typing.length === 0) return null;
    
    const typingUserNames = typing.map(userId => {
      const activeUser = activeUsers.find(u => u.user.id === userId);
      return activeUser?.user.name || 'Alguém';
    });
    
    let typingText = '';
    if (typingUserNames.length === 1) {
      typingText = `${typingUserNames[0]} está digitando...`;
    } else if (typingUserNames.length === 2) {
      typingText = `${typingUserNames[0]} e ${typingUserNames[1]} estão digitando...`;
    } else {
      typingText = 'Várias pessoas estão digitando...';
    }
    
    return (
      <div className="flex items-center text-xs text-gray-500 animate-pulse px-4">
        <div className="flex space-x-1">
          <span className="animate-bounce">•</span>
          <span className="animate-bounce delay-75">•</span>
          <span className="animate-bounce delay-150">•</span>
        </div>
        <span className="ml-2">{typingText}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Status da Conexão */}
      {!isConnected && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <p className="ml-3 text-sm text-yellow-700">
              Tentando reconectar ao chat...
            </p>
          </div>
        </div>
      )}

      {chatError && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="ml-3 text-sm text-red-700">
              Erro: {chatError}
            </p>
          </div>
        </div>
      )}

      {/* Lista de Comentários */}
      <div 
        ref={chatContainerRef}
        className={`flex-1 overflow-y-auto space-y-4 pr-2 ${isDragging ? 'bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg' : ''}`}
        style={{ maxHeight: 'calc(100vh - 400px)', minHeight: '300px' }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {Object.entries(groupCommentsByDate()).map(([date, dateComments]) => (
          <div key={date} className="space-y-4">
            <div className="flex justify-center">
              <span className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
                {date}
              </span>
            </div>

            {dateComments.map((comment, index) => {
              const isOwn = isCurrentUser(comment.userId);
              const isLastMessage = index === dateComments.length - 1 && 
                date === Object.keys(groupCommentsByDate())[Object.keys(groupCommentsByDate()).length - 1];
              
              return (
                <div
                  key={comment.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  ref={isLastMessage ? lastMessageRef : null}
                >
                  <div className={`flex items-end space-x-2 max-w-[85%] ${isOwn ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    {!isOwn && (
                      <div 
                        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white"
                        style={{
                          backgroundColor: activeUsers.find(u => u.user.id === comment.userId)?.user.color || '#6B7280'
                        }}
                      >
                        {comment.userName?.[0].toUpperCase() || <User className="w-5 h-5" />}
                      </div>
                    )}
                    
                    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                      {!isOwn && (
                        <span className="text-xs text-gray-500 mb-1">
                          {comment.userName || 'Usuário'}
                        </span>
                      )}
                      <div className={`rounded-3xl px-4 py-2 max-w-full break-words shadow-sm ${
                        isOwn
                          ? 'bg-blue-600 text-white rounded-tr-none'
                          : 'bg-gray-100 text-gray-900 rounded-tl-none'
                      }`}>
                        <div className="text-sm whitespace-pre-wrap">
                          {renderCommentContent(comment.content)}
                        </div>
                        <div className={`flex items-center justify-end space-x-1 mt-1 ${
                          isOwn ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          <span className="text-xs">{formatTime(comment.createdAt)}</span>
                          {isOwn && (
                            <span className="flex-shrink-0">
                              {renderMessageStatus(comment)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {allComments.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-sm">
              Nenhum comentário ainda. Seja o primeiro a comentar!
            </p>
          </div>
        )}
        
        {renderTypingIndicator()}
      </div>

      {/* Usuários Ativos */}
      {activeUsers.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Online:</span>
            <div className="flex -space-x-2 overflow-hidden">
              {activeUsers.map(({ user }) => (
                <div
                  key={user.id}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white ring-2 ring-white"
                  style={{ backgroundColor: user.color }}
                  title={user.name}
                >
                  {user.name[0].toUpperCase()}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Formulário de Novo Comentário */}
      <div className="mt-4 border-t border-gray-200 pt-4">
        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={newComment}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                onPaste={handlePaste}
                placeholder="Digite sua mensagem ou arraste uma imagem..."
                className="w-full rounded-full border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm pr-12 py-3"
                disabled={isSubmitting || !isConnected}
              />
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
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={!isConnected}
                aria-label="Anexar imagem"
              >
                <ImageIcon className="h-5 w-5" />
              </button>
            </div>
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting || !isConnected}
              className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
              aria-label="Enviar mensagem"
            >
              <Send className={`h-5 w-5 text-white ${isSubmitting ? 'opacity-50' : ''}`} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}