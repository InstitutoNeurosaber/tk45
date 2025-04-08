import React from 'react';
import { Archive, Clock, Link, Mail, Trash2, ChevronDown, Eye } from 'lucide-react';
import { statusLabels, priorityLabels, statusColors, priorityColors } from '../types/ticket';
import type { Ticket, TicketStatus } from '../types/ticket';

interface TicketCardProps {
  ticket: Ticket;
  onClick: () => void;
  onDelete?: () => void;
  statusOptions?: boolean;
  onStatusChange?: (status: TicketStatus) => void;
  isOverdue: (deadline?: Date) => boolean;
  getTimeRemaining: (deadline?: Date) => string;
}

export function TicketCard({
  ticket,
  onClick,
  onDelete,
  statusOptions = false,
  onStatusChange,
  isOverdue,
  getTimeRemaining
}: TicketCardProps) {
  const [showStatusMenu, setShowStatusMenu] = React.useState(false);
  const statusMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
        setShowStatusMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div 
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200 
        ${ticket.archived ? 'bg-gray-50 dark:bg-gray-800/50' : ''}`}
    >
      <div 
        className="p-4 cursor-pointer relative"
        onClick={onClick}
      >
        {/* Badge de arquivado se necessário */}
        {ticket.archived && (
          <div className="absolute top-3 right-3 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs px-2 py-1 rounded-full flex items-center">
            <Archive className="h-3 w-3 mr-1" />
            Arquivado
          </div>
        )}
        
        {/* Título do ticket */}
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2 pr-8">
          {ticket.title}
        </h3>
        
        {/* Descrição */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
          {ticket.description}
        </p>
        
        {/* Rodapé com meta informações */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {/* Status */}
          <div className="relative">
            {statusOptions ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowStatusMenu(!showStatusMenu);
                }}
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[ticket.status]} focus:outline-none`}
              >
                {statusLabels[ticket.status]}
                <ChevronDown className="h-3 w-3 ml-1" />
              </button>
            ) : (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[ticket.status]}`}>
                {statusLabels[ticket.status]}
              </span>
            )}
            
            {showStatusMenu && (
              <div 
                ref={statusMenuRef}
                className="absolute left-0 mt-1 w-40 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-10"
              >
                <div className="py-1" role="menu" aria-orientation="vertical">
                  {(Object.keys(statusLabels) as Array<TicketStatus>).map(status => (
                    <button
                      key={status}
                      className={`block w-full text-left px-4 py-2 text-sm ${
                        status === ticket.status 
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' 
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onStatusChange) {
                          onStatusChange(status);
                        }
                        setShowStatusMenu(false);
                      }}
                    >
                      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${statusColors[status].replace('text-', 'bg-')}`}></span>
                      {statusLabels[status]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Prioridade */}
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${priorityColors[ticket.priority]}`}>
            {priorityLabels[ticket.priority]}
          </span>
          
          {/* Prazo */}
          {ticket.deadline && (
            <span className={`inline-flex items-center text-xs ${
              isOverdue(ticket.deadline) ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
            }`}>
              <Clock className="h-3 w-3 mr-1" />
              {getTimeRemaining(ticket.deadline)}
            </span>
          )}
          
          {/* Links externos */}
          <div className="flex space-x-2">
            {ticket.taskId && (
              <span className="inline-flex items-center text-xs text-blue-600 dark:text-blue-400">
                <Link className="h-3 w-3 mr-1" />
                #{ticket.taskId}
              </span>
            )}
            
            {ticket.gmailId && (
              <span className="inline-flex items-center text-xs text-red-600 dark:text-red-400">
                <Mail className="h-3 w-3 mr-1" />
                #{ticket.gmailId}
              </span>
            )}
          </div>
        </div>
        
        {/* Botões de ação */}
        <div className="absolute top-3 right-3 flex space-x-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            title="Ver detalhes"
          >
            <Eye className="h-5 w-5" />
          </button>
          
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-gray-400 hover:text-red-600 dark:hover:text-red-500"
              title="Excluir ticket"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 