import React, { useState, useEffect } from 'react';
import { AlertTriangle, Eye, Check, Save, Edit2, X, Lock } from 'lucide-react';
import { priorityLabels } from '../../types/ticket';
import { useAuthStore } from '../../stores/authStore';
import { 
  getPlaceholderText, 
  getPriorityLevel,
  getPrioritySuggestions,
  increaseKeywords,
  decreaseKeywords 
} from '../../utils/priorityMessages';
import type { Ticket, TicketPriority } from '../../types/ticket';

interface TicketPriorityProps {
  ticket: Ticket;
  onChange: (priority: TicketPriority, reason?: string) => void;
  disabled: boolean;
}

export function TicketPriority({ ticket, onChange, disabled }: TicketPriorityProps) {
  const { userData } = useAuthStore();
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<TicketPriority>(ticket.priority);
  const [priorityReason, setPriorityReason] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Reseta o estado quando o ticket muda
  useEffect(() => {
    setSelectedPriority(ticket.priority);
    setIsEditing(false);
    setError(null);
  }, [ticket.priority, ticket.id]);

  const isAdmin = userData?.role === 'admin';
  const isIncreasingPriority = getPriorityLevel(selectedPriority) > getPriorityLevel(ticket.priority);
  const suggestions = getPrioritySuggestions(ticket.priority, selectedPriority);
  const priorityChanged = selectedPriority !== ticket.priority;

  const handlePriorityChange = (newPriority: TicketPriority) => {
    if (!isAdmin || disabled) return;
    setSelectedPriority(newPriority);
  };

  const handleSavePriority = () => {
    if (!isAdmin) {
      setError('Apenas administradores podem alterar a prioridade do ticket.');
      return;
    }
    
    if (disabled || !priorityChanged) return;
    
    setShowReasonDialog(true);
    setPriorityReason(''); // Limpa a razão ao abrir o diálogo
  };

  const handleConfirmPriorityChange = () => {
    if (!isAdmin) {
      setError('Apenas administradores podem alterar a prioridade do ticket.');
      return;
    }
    
    if (!priorityReason.trim()) return;
    
    onChange(selectedPriority, priorityReason);
    setShowReasonDialog(false);
    setShowPreview(false);
    setPriorityReason('');
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setSelectedPriority(ticket.priority);
    setIsEditing(false);
    setError(null);
  };

  // Sugere palavras-chave baseadas no tipo de alteração
  const suggestKeywords = () => {
    const keywords = isIncreasingPriority ? increaseKeywords : decreaseKeywords;
    return keywords.slice(0, 5).map(keyword => (
      <button
        key={keyword}
        onClick={() => setPriorityReason(prev => 
          prev ? `${prev} ${keyword}` : keyword
        )}
        className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
      >
        {keyword}
      </button>
    ));
  };

  return (
    <>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Prioridade</h3>
          
          {isAdmin && !disabled && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center text-xs text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Edit2 className="h-3 w-3 mr-1" />
              Editar
            </button>
          )}
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded-r-md mb-2">
            <div className="flex items-start">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
              <p className="ml-2 text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {ticket.priorityLockedBy && (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-md mb-4">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-blue-400 mt-0.5" />
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  A prioridade foi alterada para <strong>{priorityLabels[ticket.priority].toLowerCase()}</strong>
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  Motivo: {ticket.priorityReason}
                </p>
                <p className="mt-2 text-xs text-blue-500">
                  Alterado por {ticket.priorityLockedBy} em {ticket.priorityLockedAt ? new Date(ticket.priorityLockedAt).toLocaleString('pt-BR') : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        {isEditing ? (
          <div className="space-y-3">
            <div className="flex items-center">
              <select
                value={selectedPriority}
                onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
                disabled={disabled || !isAdmin}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:opacity-50"
                aria-label="Selecionar prioridade do ticket"
              >
                {Object.entries(priorityLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={handleSavePriority}
                disabled={!priorityChanged || disabled || !isAdmin}
                className="flex items-center justify-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-3 w-3 mr-1" />
                Salvar
              </button>
              
              <button
                onClick={handleCancelEdit}
                className="flex items-center justify-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-500"
              >
                <X className="h-3 w-3 mr-1" />
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="px-3 py-2 bg-gray-50 rounded-md">
            <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              ticket.priority === 'critical' ? 'bg-red-100 text-red-800' :
              ticket.priority === 'high' ? 'bg-orange-100 text-orange-800' :
              ticket.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {priorityLabels[ticket.priority]}
              {!isAdmin && <Lock className="h-3 w-3 ml-1" aria-label="Bloqueado para edição" />}
            </div>
          </div>
        )}

        {!isAdmin && (
          <p className="mt-2 text-sm text-gray-500 flex items-center">
            <Lock className="h-3 w-3 mr-1 text-gray-400" />
            Apenas administradores podem alterar a prioridade do ticket.
          </p>
        )}
      </div>

      {/* Modal de Justificativa */}
      {showReasonDialog && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="p-6 overflow-y-auto">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Alterar Prioridade do Ticket
              </h3>
              
              {/* Mensagem de alteração */}
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-md mb-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      Você está {isIncreasingPriority ? 'aumentando' : 'diminuindo'} a prioridade de{' '}
                      <strong>{priorityLabels[ticket.priority].toLowerCase()}</strong> para{' '}
                      <strong>{priorityLabels[selectedPriority].toLowerCase()}</strong>
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* Sugestões de justificativas */}
                {suggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                      Selecione uma justificativa ou escreva sua própria:
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => setPriorityReason(suggestion)}
                          className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
                            priorityReason === suggestion
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {suggestions.length > 0 ? 'Ou escreva uma justificativa personalizada:' : 'Justifique a alteração de prioridade:'}
                  </label>
                  <textarea
                    value={priorityReason}
                    onChange={(e) => setPriorityReason(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    rows={4}
                    placeholder={getPlaceholderText(ticket.priority, selectedPriority)}
                  />
                  {!priorityReason.trim() && (
                    <p className="mt-2 text-sm text-red-600">
                      É necessário justificar a alteração de prioridade.
                    </p>
                  )}
                </div>

                {/* Sugestões de palavras-chave */}
                <div>
                  <p className="text-sm text-gray-600 mb-2">Palavras-chave sugeridas:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestKeywords()}
                  </div>
                </div>

                {/* Pré-visualização */}
                {priorityReason.trim() && (
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {showPreview ? 'Ocultar pré-visualização' : 'Pré-visualizar mensagem'}
                    </button>
                    
                    {showPreview && (
                      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-md">
                        <div className="flex items-start">
                          <AlertTriangle className="h-5 w-5 text-blue-400 mt-0.5" />
                          <div className="ml-3">
                            <p className="text-sm text-blue-700">
                              A prioridade foi alterada de <strong>{priorityLabels[ticket.priority].toLowerCase()}</strong>{' '}
                              para <strong>{priorityLabels[selectedPriority].toLowerCase()}</strong>
                            </p>
                            <p className="text-sm text-blue-600 mt-1">
                              Motivo: {priorityReason}
                            </p>
                            <p className="mt-2 text-xs text-blue-500">
                              Alterado por {userData?.name} em {new Date().toLocaleString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Botões de ação */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg border-t flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowReasonDialog(false);
                  setShowPreview(false);
                  setPriorityReason('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmPriorityChange}
                disabled={!priorityReason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar alteração
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}