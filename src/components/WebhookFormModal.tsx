import React, { useState } from 'react';
import { X } from 'lucide-react';
import { WebhookForm } from './WebhookForm';
import type { WebhookConfig } from '../types/webhook';

interface WebhookFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  webhook?: WebhookConfig;
  onWebhookCreated: () => void;
  onWebhookUpdated?: () => void;
}

export function WebhookFormModal({
  isOpen,
  onClose,
  webhook,
  onWebhookCreated,
  onWebhookUpdated
}: WebhookFormModalProps) {
  if (!isOpen) return null;

  const handleSuccess = () => {
    if (webhook) {
      onWebhookUpdated?.();
    } else {
      onWebhookCreated();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">
            {webhook ? 'Editar Webhook' : 'Novo Webhook'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
            title="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <WebhookForm
            webhook={webhook}
            onWebhookCreated={handleSuccess}
            onWebhookUpdated={handleSuccess}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
} 