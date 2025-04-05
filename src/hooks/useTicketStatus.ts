import { useState } from 'react';
import { useTicketStore } from '../stores/ticketStore';
import type { TicketStatus } from '../types/ticket';

export function useTicketStatus() {
  const { updateTicketStatus } = useTicketStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<{status: TicketStatus, timestamp: number} | null>(null);

  const handleStatusChange = async (ticketId: string, newStatus: TicketStatus) => {
    try {
      // Prevenir duplicação de atualizações em um curto período
      if (lastUpdate && lastUpdate.status === newStatus && 
          (Date.now() - lastUpdate.timestamp) < 2000) {
        console.log(`[useTicketStatus] Ignorando atualização duplicada para ${newStatus} (muito rápida)`);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      console.log(`[useTicketStatus] Iniciando atualização de status para ${ticketId}: ${newStatus}`);
      
      await updateTicketStatus(ticketId, newStatus);
      
      // Registrar esta atualização bem-sucedida
      setLastUpdate({
        status: newStatus,
        timestamp: Date.now()
      });
      
      console.log(`[useTicketStatus] Atualização de status concluída com sucesso: ${newStatus}`);
    } catch (error) {
      console.error(`[useTicketStatus] Erro na atualização de status:`, error);
      
      let errorMessage = 'Erro ao atualizar status';
      
      if (error instanceof Error) {
        if (error.message.includes('Status not found')) {
          errorMessage = 'Erro: Status não encontrado no ClickUp. Verifique se você criou os status ABERTO, EM ANDAMENTO, RESOLVIDO e FECHADO na sua lista do ClickUp.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    updateStatus: handleStatusChange
  };
}