import React from 'react';
import { ComentarioWebhookTeste } from '../components/ComentarioWebhookTeste';
import { useAuthStore } from '../stores/authStore';

export function Dashboard() {
  const { user, userData } = useAuthStore();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      <div className="grid gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Teste de Webhooks</h2>
          <ComentarioWebhookTeste />
        </div>
      </div>
    </div>
  );
} 