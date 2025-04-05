import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTickets } from '../../../../contexts/TicketContext';
import { TicketHeader } from './TicketHeader';
import { TicketInfo } from './TicketInfo';
import { TicketActions } from './TicketActions';
import { ChatComments } from '../../../../components/ChatComments';
import { LoadingSpinner } from '../../../../components/LoadingSpinner';

export const TicketDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getTicketById, loading, deleteTicket } = useTickets();
  const ticket = id ? getTicketById(id) : null;

  const handleClose = () => {
    navigate('/tickets');
  };

  const handleDelete = async () => {
    if (!ticket) return;
    
    if (window.confirm('Tem certeza que deseja excluir este ticket?')) {
      try {
        await deleteTicket(ticket.id);
        navigate('/tickets');
      } catch (error) {
        console.error('Erro ao excluir ticket:', error);
      }
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!ticket) {
    return <div className="p-4">Ticket não encontrado</div>;
  }

  return (
    <div className="space-y-6">
      <TicketHeader 
        ticket={ticket} 
        onClose={handleClose}
        onDelete={handleDelete}
      />
      <TicketInfo ticket={ticket} />
      <TicketActions ticket={ticket} />
      <ChatComments ticketId={ticket.id} />
    </div>
  );
}; 