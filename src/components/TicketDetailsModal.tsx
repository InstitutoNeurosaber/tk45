import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, 
  User, 
  Link as LinkIcon, 
  Save, 
  Edit2, 
  AlertTriangle, 
  X,
  Calendar,
  Tag,
  ExternalLink,
  Trash2,
  Plus,
  RefreshCw,
  XCircle,
  MessageSquare
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTicketStore } from '../stores/ticketStore';
import { useAuthStore } from '../stores/authStore';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { statusLabels, priorityLabels, categoryLabels } from '../types/ticket';
import type { Ticket, TicketStatus, TicketPriority } from '../types/ticket';
import { clickupService } from '../services/clickupService';
import { Comments } from './Comments';

interface TicketDetailsModalProps {
  ticket: Ticket;
  onClose: () => void;
  onStatusChange: (ticketId: string, status: TicketStatus) => void;
  onUpdate: (ticket: Ticket) => void;
}

export function TicketDetailsModal({ ticket, onClose, onStatusChange, onUpdate }: TicketDetailsModalProps) {
  const navigate = useNavigate();
  const { userData } = useAuthStore();
  const { updateTicket, deleteTicket, syncWithClickUp } = useTicketStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<TicketStatus>(ticket.status);
  const [currentPriority, setCurrentPriority] = useState<TicketPriority>(ticket.priority);
  const [description, setDescription] = useState(ticket.description);
  const [priorityReason, setPriorityReason] = useState('');
  const [userData2, setUserData2] = useState<{ name: string; email: string; role?: string } | null>(null);
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [extensionHours, setExtensionHours] = useState(24); // Padrão: 24 horas
  const [extensionReason, setExtensionReason] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [clickUpSyncLoading, setClickUpSyncLoading] = useState(false);
  const [clickUpSyncError, setClickUpSyncError] = useState<string | null>(null);
  const [clickUpSyncSuccess, setClickUpSyncSuccess] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', ticket.userId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData2(data as { name: string; email: string; role?: string });
        }
      } catch (error) {
        console.error('Erro ao buscar dados do usuário:', error);
      }
    };

    fetchUserData();
  }, [ticket.userId]);

  const handleDelete = async () => {
    try {
      setLoading(true);
      await deleteTicket(ticket.id);
      onClose();
    } catch (error) {
      console.error('Erro ao excluir ticket:', error);
      setError('Erro ao excluir ticket. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    try {
      setLoading(true);
      setError(null);
      setCurrentStatus(newStatus);
      await onStatusChange(ticket.id, newStatus);
      onUpdate({
        ...ticket,
        status: newStatus,
        updatedAt: new Date()
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao atualizar status');
      setCurrentStatus(ticket.status);
    } finally {
      setLoading(false);
    }
  };

  const handlePriorityChange = async (newPriority: TicketPriority) => {
    if (userData?.role !== 'admin' && ticket.priorityLockedBy) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setCurrentPriority(newPriority);

      const updates: Partial<Ticket> = {
        priority: newPriority,
        updatedAt: new Date()
      };

      if (userData?.role === 'admin') {
        updates.priorityLockedBy = userData.name;
        updates.priorityLockedAt = new Date();
        updates.priorityReason = priorityReason || 'não foi identificada urgência na situação';
      }

      await updateTicket(ticket.id, updates);
      onUpdate({ ...ticket, ...updates });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao atualizar prioridade');
      setCurrentPriority(ticket.priority);
    } finally {
      setLoading(false);
    }
  };

  const handleDescriptionChange = async (newDescription: string) => {
    try {
      setLoading(true);
      setError(null);
      await updateTicket(ticket.id, { description: newDescription });
      onUpdate({ ...ticket, description: newDescription });
      setIsEditing(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao atualizar descrição');
    } finally {
      setLoading(false);
    }
  };

  const handleExtendDeadline = async () => {
    try {
      setLoading(true);
      setError(null);

      const currentDeadline = new Date(ticket.deadline);
      const newDeadline = new Date(currentDeadline.getTime() + (extensionHours * 60 * 60 * 1000));

      await updateTicket(ticket.id, {
        deadline: newDeadline,
        deadlineHistory: [
          ...(ticket.deadlineHistory || []),
          {
            oldDeadline: currentDeadline,
            newDeadline,
            reason: extensionReason,
            extendedBy: userData?.name || 'Sistema',
            extendedAt: new Date()
          }
        ]
      });

      onUpdate({
        ...ticket,
        deadline: newDeadline,
        deadlineHistory: [
          ...(ticket.deadlineHistory || []),
          {
            oldDeadline: currentDeadline,
            newDeadline,
            reason: extensionReason,
            extendedBy: userData?.name || 'Sistema',
            extendedAt: new Date()
          }
        ]
      });

      setShowDeadlineModal(false);
      setExtensionHours(24);
      setExtensionReason('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao estender prazo');
    } finally {
      setLoading(false);
    }
  };

  const formatDeadline = (date: Date) => {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isOverdue = (deadline: Date) => {
    return new Date() > new Date(deadline);
  };

  const handleSyncWithClickUp = async () => {
    try {
      setClickUpSyncLoading(true);
      setClickUpSyncError(null);
      
      console.log(`[TicketDetailsModal] Iniciando sincronização com ClickUp para o ticket: ${ticket.id}`);
      
      // Verificar se o ClickUp está configurado
      try {
        const isConfigured = await clickupService.isConfigured();
        if (!isConfigured) {
          console.error('[TicketDetailsModal] ClickUp não está configurado corretamente');
          setClickUpSyncError('O ClickUp não está configurado corretamente. Verifique as configurações.');
          setClickUpSyncLoading(false);
          return;
        }
      } catch (configError) {
        console.error('[TicketDetailsModal] Erro ao verificar configuração:', configError);
        setClickUpSyncError('Erro ao verificar configuração do ClickUp. Verifique se as credenciais estão corretas.');
        setClickUpSyncLoading(false);
        return;
      }
      
      // Sincronizar o ticket
      try {
        console.log('[TicketDetailsModal] Chamando syncWithClickUp');
        const updatedTicket = await syncWithClickUp(ticket);
        if (updatedTicket && updatedTicket.taskId) {
          console.log(`[TicketDetailsModal] Sincronização bem-sucedida. taskId: ${updatedTicket.taskId}`);
          setClickUpSyncSuccess(true);
          setTimeout(() => setClickUpSyncSuccess(false), 3000);
          onUpdate(updatedTicket);
        } else {
          console.error('[TicketDetailsModal] Retorno vazio da sincronização');
          throw new Error('A sincronização não retornou uma tarefa válida');
        }
      } catch (syncError) {
        console.error('[TicketDetailsModal] Erro de sincronização:', syncError);
        throw syncError; // Propagar o erro para ser tratado abaixo
      }
    } catch (error) {
      console.error('[TicketDetailsModal] Exceção na sincronização:', error);
      
      let errorMessage = 'Erro ao sincronizar com ClickUp.';
      
      if (error instanceof Error) {
        // Detectar erro específico de status não encontrado
        if (error.message.includes('Status not found') || 
            error.message.includes('Problema com o status') || 
            error.message.includes('Status não encontrado')) {
          errorMessage = 'Erro: Os status no ClickUp não correspondem aos necessários. ' +
                        'Verifique se sua lista do ClickUp possui os status: ABERTO, EM ANDAMENTO, RESOLVIDO e FECHADO. ' +
                        'Crie esses status exatamente com esses nomes na sua lista do ClickUp.';
        } else if (error.message.includes('não foi encontrada') || 
                  error.message.includes('não encontrada') || 
                  error.message.includes('Lista não encontrada')) {
          errorMessage = 'Erro: A lista configurada não foi encontrada no ClickUp. ' +
                        'Verifique o ID da lista nas configurações do ClickUp.';
        } else if (error.message.includes('404')) {
          errorMessage = 'Erro 404: Recurso não encontrado. ' +
                       'Isso pode indicar que a tarefa ainda não existe no ClickUp ou que há um problema com o ID da lista.';
        } else if (error.message.includes('API Key inválida') || 
                  error.message.includes('401')) {
          errorMessage = 'Erro: API Key do ClickUp inválida ou expirada. ' +
                       'Verifique suas configurações e atualize a API Key.';
        } else if (error.message.includes('sem permissão') || 
                  error.message.includes('403')) {
          errorMessage = 'Erro: Sem permissão para acessar a lista no ClickUp. ' +
                       'Verifique se sua API Key tem permissões suficientes.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setClickUpSyncError(errorMessage);
    } finally {
      setClickUpSyncLoading(false);
    }
  };

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-red-600">Erro</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500" title="Fechar">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-gray-500">{error}</p>
          <button
            onClick={onClose}
            className="mt-4 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[85vh] overflow-hidden mb-8">
          {/* Cabeçalho */}
          <div className="relative px-8 py-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">{ticket.title}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                    ticket.status === 'open' ? 'bg-red-100 text-red-800' :
                    ticket.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                    ticket.status === 'resolved' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {statusLabels[ticket.status]}
                  </span>

                  {/* Status de sincronização com ClickUp */}
                  {ticket.taskId ? (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-green-50 text-green-600">
                      <LinkIcon className="h-3.5 w-3.5 mr-1" />
                      Sincronizado com ClickUp
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                      <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                      Não sincronizado com ClickUp
                    </span>
                  )}

                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                    ticket.priority === 'low' ? 'bg-gray-100 text-gray-800' :
                    ticket.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
                    ticket.priority === 'high' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {priorityLabels[ticket.priority]}
                  </span>
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                    <Tag className="w-4 h-4 mr-1.5" />
                    {categoryLabels[ticket.category]}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {/* Botão de sincronização com ClickUp - mostrar apenas se não tiver taskId */}
                {ticket.id && !ticket.taskId && (
                  <div className="flex-1">
                    <button
                      onClick={handleSyncWithClickUp}
                      disabled={clickUpSyncLoading}
                      className={`inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md ${
                        clickUpSyncSuccess 
                          ? 'bg-green-600 text-white hover:bg-green-700' 
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      } disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200`}
                      title="Sincronizar com ClickUp"
                    >
                      {clickUpSyncLoading ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : clickUpSyncSuccess ? (
                        <>
                          <LinkIcon className="h-4 w-4 mr-2" />
                          Sincronizado
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Sincronizar com ClickUp
                        </>
                      )}
                    </button>
                  </div>
                )}
                
                {ticket.taskId && (
                  <a
                    href={`https://app.clickup.com/t/${ticket.taskId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    <LinkIcon className="h-4 w-4 mr-1 inline-block" />
                    Abrir no ClickUp
                  </a>
                )}
                
                <button
                  onClick={() => setDeleteModalOpen(true)}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                  title="Excluir ticket"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </button>
                <button
                  onClick={onClose}
                  className="inline-flex items-center justify-center w-12 h-12 rounded-full text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all duration-200 border border-gray-200"
                  title="Fechar detalhes"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Mensagem de erro do ClickUp */}
          {clickUpSyncError && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <XCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Erro na sincronização</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{clickUpSyncError}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Conteúdo */}
          <div className="flex h-[calc(90vh-180px)]">
            {/* Coluna Principal - 65% */}
            <div className="w-[65%] p-8 overflow-y-auto border-r border-gray-200">
              {/* Descrição */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Descrição</h3>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                    >
                      <Edit2 className="h-4 w-4 mr-1.5" />
                      Editar
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-4">
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full h-48 p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="Descreva o ticket..."
                    />
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setDescription(ticket.description);
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleDescriptionChange(description)}
                        disabled={loading}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{description || "Sem descrição disponível."}</p>
                )}
              </div>
              
              {/* Comentários */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <MessageSquare className="h-5 w-5 text-gray-500 mr-2" />
                  Comentários
                </h3>
                <div className="max-h-[400px]">
                  <Comments ticket={ticket} />
                </div>
              </div>
            </div>

            {/* Barra Lateral - 35% */}
            <div className="w-[35%] p-8 bg-gray-50 overflow-y-auto">
              <div className="space-y-6">
                {/* Informações do Ticket */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Informações</h3>
                  <div className="space-y-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="w-5 h-5 mr-3 text-gray-400" />
                      <span>Criado por {userData2?.name || 'Carregando...'}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-5 h-5 mr-3 text-gray-400" />
                      <span>Em {new Date(ticket.createdAt).toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="w-5 h-5 mr-3 text-gray-400" />
                      <div className="flex flex-col">
                        <span>Prazo: {formatDeadline(ticket.deadline)}</span>
                        {isOverdue(ticket.deadline) && (
                          <span className="text-red-600 text-xs mt-1">Atrasado</span>
                        )}
                      </div>
                      {userData?.role === 'admin' && (
                        <button
                          onClick={() => setShowDeadlineModal(true)}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                          title="Estender prazo"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {ticket.taskId && (
                      <div className="flex items-center text-sm text-blue-600">
                        <ExternalLink className="w-5 h-5 mr-3" />
                        <span>ID da Tarefa: {ticket.taskId}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Status</h3>
                  <div className="relative text-gray-600 mb-2">
                    <select
                      id="ticketStatus"
                      value={currentStatus}
                      onChange={(e) => setCurrentStatus(e.target.value as TicketStatus)}
                      disabled={loading}
                      className="block appearance-none w-full bg-white border border-gray-300 hover:border-gray-400 px-4 py-2 pr-8 rounded shadow leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Status do ticket"
                    >
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Prioridade */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Prioridade</h3>
                  {ticket.priorityLockedBy && (
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-md mb-4">
                      <div className="flex items-start">
                        <AlertTriangle className="h-5 w-5 text-blue-400 mt-0.5" />
                        <div className="ml-3">
                          <p className="text-sm text-blue-700">
                            Alterada para <strong>{priorityLabels[ticket.priority].toLowerCase()}</strong>
                            {ticket.priorityReason && (
                              <>, pois {ticket.priorityReason}</>
                            )}
                          </p>
                          <p className="mt-1 text-xs text-blue-600">
                            Por {ticket.priorityLockedBy} em{' '}
                            {new Date(ticket.priorityLockedAt!).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="relative text-gray-600 mb-4">
                    <select
                      id="ticketPriority"
                      value={currentPriority}
                      onChange={(e) => setCurrentPriority(e.target.value as TicketPriority)}
                      disabled={loading}
                      className="block appearance-none w-full bg-white border border-gray-300 hover:border-gray-400 px-4 py-2 pr-8 rounded shadow leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Prioridade do ticket"
                    >
                      {Object.entries(priorityLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  {userData?.role === 'admin' && currentPriority !== ticket.priority && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Motivo da alteração
                      </label>
                      <input
                        type="text"
                        value={priorityReason}
                        onChange={(e) => setPriorityReason(e.target.value)}
                        placeholder="Ex: não foi identificada urgência na situação"
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Histórico de Extensões de Prazo */}
                {ticket.deadlineHistory && ticket.deadlineHistory.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Histórico de Prazos</h3>
                    <div className="space-y-4">
                      {ticket.deadlineHistory.map((history, index) => (
                        <div key={index} className="border-l-2 border-blue-200 pl-4">
                          <p className="text-sm text-gray-600">
                            Prazo estendido de {formatDeadline(history.oldDeadline)} para{' '}
                            {formatDeadline(history.newDeadline)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Por {history.extendedBy} em {formatDeadline(history.extendedAt)}
                          </p>
                          {history.reason && (
                            <p className="text-xs text-gray-600 mt-1">
                              Motivo: {history.reason}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div className="bg-gray-50 px-8 py-6 flex justify-end items-center border-t border-gray-200">
            <button
              onClick={onClose}
              className="inline-flex items-center px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
            >
              <X className="w-4 h-4 mr-2" />
              Fechar
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Extensão de Prazo */}
      {showDeadlineModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Estender Prazo
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prazo Atual
                  </label>
                  <p className="text-sm text-gray-600">
                    {formatDeadline(ticket.deadline)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Extensão (em horas)
                  </label>
                  <select
                    value={extensionHours}
                    onChange={(e) => setExtensionHours(Number(e.target.value))}
                    className="block w-full p-2 border border-gray-300 rounded-md mb-4"
                    title="Horas de extensão do prazo"
                  >
                    <option value={4}>4 horas</option>
                    <option value={8}>8 horas</option>
                    <option value={12}>12 horas</option>
                    <option value={24}>24 horas</option>
                    <option value={48}>48 horas</option>
                    <option value={72}>72 horas</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Motivo da Extensão
                  </label>
                  <textarea
                    value={extensionReason}
                    onChange={(e) => setExtensionReason(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    rows={3}
                    placeholder="Explique o motivo da extensão do prazo..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Novo Prazo
                  </label>
                  <p className="text-sm text-gray-600">
                    {formatDeadline(new Date(ticket.deadline.getTime() + (extensionHours * 60 * 60 * 1000)))}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-end space-x-3">
              <button
                onClick={() => setShowDeadlineModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancelar
              </button>
              <button
                onClick={handleExtendDeadline}
                disabled={!extensionReason.trim() || loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Confirmar Extensão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Excluir Ticket"
        message="Tem certeza que deseja excluir este ticket? Esta ação não pode ser desfeita."
      />
    </>
  );
}