import React, { useState } from 'react';
import { LayoutList, Kanban, Archive, X as ArchiveX } from 'lucide-react';
import { KanbanBoard } from './KanbanBoard';
import { TicketCard } from './TicketCard';
import { useAuthStore } from '../stores/authStore';
import { useViewStore } from '../stores/viewStore';
import type { Ticket, TicketStatus } from '../types/ticket';

interface TicketListProps {
  tickets: Ticket[];
  onTicketClick: (ticket: Ticket) => void;
  onDeleteTicket?: (ticketId: string) => void;
  onStatusChange?: (ticketId: string, status: TicketStatus) => void;
}

export function TicketList({ tickets, onTicketClick, onDeleteTicket, onStatusChange }: TicketListProps) {
  const { viewMode, setViewMode } = useViewStore();
  const [showArchived, setShowArchived] = useState(false);
  const { userData } = useAuthStore();
  
  // Filtra os tickets arquivados, baseado na opção selecionada
  const filteredTickets = tickets.filter(ticket => showArchived || !ticket.archived);

  const isOverdue = (deadline?: Date) => {
    if (!deadline) return false;
    return new Date() > new Date(deadline);
  };

  const getTimeRemaining = (deadline?: Date) => {
    if (!deadline) return 'Sem prazo definido';

    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diff = deadlineDate.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (diff < 0) {
      return 'Atrasado';
    }
    if (days > 0) {
      return `${days}d ${hours}h restantes`;
    }
    if (hours > 0) {
      return `${hours}h restantes`;
    }
    return 'Menos de 1h restante';
  };

  // Handler para mudança de modo de visualização que salva na store
  const handleViewModeChange = (mode: 'list' | 'kanban') => {
    setViewMode(mode);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Tickets ({filteredTickets.length})
          </h2>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
            title={showArchived ? 'Ocultar tickets arquivados' : 'Mostrar tickets arquivados'}
          >
            {showArchived ? (
              <>
                <ArchiveX className="h-3 w-3 mr-1" />
                Ocultar arquivados
              </>
            ) : (
              <>
                <Archive className="h-3 w-3 mr-1" />
                Mostrar arquivados
              </>
            )}
          </button>
        </div>
        
        <div className="flex space-x-2 items-center">
          <button 
            onClick={() => handleViewModeChange('list')}
            className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
            title="Visualização em lista"
          >
            <LayoutList className="h-5 w-5" />
          </button>
          <button 
            onClick={() => handleViewModeChange('kanban')}
            className={`p-2 rounded-md ${viewMode === 'kanban' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
            title="Visualização em kanban"
          >
            <Kanban className="h-5 w-5" />
          </button>
        </div>
      </div>

      {viewMode === 'list' ?
        <div className="grid grid-cols-1 gap-6">
          {filteredTickets.length > 0 ? (
            filteredTickets.map(ticket => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onClick={() => onTicketClick(ticket)}
                onDelete={userData?.role === 'admin' ? () => onDeleteTicket?.(ticket.id) : undefined}
                statusOptions={userData?.role === 'admin' ? true : false}
                onStatusChange={onStatusChange ? 
                  (status) => onStatusChange(ticket.id, status) : undefined
                }
                isOverdue={isOverdue}
                getTimeRemaining={getTimeRemaining}
              />
            ))
          ) : (
            <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400">
                Nenhum ticket encontrado
              </p>
            </div>
          )}
        </div>
      :
        <KanbanBoard 
          tickets={filteredTickets} 
          onTicketClick={onTicketClick} 
          onTicketMove={onStatusChange}
        />
      }
    </div>
  );
}