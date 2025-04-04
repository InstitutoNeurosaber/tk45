import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Save, AlertCircle, X } from 'lucide-react';
import { useWebhookStore } from '../stores/webhookStore';
import { useAuthStore } from '../stores/authStore';
import type { WebhookEvent, WebhookConfig } from '../types/webhook';

const webhookEvents: { value: WebhookEvent; label: string }[] = [
  { value: 'ticket.created', label: 'Ticket Criado' },
  { value: 'ticket.updated', label: 'Ticket Atualizado' },
  { value: 'ticket.status_changed', label: 'Status do Ticket Alterado' },
  { value: 'ticket.comment_added', label: 'Comentário Adicionado' },
  { value: 'ticket.assigned', label: 'Ticket Atribuído' },
  { value: 'ticket.deleted', label: 'Ticket Excluído' }
];

// Validação mais robusta da URL
const urlSchema = z.string()
  .min(1, 'URL é obrigatória')
  .url('URL inválida. Exemplo correto: https://webhook.sistemaneurosaber.com.br/webhook/comentario');

// Adiciona validação para garantir que a URL é acessível
const webhookSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  url: urlSchema,
  testUrl: urlSchema.optional().nullable().or(z.literal('')),
  events: z.array(z.enum(['ticket.created', 'ticket.updated', 'ticket.status_changed', 'ticket.comment_added', 'ticket.assigned', 'ticket.deleted'])).min(1, 'Selecione pelo menos um evento'),
  headers: z.record(z.string().min(1, 'Valor não pode ser vazio')).optional(),
  active: z.boolean()
});

type WebhookFormData = z.infer<typeof webhookSchema>;

interface WebhookFormProps {
  webhook?: WebhookConfig;
  onWebhookCreated: () => void;
  onWebhookUpdated?: () => void;
  onCancel?: () => void;
}

