import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, User, AlertCircle, Image as ImageIcon, CheckCircle, Clock, Edit2, MessageSquare, X, WifiOff, RefreshCw } from 'lucide-react';
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
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [replyingToComment, setReplyingToComment] = useState<Comment | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const { 
    comments,
    activeUsers,
    error: chatError,
    isConnected,
    isInitialized,
    isOnline,
    addComment,
    setTypingStatus,
    typingUsers,
    forceReconnect
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

  const handleReconnect = () => {
    setIsReconnecting(true);
    setError(null);
    
    // Chamar função de reconexão do hook
    if (forceReconnect) {
      forceReconnect();
      
      // Reset do estado após 3 segundos
      setTimeout(() => {
        setIsReconnecting(false);
      }, 3000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newComment.trim() && !editingCommentId) || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Se estiver editando um comentário
      if (editingCommentId) {
        const commentToEdit = allComments.find(c => c.id === editingCommentId);
        if (!commentToEdit) {
          throw new Error('Comentário não encontrado para edição');
        }

        // Implementar lógica de edição aqui
        console.log('[Comments] Editando comentário:', editingCommentId);
        
        // Para esta versão, vamos simular a edição adicionando um novo comentário
        // indicando que foi editado, já que a edição real exigiria mudanças no backend
        const editedContent = `${newComment} _(editado)_`;
        
        // Criar o comentário com todos os dados necessários
        const now = new Date();
        const comment = {
          content: editedContent,
          userId: user?.uid || 'anônimo',
          userName: userData?.name || user?.displayName || 'Anônimo',
          createdAt: now,
          ticketId: ticket.id,
          editedFrom: editingCommentId
        };
        
        console.log('[Comments] Estrutura de dados do comentário editado:', comment);
        
        // Salvar o comentário usando o hook colaborativo
        console.log('[Comments] Chamando addComment via hook para comentário editado...');
        const savedComment = await addComment(comment);
        
        // Limpar o estado de edição
        setEditingCommentId(null);
        setNewComment('');
        setIsSubmitting(false);
      }
      // Se estiver respondendo a um comentário
      else if (replyingToComment) {
        console.log('[Comments] Respondendo ao comentário:', replyingToComment.id);
        
        // Formatar menção do autor original
        const replyContent = `**@${replyingToComment.userName}:** ${newComment}`;
        
        // Criar o comentário com todos os dados necessários
        const now = new Date();
        const comment = {
          content: replyContent,
          userId: user?.uid || 'anônimo',
          userName: userData?.name || user?.displayName || 'Anônimo',
          createdAt: now,
          ticketId: ticket.id,
          replyTo: replyingToComment.id
        };
        
        console.log('[Comments] Estrutura de dados da resposta:', comment);
        
        // Salvar o comentário usando o hook colaborativo
        console.log('[Comments] Chamando addComment via hook para resposta...');
        const savedComment = await addComment(comment);
        console.log('[Comments] Resposta salva com sucesso via hook:', savedComment);
        
        // Notificar o componente pai sobre o novo comentário se a callback existir
        if (onCommentAdded) {
          console.log('[Comments] Chamando callback onCommentAdded');
          onCommentAdded(savedComment);
        }
        
        // Limpar o estado de resposta
        setReplyingToComment(null);
        setNewComment('');
        setIsSubmitting(false);
      }
      // Comentário normal
      else {
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
    
    // Verifica se é uma resposta com menção
    const mentionMatch = content.match(/^\*\*@(.*?):\*\* (.*)/);
    if (mentionMatch) {
      return (
        <>
          <span className="font-bold text-blue-600">@{mentionMatch[1]}: </span>
          {mentionMatch[2]}
        </>
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

  // Função para iniciar edição de um comentário
  const handleEditComment = (comment: Comment) => {
    if (comment.userId !== user?.uid) {
      console.log('[Comments] Não é possível editar comentários de outros usuários');
      return;
    }
    
    setEditingCommentId(comment.id);
    
    // Remover formatação de menção se for uma resposta
    let content = comment.content;
    const mentionMatch = content.match(/^\*\*@(.*?):\*\* (.*)/);
    if (mentionMatch) {
      content = mentionMatch[2]; // Pegar apenas o conteúdo após a menção
    }
    
    setNewComment(content);
    
    // Focar no input de edição
    setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus();
      }
    }, 0);
  };

  // Função para iniciar resposta a um comentário
  const handleReplyToComment = (comment: Comment) => {
    setReplyingToComment(comment);
    
    // Focar no input de resposta
    setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus();
      }
    }, 0);
  };

  // Função para cancelar edição ou resposta
  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setReplyingToComment(null);
    setNewComment('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Área de mensagens de status */}
      {(chatError || !isConnected) && (
        <div className={`px-4 py-2 mb-2 rounded flex items-center justify-between ${
          !isOnline 
          ? "bg-red-100 text-red-700" 
          : !isConnected 
            ? "bg-amber-100 text-amber-700" 
            : "bg-red-100 text-red-700"
        }`}>
          <div className="flex items-center gap-2 flex-1">
            {!isOnline ? (
              <>
                <WifiOff className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">Modo offline - Os comentários serão sincronizados quando a conexão for restabelecida.</span>
              </>
            ) : !isConnected ? (
              <>
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">Modo colaborativo offline - Os comentários continuam sendo salvos normalmente e serão sincronizados quando a conexão for restabelecida.</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">{chatError || 'Erro de conexão com o modo colaborativo'}</span>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            <button 
              onClick={handleReconnect}
              disabled={isReconnecting || (!navigator.onLine && !isConnected)}
              className={`p-1.5 rounded text-xs flex items-center gap-1 font-medium transition-colors ${
                isReconnecting 
                  ? 'bg-gray-200 text-gray-600 cursor-not-allowed' 
                  : !navigator.onLine
                  ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                  : 'bg-amber-200 text-amber-800 hover:bg-amber-300'
              }`}
              title={isReconnecting 
                    ? "Tentando reconectar..."
                    : !navigator.onLine 
                    ? "Verifique sua conexão com a internet" 
                    : "Tentar reconectar agora"}
              aria-label={isReconnecting 
                      ? "Tentando reconectar..."
                      : !navigator.onLine 
                      ? "Verifique sua conexão com a internet" 
                      : "Tentar reconectar agora"}
            >
              <RefreshCw className={`h-3 w-3 ${isReconnecting ? 'animate-spin' : ''}`} />
              {isReconnecting ? 'Reconectando...' : 'Reconectar'}
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-1 mb-1 text-xs text-blue-600 bg-blue-50 rounded">
        <span>Os comentários são sempre salvos no banco de dados, independente do modo colaborativo estar ativo.</span>
      </div>

      {/* Exibir erro específico do formulário */}
      {error && (
        <div className="px-4 py-2 mb-2 bg-red-100 text-red-700 rounded flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
          <button 
            onClick={() => setError(null)} 
            className="ml-auto p-1"
            aria-label="Fechar mensagem de erro"
            title="Fechar mensagem de erro"
          >
            <X className="h-3 w-3 text-red-500" />
          </button>
        </div>
      )}

      {/* Área de usuários ativos */}
      {activeUsers.length > 0 && (
        <div className="px-4 py-2 mb-2 bg-blue-50 text-blue-700 rounded text-xs">
          <span className="font-medium">Ativos:</span>{' '}
          {activeUsers.map(u => u.user?.name).join(', ')}
          
          {typingUsers.length > 0 && (
            <div className="mt-1">
              <span className="font-medium">Digitando:</span>{' '}
              {typingUsers.map(userId => {
                const user = activeUsers.find(u => u.user?.id === userId);
                return user?.user?.name || 'Usuário';
              }).join(', ')}
              <span className="animate-pulse">...</span>
            </div>
          )}
        </div>
      )}

      {/* Área de mensagens */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4"
        style={{ height: '400px' }}
      >
        {/* Agrupamento por data */}
        {Object.entries(groupCommentsByDate()).map(([date, dateComments]) => (
          <div key={date} className="mb-6">
            <div className="text-center mb-3">
              <span className="inline-block px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
                {date}
              </span>
            </div>
            
            {dateComments.map((comment, index) => {
              const isCurrentUserComment = isCurrentUser(comment.userId);
              const isLastMessage = index === dateComments.length - 1;
              
              return (
                <div
                  ref={isLastMessage ? lastMessageRef : undefined}
                  key={comment.id}
                  className={`mb-4 flex ${isCurrentUserComment ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`rounded-lg px-4 py-2 max-w-[80%] relative group ${
                      isCurrentUserComment 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {!isCurrentUserComment && (
                      <div className="font-semibold mb-1 text-xs">
                        {comment.userName || 'Anônimo'}
                      </div>
                    )}
                    
                    <div className="text-sm break-words whitespace-pre-wrap">{renderCommentContent(comment.content)}</div>
                    
                    <div className={`text-xs mt-1 flex items-center justify-between ${
                      isCurrentUserComment ? 'text-blue-200' : 'text-gray-500'
                    }`}>
                      <div>{formatTime(comment.createdAt)}</div>
                      <div>{renderMessageStatus(comment)}</div>
                    </div>
                    
                    {/* Menu de ações visível apenas em hover */}
                    <div className={`absolute top-0 ${isCurrentUserComment ? 'left-0 -translate-x-full -ml-2' : 'right-0 translate-x-full mr-2'} 
                                  opacity-0 group-hover:opacity-100 transition-opacity flex gap-1`}>
                      {isCurrentUserComment && (
                        <button 
                          onClick={() => handleEditComment(comment)}
                          className="p-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                          title="Editar comentário"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      )}
                      <button 
                        onClick={() => handleReplyToComment(comment)}
                        className="p-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                        title="Responder"
                      >
                        <MessageSquare className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        
        {allComments.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <MessageSquare className="h-8 w-8 mb-2" />
            <p>Nenhum comentário ainda. Seja o primeiro a comentar!</p>
          </div>
        )}
      </div>

      {/* Indicador de digitação */}
      {renderTypingIndicator()}
      
      {/* Área de resposta/edição */}
      {(replyingToComment || editingCommentId) && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-sm font-medium text-gray-700">
              {replyingToComment ? 
                `Respondendo para ${replyingToComment.userName}` : 
                'Editando comentário'}
            </div>
            <button 
              onClick={handleCancelEdit}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Cancelar edição"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Input de mensagem */}
      <div 
        className={`p-4 border-t border-gray-200 ${isDragging ? 'bg-blue-50' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <form 
          ref={formRef}
          onSubmit={handleSubmit} 
          className="flex items-end"
        >
          <div className="flex-1 mr-2">
            <input
              ref={editInputRef}
              type="text"
              value={newComment}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              onPaste={handlePaste}
              disabled={isSubmitting}
              placeholder={
                editingCommentId ? "Edite seu comentário..." : 
                replyingToComment ? `Responder para ${replyingToComment.userName}...` :
                "Digite sua mensagem..."
              }
              className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm shadow-sm"
            />
          </div>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
              className="rounded-full p-2 text-gray-500 hover:bg-gray-100 focus:outline-none"
              title="Anexar imagem"
            >
              <ImageIcon className="h-5 w-5" />
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newComment.trim()}
              className={`rounded-full p-2 text-white focus:outline-none ${
                isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 
                !newComment.trim() ? 'bg-gray-300 cursor-not-allowed' : 
                'bg-blue-500 hover:bg-blue-600'
              }`}
              title="Enviar mensagem"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            aria-label="Anexar imagem"
          />
        </form>
        
        {isDragging && (
          <div className="absolute inset-0 bg-blue-500/20 border-2 border-dashed border-blue-500 rounded-md flex items-center justify-center z-10">
            <div className="text-blue-600 font-medium">Solte a imagem para enviar</div>
          </div>
        )}
      </div>
    </div>
  );
}