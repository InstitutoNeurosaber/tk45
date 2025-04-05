import React from 'react';

export function Dashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      <div className="grid gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Bem-vindo ao Painel</h2>
          <p className="text-gray-600">
            Acesse os tickets e gerencia suas configurações através do menu lateral.
          </p>
        </div>
      </div>
    </div>
  );
} 