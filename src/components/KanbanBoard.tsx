import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  useDraggable,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { 
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { useTicketStore } from '../stores/ticketStore';
import type { Ticket, TicketStatus } from '../types/ticket';

interface KanbanBoardProps {
  tickets: Ticket[];
  onTicketClick: (ticket: Ticket) => void;
  onTicketMove?: (ticketId: string, status: TicketStatus) => void;
}

const statusColumns: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

export function KanbanBoard({ tickets: initialTickets, onTicketClick, onTicketMove }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<{ ticketId: string; status: TicketStatus } | null>(null);
  const { updateTicketStatus, optimisticUpdateStatus } = useTicketStore();

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 8,
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 50,
      tolerance: 8,
    },
  });

  const sensors = useSensors(mouseSensor, touchSensor);

  const getTicketsByStatus = (status: TicketStatus) => {
    return initialTickets.filter(ticket => ticket.status === status);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    console.log('Iniciando drag:', active.id);
    document.body.style.cursor = 'grabbing';
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over) {
      console.log('Não está sobre nada');
      return;
    }

    console.log('Drag over:', over.id);
    
    const activeTicket = initialTickets.find(t => t.id === active.id);
    const overId = over.id as string;

    if (!activeTicket) return;

    if (typeof overId === 'string' && overId.startsWith('column-')) {
      const overColumn = overId.replace('column-', '') as TicketStatus;
      
      console.log('Sobre coluna:', overColumn);
      
      if (overColumn !== activeTicket.status) {
        console.log('Mudando status de', activeTicket.status, 'para', overColumn);
        setPendingStatus({ ticketId: activeTicket.id, status: overColumn });
        optimisticUpdateStatus(activeTicket.id, overColumn);
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    console.log('[KanbanBoard] Drag end');
    const { active, over } = event;
    document.body.style.cursor = '';

    if (!over) {
      console.log('[KanbanBoard] Sem destino válido');
      resetDragState();
      return;
    }

    console.log('[KanbanBoard] Destino final:', over.id);
    
    if (!pendingStatus) {
      console.log('[KanbanBoard] Sem mudança de status pendente');
      resetDragState();
      return;
    }

    const activeTicket = initialTickets.find(t => t.id === active.id);
    if (!activeTicket) {
      console.log('[KanbanBoard] Ticket ativo não encontrado');
      resetDragState();
      return;
    }

    if (activeTicket.status === pendingStatus.status) {
      console.log(`[KanbanBoard] Status não mudou (${activeTicket.status}), ignorando operação`);
      resetDragState();
      return;
    }

    console.log(`[KanbanBoard] Atualizando ticket ${pendingStatus.ticketId} de status ${activeTicket.status} para ${pendingStatus.status}`);

    try {
      console.log('[KanbanBoard] Iniciando updateTicketStatus via store');
      await updateTicketStatus(pendingStatus.ticketId, pendingStatus.status);
      
      if (onTicketMove) {
        console.log('[KanbanBoard] Notificando callback onTicketMove');
        onTicketMove(pendingStatus.ticketId, pendingStatus.status);
      }
      
      console.log('[KanbanBoard] Atualização de status concluída com sucesso');
    } catch (error) {
      console.error('[KanbanBoard] Erro ao mover ticket:', error);
      
      console.log('[KanbanBoard] Revertendo atualização otimista para', activeTicket.status);
      optimisticUpdateStatus(activeTicket.id, activeTicket.status);
    }

    resetDragState();
  };

  const handleDragCancel = () => {
    console.log('Drag cancelado');
    if (pendingStatus) {
      const ticket = initialTickets.find(t => t.id === pendingStatus.ticketId);
      if (ticket) {
        optimisticUpdateStatus(ticket.id, ticket.status);
      }
    }
    resetDragState();
  };

  const resetDragState = () => {
    setActiveId(null);
    setPendingStatus(null);
    document.body.style.cursor = '';
  };

  const activeTicket = activeId ? initialTickets.find(t => t.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-4 min-h-[calc(100vh-12rem)]">
        {statusColumns.map((status) => (
          <KanbanColumn
            key={status}
            id={`column-${status}`}
            status={status}
            tickets={getTicketsByStatus(status)}
            onTicketClick={onTicketClick}
            isOver={pendingStatus?.status === status}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{
        duration: 100,
        easing: 'cubic-bezier(0.2, 0, 0.15, 1)',
      }}>
        {activeId && activeTicket ? (
          <div className="shadow-md transform scale-[1.02]">
            <KanbanCard
              ticket={activeTicket}
              isDragging={true}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}