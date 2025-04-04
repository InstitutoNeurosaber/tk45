import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { KanbanCard } from './KanbanCard';
import { statusLabels } from '../types/ticket';
import type { Ticket, TicketStatus } from '../types/ticket';

interface KanbanColumnProps {
  id: string;
  status: TicketStatus;
  tickets: Ticket[];
  onTicketClick: (ticket: Ticket) => void;
  isOver: boolean;
}

const columnStyles: Record<TicketStatus, string> = {
  open: 'bg-red-50 border-red-200 shadow-red-100',
  in_progress: 'bg-yellow-50 border-yellow-200 shadow-yellow-100',
  resolved: 'bg-blue-50 border-blue-200 shadow-blue-100',
  closed: 'bg-green-50 border-green-200 shadow-green-100'
};

const headerStyles: Record<TicketStatus, string> = {
  open: 'text-red-700 bg-red-100',
  in_progress: 'text-yellow-700 bg-yellow-100',
  resolved: 'text-blue-700 bg-blue-100',
  closed: 'text-green-700 bg-green-100'
};

const countStyles: Record<TicketStatus, string> = {
  open: 'bg-red-200 text-red-800',
  in_progress: 'bg-yellow-200 text-yellow-800',
  resolved: 'bg-blue-200 text-blue-800',
  closed: 'bg-green-200 text-green-800'
};

export function KanbanColumn({ id, status, tickets, onTicketClick, isOver }: KanbanColumnProps) {
  // Configuração simples do droppable
  const { setNodeRef } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        rounded-lg border ${columnStyles[status]} 
        transition-all duration-200 ease-out
        min-h-[calc(100vh-12rem)] flex flex-col
        ${isOver ? 'ring-2 ring-primary/30 shadow-md' : ''}
        relative
        overflow-hidden
      `}
      data-column-id={id}
    >
      <div className={`p-4 rounded-t-lg ${headerStyles[status]} sticky top-0 z-10`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{statusLabels[status]}</h3>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${countStyles[status]}`}>
            {tickets.length}
          </span>
        </div>
      </div>

      <div 
        className={`
          p-4 space-y-3 flex-1 
          ${isOver ? 'bg-primary/5' : ''}
          transition-colors duration-200
          relative
        `}
      >
        {tickets.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-gray-500">Nenhum ticket</p>
          </div>
        )}
        
        {tickets.map((ticket) => (
          <KanbanCard
            key={ticket.id}
            ticket={ticket}
            onClick={() => onTicketClick(ticket)}
          />
        ))}
      </div>
    </div>
  );
}