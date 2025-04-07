import { useState } from 'react';
import { ticketApi, setApiKey as setStoredApiKey } from '../services/api';
import type { TicketStatus, TicketPriority } from '../types/ticket';
import { useAxios } from '../hooks/useAxios';

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const api = useAxios();

  const handleRequest = async <T>(
    request: Promise<T>,
    errorMessage: string
  ): Promise<T | null> => {
    try {
      setLoading(true);
      setError(null);
      return await request;
    } catch (err) {
      const message = err instanceof Error ? err.message : errorMessage;
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async (newTicket: Omit<Ticket, 'id'>) => {
    try {
      const response = await api.post('/tickets', newTicket);
      return response.data;
    } catch (error) {
      console.error('Error creating ticket:', error);
      throw error;
    }
  };

  const updateStatus = async (ticketId: string, status: TicketStatus) => {
    return handleRequest(
      ticketApi.updateStatus(ticketId, { status }),
      'Erro ao atualizar status'
    );
  };

  const updatePriority = async (ticketId: string, priority: TicketPriority) => {
    return handleRequest(
      ticketApi.updatePriority(ticketId, { priority }),
      'Erro ao atualizar prioridade'
    );
  };

  const deleteTicket = async (ticketId: string) => {
    return handleRequest(
      ticketApi.deleteTicket(ticketId),
      'Erro ao excluir ticket'
    );
  };

  const setApiKey = (apiKey: string) => {
    setStoredApiKey(apiKey);
  };

  return {
    loading,
    error,
    createTicket,
    updateStatus,
    updatePriority,
    deleteTicket,
    setApiKey
  };
}