export function WebhookForm({ webhook, onWebhookCreated, onWebhookUpdated, onCancel }: WebhookFormProps) {
  const { user } = useAuthStore();
  const { createWebhook, updateWebhook, loading } = useWebhookStore();
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isValidatingUrl, setIsValidatingUrl] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty, isValid }
  } = useForm<WebhookFormData>({
    resolver: zodResolver(webhookSchema),
    defaultValues: {
      active: true,
      events: [],
      headers: {},
      testUrl: null
    },
    mode: 'onChange'
  });

  const currentUrl = watch('url');
  const currentEvents = watch('events');

  // Preencher o formulário quando estiver editando
  useEffect(() => {
    if (webhook) {
      setValue('name', webhook.name);
      setValue('url', webhook.url);
      setValue('testUrl', webhook.testUrl || null);
      setValue('events', webhook.events);
      setValue('headers', webhook.headers || {});
      setValue('active', webhook.active);
    }
  }, [webhook, setValue]);

  // Sugerir correções de URL comum
  useEffect(() => {
    if (!currentUrl || !isDirty) return;

    // Correção para URLs comuns
    if (currentUrl.includes('sistemaneurousaber') && !currentUrl.includes('sistemaneurosaber')) {
      const correctedUrl = currentUrl.replace('sistemaneurousaber', 'sistemaneurosaber');
      setValue('url', correctedUrl, { shouldValidate: true, shouldDirty: true });
      setTestResult({
        success: true,
        message: 'URL corrigida automaticamente: "neurousaber" para "neurosaber"'
      });
    }

    // Correção de caminhos
    if (currentUrl.includes('/webhooks/') && !currentUrl.includes('/webhook/')) {
      const correctedUrl = currentUrl.replace('/webhooks/', '/webhook/');
      setValue('url', correctedUrl, { shouldValidate: true, shouldDirty: true });
      setTestResult({
        success: true,
        message: 'Caminho corrigido automaticamente: "/webhooks/" para "/webhook/"'
      });
    }
  }, [currentUrl, setValue, isDirty]);

  // Verificar se o tipo de evento comentário está selecionado quando a URL contém 'comentario'
  useEffect(() => {
    if (!currentUrl || !isDirty || !Array.isArray(currentEvents)) return;

    if (currentUrl.includes('/comentario') && !currentEvents.includes('ticket.comment_added')) {
      setValue('events', [...currentEvents, 'ticket.comment_added'], { shouldValidate: true });
      setTestResult({
        success: true,
        message: 'Evento "Comentário Adicionado" foi incluído automaticamente com base na URL'
      });
    }
  }, [currentUrl, currentEvents, setValue, isDirty]);

  const onSubmit = async (data: WebhookFormData) => {
    if (!user) {
      setTestResult({
        success: false,
        message: 'Você precisa estar autenticado para criar webhooks'
      });
      return;
    }

    setIsValidatingUrl(true);
    try {
      // Validar URL antes de salvar
      try {
        const validator = await fetch('/.netlify/functions/validate-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: data.url })
        });
        
        if (!validator.ok) {
          const errorText = await validator.text();
          console.warn('Aviso na validação da URL:', errorText);
          // Continuar mesmo se a validação falhar, apenas exibir um aviso
          setTestResult({
            success: true,
            message: 'Webhook salvo, mas a URL pode não estar acessível. O endpoint retornou: ' + errorText
          });
        }
      } catch (validationError) {
        console.warn('Erro ao validar URL:', validationError);
        // Continuar mesmo assim com um aviso
      }

      // Corrigir URLs para formato padrão
      const finalData = {
        ...data,
        url: ensureCorrectUrlFormat(data.url),
        testUrl: data.testUrl ? ensureCorrectUrlFormat(data.testUrl) : undefined
      };

      if (webhook) {
        // Atualizar webhook existente
        await updateWebhook(webhook.id, {
          ...finalData,
          userId: user.uid
        });
        setTestResult({ success: true, message: 'Webhook atualizado com sucesso!' });
        onWebhookUpdated?.();
      } else {
        // Criar novo webhook
        await createWebhook({
          ...finalData,
          userId: user.uid
        });
        setTestResult({ success: true, message: 'Webhook criado com sucesso!' });
        reset();
        onWebhookCreated();
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao salvar webhook'
      });
      console.error('Erro completo ao salvar webhook:', error);
    } finally {
      setIsValidatingUrl(false);
    }
  };

  // Função para garantir que a URL esteja no formato correto
  const ensureCorrectUrlFormat = (url: string): string => {
    let correctedUrl = url;
    
    // Correção de domínio
    if (url.includes('sistemaneurousaber')) {
      correctedUrl = correctedUrl.replace('sistemaneurousaber', 'sistemaneurosaber');
    }
    
    // Correção de caminho
    if (url.includes('/webhooks/')) {
      correctedUrl = correctedUrl.replace('/webhooks/', '/webhook/');
    }
    
    // Garantir que começa com https://
    if (!correctedUrl.startsWith('http')) {
      correctedUrl = 'https://' + correctedUrl;
    }
    
    return correctedUrl;
  };

  return (
    <>
      {testResult && (
        <div className={`p-4 mb-4 rounded-md flex items-start justify-between ${
          testResult.success ? 'bg-green-50' : 'bg-red-50'
        }`}>
          <div className="flex items-start">
            <AlertCircle className={`h-5 w-5 mr-2 mt-0.5 ${
              testResult.success ? 'text-green-500' : 'text-red-500'
            }`} />
            <p className={`text-sm ${
              testResult.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {testResult.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTestResult(null)}
            className="text-gray-500 hover:text-gray-700"
            title="Fechar mensagem"
            aria-label="Fechar mensagem"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Nome <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('name')}
            className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
              errors.name ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            }`}
            placeholder="Nome do webhook (ex: Notificação de Comentários)"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            URL de Produção <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            {...register('url')}
            className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
              errors.url ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            }`}
            placeholder="https://webhook.sistemaneurosaber.com.br/webhook/comentario"
          />
          {errors.url && (
            <p className="mt-1 text-sm text-red-600">{errors.url.message}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Esta é a URL para onde os eventos serão enviados em produção.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            URL de Teste (Opcional)
          </label>
          <input
            type="url"
            {...register('testUrl')}
            className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
              errors.testUrl ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            }`}
            placeholder="https://webhook.test.sistemaneurosaber.com.br/webhook/comentario"
          />
          {errors.testUrl && (
            <p className="mt-1 text-sm text-red-600">{errors.testUrl.message}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Se fornecida, esta URL será usada para testes em vez da URL de produção.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Eventos <span className="text-red-500">*</span>
          </label>
          <Controller
            name="events"
            control={control}
            render={({ field }) => (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {webhookEvents.map((event) => (
                  <label key={event.value} className="inline-flex items-center">
                    <input
                      type="checkbox"
                      value={event.value}
                      checked={field.value.includes(event.value)}
                      onChange={(e) => {
                        const value = e.target.value as WebhookEvent;
                        const newValues = e.target.checked
                          ? [...field.value, value]
                          : field.value.filter((v) => v !== value);
                        field.onChange(newValues);
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm">{event.label}</span>
                  </label>
                ))}
              </div>
            )}
          />
          {errors.events && (
            <p className="mt-1 text-sm text-red-600">{errors.events.message}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Selecione quais eventos serão enviados para este webhook.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Headers (Opcional)
          </label>
          <div className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2">
            <Controller
              name="headers"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                  {Object.entries(field.value || {}).map(([key, value], index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={key}
                        onChange={(e) => {
                          const newHeaders = { ...field.value };
                          delete newHeaders[key];
                          if (e.target.value) {
                            newHeaders[e.target.value] = value;
                          }
                          field.onChange(newHeaders);
                        }}
                        placeholder="Nome do Header"
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      />
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => {
                          field.onChange({
                            ...field.value,
                            [key]: e.target.value
                          });
                        }}
                        placeholder="Valor"
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newHeaders = { ...field.value };
                          delete newHeaders[key];
                          field.onChange(newHeaders);
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      field.onChange({
                        ...field.value,
                        '': ''
                      });
                    }}
                    className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Header
                  </button>
                </div>
              )}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Headers HTTP adicionais que serão enviados com cada requisição.
          </p>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            {...register('active')}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label className="ml-2 text-sm text-gray-900">
            Ativo
          </label>
          <p className="ml-2 text-xs text-gray-500">
            Se desativado, os eventos não serão enviados para este webhook.
          </p>
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={loading || isValidatingUrl}
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            disabled={loading || isSubmitting || isValidatingUrl || !isDirty || !isValid}
          >
            <Save className="h-4 w-4 mr-2" />
            {loading || isValidatingUrl ? 'Salvando...' : 'Salvar Webhook'}
          </button>
        </div>
      </form>
    </>
  );
}