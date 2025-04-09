import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  User, 
  Image as ImageIcon, 
  Trash2,
  X,
  AlertTriangle,
  Loader,
  CheckCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useComments } from '../hooks/useComments';
import { useAuthStore } from '../stores/authStore';
import type { Ticket } from '../types/ticket';

interface CommentsProps {
  ticket: Ticket;
  showHeader?: boolean;
}

export function Comments({ ticket, showHeader = true }: CommentsProps) {
  const { user } = useAuthStore();
  const [newComment, setNewComment] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const commentsContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  const {
    comments,
    loading,
    submitting,
    error,
    hasMore,
    loadMoreComments,
    addComment,
    addImageComment,
    deleteComment
  } = useComments(ticket.id);

  // Configurar o Intersection Observer para carregar mais comentários
  useEffect(() => {
    if (!hasMore || loading) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreComments();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreTriggerRef.current) {
      observerRef.current.observe(loadMoreTriggerRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, loadMoreComments]);

  // Rolar para o último comentário apenas quando um novo comentário for adicionado
  useEffect(() => {
    if (commentsContainerRef.current && comments.length > 0) {
      const container = commentsContainerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 300;
      
      if (isNearBottom) {
        requestAnimationFrame(() => {
          if (commentsContainerRef.current) {
            commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
          }
        });
      }
    }
  }, [comments.length]);

  // Manipulador para enviar um comentário de texto
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!newComment.trim() || submitting || !user) return;

    try {
      await addComment(newComment.trim());
      setNewComment('');
      toast.success('Comentário enviado com sucesso!', {
        position: 'bottom-right',
        autoClose: 3000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true
      });
    } catch (error) {
      console.error('Erro ao enviar comentário:', error);
      toast.error('Erro ao enviar comentário. Tente novamente.', {
        position: 'bottom-right',
        autoClose: 5000
      });
    }
  };

  // Manipulador para tecla Enter enviar o comentário
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  // Manipuladores de drag and drop para imagens
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
    if (files.length > 0) {
      await handleFile(files[0]); // Processar apenas o primeiro arquivo
    }
  };

  // Manipulador para seleção de arquivo via input
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFile(files[0]);
    }
    // Limpar o input para permitir selecionar o mesmo arquivo novamente
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Função para processar um arquivo de imagem
  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Apenas imagens são permitidas');
      return;
    }

    try {
      await addImageComment(file);
    } catch (error) {
      console.error('Erro ao enviar imagem:', error);
    }
  };

  // Manipulador para colar imagens do clipboard
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          handleFile(file);
          break;
        }
      }
    }
  };

  // Manipulador para confirmar e excluir um comentário
  const handleDeleteComment = async (commentId: string) => {
    if (confirmDelete === commentId) {
      try {
        await deleteComment(commentId);
        setConfirmDelete(null);
        toast.success('Comentário excluído com sucesso!', {
          position: 'bottom-right',
          autoClose: 3000,
          hideProgressBar: true
        });
      } catch (error) {
        console.error('Erro ao excluir comentário:', error);
        toast.error('Erro ao excluir comentário. Tente novamente.', {
          position: 'bottom-right',
          autoClose: 5000
        });
      }
    } else {
      setConfirmDelete(commentId);
      // Limpar a confirmação após 3 segundos
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  // Funções para formatação de data e hora
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Agrupar comentários por data
  const groupedComments = comments.reduce<Record<string, typeof comments>>((groups, comment) => {
    const date = formatDate(comment.createdAt);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(comment);
    return groups;
  }, {});

  // Ordenar as datas e garantir que os comentários de cada dia estejam ordenados
  const sortedDates = Object.keys(groupedComments).sort((a, b) => {
    const dateA = new Date(a.split('/').reverse().join('-'));
    const dateB = new Date(b.split('/').reverse().join('-'));
    return dateA.getTime() - dateB.getTime();
  });

  // Ordenar comentários dentro de cada grupo
  sortedDates.forEach(date => {
    groupedComments[date].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  });

  // Verificar se o usuário é o autor do comentário
  const isCurrentUser = (userId: string) => {
    return user?.uid === userId;
  };

  // Renderizar o conteúdo do comentário com suporte a imagens
  const renderCommentContent = (content: string) => {
    // Verificar se o conteúdo é uma imagem em formato Markdown
    const imageMatch = content.match(/!\[(.*?)\]\((.*?)\)/);
    if (imageMatch) {
      const [, alt, src] = imageMatch;
      return (
        <img 
          src={src} 
          alt={alt} 
          className="max-w-full rounded-lg hover:opacity-95 transition-opacity cursor-pointer" 
          onClick={() => window.open(src, '_blank')}
        />
      );
    }
    
    // Caso contrário, é um texto normal
    return <div className="whitespace-pre-wrap">{content}</div>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48" aria-busy="true" aria-live="polite">
        <Loader className="h-8 w-8 text-primary animate-spin" />
        <span className="sr-only">Carregando comentários...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border rounded-lg" aria-label="Seção de comentários">
      {showHeader && (
        <div className="p-4 border-b">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Comentários
          </h2>
        </div>
      )}

      {error && (
        <div 
          className="bg-red-50 border-l-4 border-red-400 p-4 mb-4 rounded"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Container para a lista de comentários */}
      <div 
        ref={commentsContainerRef}
        className={`flex-1 ${
          isDragging ? 'bg-blue-50/50' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="log"
        aria-label="Lista de comentários"
      >
        <div className="max-w-2xl mx-auto h-[300px] overflow-y-auto p-4">
          {/* Indicador de carregamento inicial */}
          {loading && comments.length === 0 && (
            <div className="flex items-center justify-center h-48" aria-busy="true" aria-live="polite">
              <Loader className="h-8 w-8 text-primary animate-spin" />
              <span className="sr-only">Carregando comentários...</span>
            </div>
          )}

          {/* Comentários agrupados por data */}
          {sortedDates.map((date) => (
            <div key={date} className="mb-8 last:mb-0">
              <div className="flex justify-center sticky top-2 z-10">
                <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs text-gray-600 font-medium shadow-sm">
                  {date}
                </span>
              </div>

              <div className="mt-4 space-y-4">
                {groupedComments[date].map((comment) => {
                  const isOwn = isCurrentUser(comment.userId);
                  const isDeleteConfirm = confirmDelete === comment.id;
                  
                  return (
                    <div
                      key={comment.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      role="article"
                      aria-label={`Comentário de ${comment.userName}`}
                    >
                      <div className={`flex items-end gap-2 w-fit max-w-[85%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                        {/* Avatar do usuário (apenas para comentários de outros) */}
                        {!isOwn && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                            {comment.userPhotoURL ? (
                              <img 
                                src={comment.userPhotoURL} 
                                alt={comment.userName} 
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <User className="w-5 h-5 text-gray-500" aria-hidden="true" />
                            )}
                          </div>
                        )}
                        
                        {/* Conteúdo do comentário */}
                        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                          {!isOwn && (
                            <span className="text-xs text-gray-500 mb-1 px-1">
                              {comment.userName}
                            </span>
                          )}
                          
                          <div
                            className={`group relative rounded-2xl px-4 py-2.5 shadow-sm comment-bubble ${
                              isOwn
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-900'
                            }`}
                          >
                            {/* Botão de excluir (visível apenas em hover e para o autor) */}
                            {isOwn && (
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className={`absolute -top-2 -right-2 p-1.5 rounded-full ${
                                  isDeleteConfirm 
                                    ? 'bg-red-500 text-white shadow-lg' 
                                    : 'bg-white text-gray-600 opacity-0 group-hover:opacity-100 shadow-md hover:bg-gray-50'
                                } transition-all duration-200`}
                                aria-label={isDeleteConfirm ? "Confirmar exclusão" : "Excluir comentário"}
                                title={isDeleteConfirm ? "Confirmar exclusão" : "Excluir comentário"}
                              >
                                {isDeleteConfirm ? (
                                  <Trash2 className="h-3.5 w-3.5" />
                                ) : (
                                  <X className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                            
                            {/* Conteúdo do comentário */}
                            <div className="text-sm break-words">
                              {renderCommentContent(comment.content)}
                            </div>
                            
                            {/* Horário */}
                            <div className={`text-[11px] ${
                              isOwn ? 'text-blue-100' : 'text-gray-500'
                            } text-right mt-1`}>
                              {formatTime(comment.createdAt)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Trigger para carregar mais comentários */}
          {hasMore && (
            <div 
              ref={loadMoreTriggerRef}
              className="flex justify-center py-4"
              aria-busy={loading}
              role="status"
            >
              {loading ? (
                <Loader className="h-6 w-6 text-primary animate-spin" />
              ) : (
                <span className="text-sm text-gray-500">Carregar mais comentários...</span>
              )}
            </div>
          )}

          {/* Mensagem para lista vazia */}
          {!loading && comments.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <p>Nenhum comentário ainda.</p>
              <p className="text-sm">Seja o primeiro a comentar!</p>
            </div>
          )}
        </div>
      </div>

      {/* Formulário para adicionar comentários */}
      <div className="p-4 border-t bg-gray-50">
        <form 
          ref={formRef}
          onSubmit={handleSubmit}
          className="max-w-2xl mx-auto relative"
          aria-label="Formulário de comentário"
        >
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyPress={handleKeyPress}
            onPaste={handlePaste}
            placeholder="Escreva um comentário..."
            disabled={submitting || !user}
            className="w-full px-4 py-3 pr-24 bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-label="Campo de comentário"
          />
          
          {/* Botões de enviar comentário e anexar imagem */}
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex space-x-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting || !user}
              className="p-2 rounded-full hover:bg-white text-gray-600 hover:text-blue-600 transition-colors"
              aria-label="Anexar imagem"
              title="Anexar imagem"
            >
              <ImageIcon className="h-5 w-5" />
            </button>

            <button
              type="submit"
              disabled={!newComment.trim() || submitting || !user}
              className={`p-2 rounded-full ${
                !newComment.trim() || submitting || !user
                  ? 'text-gray-400'
                  : 'text-blue-600 hover:bg-white'
              } transition-colors`}
              aria-label="Enviar comentário"
              title="Enviar comentário"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>

          {/* Input de arquivo oculto */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            aria-hidden="true"
          />
        </form>
        
        {/* Mensagem enquanto está enviando */}
        {submitting && (
          <div 
            className="mt-2 text-xs text-gray-500 flex items-center justify-center"
            aria-live="polite"
          >
            <Loader className="animate-spin h-3 w-3 mr-1" />
            <span>Enviando...</span>
          </div>
        )}
        
        {/* Dica para o usuário */}
        {user && (
          <div className="mt-2 text-xs text-gray-500 text-center">
            <p>Arraste e solte imagens para enviá-las, ou pressione Enter para enviar o comentário.</p>
          </div>
        )}

        {/* Mensagem para usuários não autenticados */}
        {!user && (
          <div className="mt-2 text-sm text-gray-600 p-3 bg-gray-50 rounded-lg text-center">
            <p>Você precisa estar logado para enviar comentários.</p>
          </div>
        )}
      </div>
    </div>
  );
} 