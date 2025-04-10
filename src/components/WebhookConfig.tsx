import React, { useEffect, useState } from 'react';
import { Webhook, Clock as ClickUp, Code, TestTube, Plus, Mail } from 'lucide-react';
import { useWebhookStore } from '../stores/webhookStore';
import { useAuthStore } from '../stores/authStore';
import { WebhookFormModal } from './WebhookFormModal';
import { WebhookList } from './WebhookList';
import { WebhookTest } from './WebhookTest';
import { ClickUpConfig } from './ClickUpConfig';
import { ApiDocs } from './ApiDocs';
import { N8nDocs } from './N8nDocs';
import { SystemTest } from './SystemTest';
import { EmailTemplatesTab } from '../features/webhooks/components/EmailTemplates/EmailTemplatesTab';
import type { WebhookConfig as WebhookConfigType } from '../types/webhook';
import { TabsList, TabsTrigger } from './ui/tabs';

export function WebhookConfig() {
  const [activeTab, setActiveTab] = React.useState<'webhooks' | 'clickup' | 'api' | 'n8n' | 'test' | 'email'>('webhooks');
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfigType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuthStore();
  const { fetchWebhooks } = useWebhookStore();

  useEffect(() => {
    if (user) {
      fetchWebhooks(user.uid);
    }
  }, [user, fetchWebhooks]);

  const handleWebhookCreated = async () => {
    if (user) {
      await fetchWebhooks(user.uid);
    }
  };

  const handleWebhookUpdated = async () => {
    if (user) {
      await fetchWebhooks(user.uid);
      setEditingWebhook(null);
    }
  };

  const handleWebhookDeleted = async () => {
    if (user) {
      await fetchWebhooks(user.uid);
    }
  };

  const handleEdit = (webhook: WebhookConfigType) => {
    setEditingWebhook(webhook);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingWebhook(null);
  };

  const handleOpenCreateModal = () => {
    setEditingWebhook(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('webhooks')}
            className={`${
              activeTab === 'webhooks'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Webhook className="h-5 w-5 mr-2" />
            Webhooks
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`${
              activeTab === 'email'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Mail className="h-5 w-5 mr-2" />
            Templates de Email
          </button>
          <button
            onClick={() => setActiveTab('clickup')}
            className={`${
              activeTab === 'clickup'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <ClickUp className="h-5 w-5 mr-2" />
            ClickUp
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`${
              activeTab === 'api'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Code className="h-5 w-5 mr-2" />
            API
          </button>
          <button
            onClick={() => setActiveTab('n8n')}
            className={`${
              activeTab === 'n8n'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Code className="h-5 w-5 mr-2" />
            n8n
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`${
              activeTab === 'test'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <TestTube className="h-5 w-5 mr-2" />
            Teste do Sistema
          </button>
        </nav>
      </div>

      {activeTab === 'webhooks' ? (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Webhooks</h2>
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Webhook
            </button>
          </div>
          <WebhookTest />
          <WebhookList 
            onWebhookDeleted={handleWebhookDeleted}
            onEdit={handleEdit}
          />
          <WebhookFormModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            webhook={editingWebhook || undefined}
            onWebhookCreated={handleWebhookCreated}
            onWebhookUpdated={handleWebhookUpdated}
          />
        </>
      ) : activeTab === 'email' ? (
        <EmailTemplatesTab />
      ) : activeTab === 'clickup' ? (
        <ClickUpConfig />
      ) : activeTab === 'api' ? (
        <ApiDocs />
      ) : activeTab === 'n8n' ? (
        <N8nDocs />
      ) : (
        <SystemTest />
      )}
    </div>
  );
}