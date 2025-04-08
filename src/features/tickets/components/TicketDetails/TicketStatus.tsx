import React from 'react';
import { statusLabels } from '../../../../types/ticket';
import type { Ticket } from '../../../../types/ticket';
import { useAuthStore } from '../../../../stores/authStore';

interface TicketStatusProps {
  ticket: Ticket;
  onChange: (status: string) => void;
  disabled: boolean;
}

export function TicketStatus({ ticket, onChange, disabled }: TicketStatusProps) {
  const { userData } = useAuthStore();
  const isAdmin = userData?.role === 'admin';
  
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-medium text-gray-900">Status</h3>
      {isAdmin ? (
        <select
          value={ticket.status}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label="Status do ticket"
          title="Status do ticket"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:opacity-50"
        >
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      ) : (
        <div className="mt-1 py-2 px-3 bg-gray-100 rounded-md border border-gray-200">
          <span className="text-gray-700">{statusLabels[ticket.status]}</span>
        </div>
      )}
    </div>
  );
}