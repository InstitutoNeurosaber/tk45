import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, X, AlertCircle, MessageSquare, Clock, Loader, CheckCircle } from 'lucide-react';
import type { Notification } from '../types/ticket';

interface NotificationsProps {
  notifications: Notification[];
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onDeleteNotification: (notificationId: string) => void;
  onClearAll: () => void;
  loading?: boolean;
  error?: string | null;
  successMessage?: string | null;
}

export function Notifications({ 
  notifications, 
  onMarkAsRead, 
  onMarkAllAsRead, 
  onDeleteNotification,
  onClearAll,
  loading = false,
  error = null,
  successMessage = null
}: NotificationsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n => !n.read).length;
  
  // Estados para ações em progresso em itens específicos
  const [processingItems, setProcessingItems] = useState<Record<string, boolean>>({});

  // Fecha o menu quando clica fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Método melhorado para marcar como lido com feedback visual
  const handleMarkAsRead = async (notificationId: string) => {
    setProcessingItems(prev => ({ ...prev, [notificationId]: true }));
    try {
      await onMarkAsRead(notificationId);
    } finally {
      // Remove o item de processamento após 300ms para a animação completar
      setTimeout(() => {
        setProcessingItems(prev => {
          const newState = { ...prev };
          delete newState[notificationId];
          return newState;
        });
      }, 300);
    }
  };

  // Método melhorado para excluir com feedback visual
  const handleDelete = async (notificationId: string) => {
    setProcessingItems(prev => ({ ...prev, [notificationId]: true }));
    try {
      await onDeleteNotification(notificationId);
    } finally {
      setTimeout(() => {
        setProcessingItems(prev => {
          const newState = { ...prev };
          delete newState[notificationId];
          return newState;
        });
      }, 300);
    }
  };

  // Gerenciar ações globais com feedback
  const [processingAll, setProcessingAll] = useState(false);
  
  const handleMarkAllAsRead = async () => {
    if (processingAll || unreadCount === 0) return;
    setProcessingAll(true);
    try {
      await onMarkAllAsRead();
    } finally {
      setTimeout(() => setProcessingAll(false), 500);
    }
  };

  const handleClearAll = async () => {
    if (processingAll || notifications.length === 0) return;
    setProcessingAll(true);
    try {
      await onClearAll();
    } finally {
      setTimeout(() => setProcessingAll(false), 500);
    }
  };

  // Agrupa notificações por data
  const groupedNotifications = notifications.reduce((groups, notification) => {
    const date = new Date(notification.createdAt).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(notification);
    return groups;
  }, {} as Record<string, Notification[]>);

  // Retorna o ícone apropriado baseado no tipo de notificação
  const getNotificationIcon = (message: string) => {
    if (message.includes('status')) return <Clock className="h-5 w-5 text-purple-500" />;
    if (message.includes('comentário')) return <MessageSquare className="h-5 w-5 text-blue-500" />;
    if (message.includes('ticket')) return <AlertCircle className="h-5 w-5 text-orange-500" />;
    return <AlertCircle className="h-5 w-5 text-yellow-500" />;
  };

  // Formata o tempo relativo
  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
    
    if (days > 0) {
      return days === 1 ? rtf.format(-1, 'day') : `${days}d atrás`;
    }
    if (hours > 0) {
      return hours === 1 ? rtf.format(-1, 'hour') : `${hours}h atrás`;
    }
    if (minutes > 0) {
      return minutes === 1 ? rtf.format(-1, 'minute') : `${minutes}m atrás`;
    }
    return 'Agora';
  };

  return (
    <div className="relative" ref={notificationRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors duration-200 group"
        aria-label={`Notificações (${unreadCount} não lidas)`}
        title={`Notificações (${unreadCount} não lidas)`}
      >
        <Bell className={`h-6 w-6 transition-all ${isOpen ? 'text-blue-600' : ''} ${unreadCount > 0 ? 'group-hover:animate-wobble' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 -mt-1 -mr-1 px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-20 z-40 animate-fadeIn lg:bg-transparent lg:inset-auto lg:absolute">
          <div className="absolute right-0 mt-3 w-96 bg-white rounded-lg shadow-xl overflow-hidden z-50 border border-gray-200 animate-slideInFromTop">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Notificações
                  {unreadCount > 0 && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({unreadCount} não {unreadCount === 1 ? 'lida' : 'lidas'})
                    </span>
                  )}
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={handleMarkAllAsRead}
                    disabled={loading || processingAll || unreadCount === 0}
                    className={`flex items-center text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200 ${
                      (loading || processingAll || unreadCount === 0) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title="Marcar todas como lidas"
                  >
                    {processingAll ? (
                      <Loader className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3 mr-1" />
                    )}
                    <span className="whitespace-nowrap">Marcar todas</span>
                  </button>
                  <button
                    onClick={handleClearAll}
                    disabled={loading || processingAll || notifications.length === 0}
                    className={`flex items-center text-sm text-red-600 hover:text-red-800 transition-colors duration-200 ${
                      (loading || processingAll || notifications.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title="Limpar todas as notificações"
                  >
                    {processingAll ? (
                      <Loader className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3 mr-1" />
                    )}
                    <span className="whitespace-nowrap">Limpar</span>
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                    title="Fechar notificações"
                    aria-label="Fechar notificações"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Mensagem de Sucesso */}
            {successMessage && (
              <div className="p-3 bg-green-50 text-green-700 text-sm border-b border-green-100 animate-slideInFromTop">
                <p className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {successMessage}
                </p>
              </div>
            )}

            {/* Mensagem de Erro */}
            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-sm border-b border-red-100 animate-slideInFromTop">
                <p className="flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {error}
                </p>
              </div>
            )}

            <div className="max-h-[480px] overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">Carregando notificações...</p>
                </div>
              ) : Object.entries(groupedNotifications).length > 0 ? (
                Object.entries(groupedNotifications).map(([date, notifications]) => (
                  <div key={date} className="border-b border-gray-100 last:border-0">
                    <div className="px-4 py-2 bg-gray-50 sticky top-0 z-10">
                      <span className="text-sm font-medium text-gray-600">{date}</span>
                    </div>
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`px-4 py-3 hover:bg-gray-50 transition-colors duration-200 ${
                          notification.read ? 'bg-white' : 'bg-blue-50'
                        } ${processingItems[notification.id] ? 'animate-pulse opacity-70' : ''}`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            {getNotificationIcon(notification.message)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900">{notification.message}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {getRelativeTime(notification.createdAt)}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {!notification.read && (
                              <button
                                onClick={() => handleMarkAsRead(notification.id)}
                                className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-50 transition-colors"
                                title="Marcar como lida"
                                aria-label="Marcar como lida"
                                disabled={processingItems[notification.id] || loading}
                              >
                                {processingItems[notification.id] ? (
                                  <Loader className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(notification.id)}
                              className="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"
                              title="Excluir notificação"
                              aria-label="Excluir notificação"
                              disabled={processingItems[notification.id] || loading}
                            >
                              {processingItems[notification.id] ? (
                                <Loader className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nenhuma notificação</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Adicionar estilizações para animações */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideInFromTop {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes wobble {
          0% { transform: rotate(0); }
          15% { transform: rotate(5deg); }
          30% { transform: rotate(-5deg); }
          45% { transform: rotate(4deg); }
          60% { transform: rotate(-4deg); }
          75% { transform: rotate(2deg); }
          85% { transform: rotate(-2deg); }
          92% { transform: rotate(1deg); }
          100% { transform: rotate(0); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-in-out;
        }
        
        .animate-slideInFromTop {
          animation: slideInFromTop 0.3s ease-out;
        }
        
        .animate-wobble {
          animation: wobble 0.8s ease-in-out;
        }
      `}</style>
    </div>
  );
}