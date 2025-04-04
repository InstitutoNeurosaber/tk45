import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Clock, Info } from 'lucide-react';
import { useClickUpStore } from '../stores/clickupStore';
import { useAuthStore } from '../stores/authStore';
import { ClickUpAPI } from '../lib/clickup';
import { ClickUpIntegration } from './ClickUpIntegration';

const configSchema = z.object({
  apiKey: z.string().min(1, 'API Key é obrigatória'),
  workspaceId: z.string().min(1, 'Workspace é obrigatório'),
  spaceId: z.string().min(1, 'Space é obrigatório'),
  listId: z.string().min(1, 'Lista é obrigatória'),
  active: z.boolean()
});

type ConfigFormData = z.infer<typeof configSchema>;

export function ClickUpConfig() {
  const { user } = useAuthStore();
  const { config, fetchConfig, saveConfig, loading } = useClickUpStore();
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string }>>([]);
  const [spaces, setSpaces] = useState<Array<{ id: string; name: string }>>([]);
  const [lists, setLists] = useState<Array<{ id: string; name: string }>>([]);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Inicializar form com valores padrão completos se config existir
  const defaultValues = {
    active: config?.active ?? true,
    apiKey: config?.apiKey ?? '',
    workspaceId: config?.workspaceId ?? '',
    spaceId: config?.spaceId ?? '',
    listId: config?.listId ?? ''
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
    defaultValues,
    // Importante: definir mode para onChange para reagir imediatamente às mudanças
    mode: 'onChange'
  });

  const apiKey = watch('apiKey');
  const selectedWorkspaceId = watch('workspaceId');
  const selectedSpaceId = watch('spaceId');

  // Função para carregar dados do ClickUp
  const loadClickUpData = useCallback(async (apiKeyToUse: string, workspaceId?: string, spaceId?: string) => {
    if (!apiKeyToUse) return;
    
    try {
      setIsLoading(true);
      const clickup = new ClickUpAPI(apiKeyToUse);
      
      // Carregar workspaces
      const { teams } = await clickup.getWorkspaces();
      setWorkspaces(teams);

      // Carregar spaces se houver workspaceId
      if (workspaceId) {
        const { spaces } = await clickup.getSpaces(workspaceId);
        setSpaces(spaces);
      }

      // Carregar lists se houver spaceId
      if (spaceId) {
        const { lists } = await clickup.getLists(spaceId);
        setLists(lists);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do ClickUp:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Carregar configuração existente
  useEffect(() => {
    if (user) {
      fetchConfig(user.uid).then(() => {
        setIsLoading(false);
      });
    }
  }, [user, fetchConfig]);

  // Preencher formulário com configuração existente e carregar dados relacionados
  useEffect(() => {
    if (config) {
      // Atualizar valores do formulário
      reset({
        apiKey: config.apiKey,
        workspaceId: config.workspaceId,
        spaceId: config.spaceId,
        listId: config.listId,
        active: config.active
      });
      
      // Carregar dados relacionados
      loadClickUpData(config.apiKey, config.workspaceId, config.spaceId);
    }
  }, [config, reset, loadClickUpData]);

  // Carregar workspaces quando a API key mudar
  useEffect(() => {
    const fetchWorkspaces = async () => {
      if (!apiKey) return;

      try {
        const clickup = new ClickUpAPI(apiKey);
        const { teams } = await clickup.getWorkspaces();
        setWorkspaces(teams);
      } catch (error) {
        console.error('Erro ao buscar workspaces:', error);
        setWorkspaces([]);
      }
    };

    if (apiKey) {
      fetchWorkspaces();
    }
  }, [apiKey]);

  // Carregar spaces quando o workspace mudar
  useEffect(() => {
    const fetchSpaces = async () => {
      if (!apiKey || !selectedWorkspaceId) return;

      try {
        const clickup = new ClickUpAPI(apiKey);
        const { spaces } = await clickup.getSpaces(selectedWorkspaceId);
        setSpaces(spaces);
      } catch (error) {
        console.error('Erro ao buscar spaces:', error);
        setSpaces([]);
      }
    };

    if (apiKey && selectedWorkspaceId) {
      fetchSpaces();
    }
  }, [apiKey, selectedWorkspaceId]);

  // Carregar lists quando o space mudar
  useEffect(() => {
    const fetchLists = async () => {
      if (!apiKey || !selectedSpaceId) return;

      try {
        const clickup = new ClickUpAPI(apiKey);
        const { lists } = await clickup.getLists(selectedSpaceId);
        setLists(lists);
      } catch (error) {
        console.error('Erro ao buscar listas:', error);
        setLists([]);
      }
    };

    if (apiKey && selectedSpaceId) {
      fetchLists();
    }
  }, [apiKey, selectedSpaceId]);

  const onSubmit = async (data: ConfigFormData) => {
    if (!user) return;

    try {
      setTestResult(null); // Limpar resultados anteriores
      
      // Registrar que estamos salvando
      setTestResult({
        success: true,
        message: 'Salvando configuração...'
      });
      
      await saveConfig({
        ...data,
        userId: user.uid
      });
      
      setTestResult({
        success: true,
        message: 'Configuração salva com sucesso!'
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao salvar configuração'
      });
    }
  };

  // Função para testar a conexão com o ClickUp
  const testConnection = async () => {
    if (!apiKey) {
      setTestResult({
        success: false,
        message: 'Forneça uma API Key para testar a conexão'
      });
      return;
    }

    try {
      setTestResult({
        success: true,
        message: 'Testando conexão...'
      });

      const clickup = new ClickUpAPI(apiKey);
      const { teams } = await clickup.getWorkspaces();
      
      setTestResult({
        success: true,
        message: `Conexão bem-sucedida! ${teams.length} workspace(s) encontrado(s).`
      });
      
      // Atualizar a lista de workspaces com os resultados obtidos
      setWorkspaces(teams);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao testar conexão com o ClickUp'
      });
    }
  };

  // Função para lidar com mudanças no workspace
  const handleWorkspaceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const workspaceId = e.target.value;
    setValue('workspaceId', workspaceId);
    setValue('spaceId', '');
    setValue('listId', '');
    setSpaces([]);
    setLists([]);
  };

  // Função para lidar com mudanças no space
  const handleSpaceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const spaceId = e.target.value;
    setValue('spaceId', spaceId);
    setValue('listId', '');
    setLists([]);
  };

  // Determinar se o botão deve ser desativado
  const isSaveDisabled = loading || isLoading;

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center space-x-2 mb-4">
          <Clock className="h-6 w-6 text-blue-600" />
          <h2 className="text-lg font-medium text-gray-900">Configuração do ClickUp</h2>
        </div>

        {testResult && (
          <div className={`p-4 mb-4 rounded-md ${
            testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            <p className="text-sm">{testResult.message}</p>
          </div>
        )}

        {!config && !isLoading && (
          <div className="bg-blue-50 p-4 mb-4 rounded-md">
            <div className="flex">
              <Info className="h-5 w-5 text-blue-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Integração com o ClickUp</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    Configure sua API Key do ClickUp para permitir a sincronização de tickets com as tarefas do ClickUp.
                    Você precisa selecionar um workspace, space e lista existentes no ClickUp para onde os tickets serão sincronizados.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="py-10 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-2 text-gray-600">Carregando configurações...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                API Key
              </label>
              <div className="flex space-x-2">
                <input
                  type="password"
                  {...register('apiKey')}
                  className="mt-1 flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={testConnection}
                  className="mt-1 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Testar Conexão
                </button>
              </div>
              {errors.apiKey && (
                <p className="mt-1 text-sm text-red-600">{errors.apiKey.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Encontre sua API Key nas configurações do ClickUp. <a href="https://app.clickup.com/settings/profile" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Ver instruções</a>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Workspace
              </label>
              <select
                {...register('workspaceId')}
                onChange={handleWorkspaceChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={selectedWorkspaceId || ""}
              >
                <option value="">Selecione um workspace</option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
              {errors.workspaceId && (
                <p className="mt-1 text-sm text-red-600">{errors.workspaceId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Space
              </label>
              <select
                {...register('spaceId')}
                onChange={handleSpaceChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                disabled={!selectedWorkspaceId}
                value={selectedSpaceId || ""}
              >
                <option value="">Selecione um space</option>
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
              {errors.spaceId && (
                <p className="mt-1 text-sm text-red-600">{errors.spaceId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Lista
              </label>
              <select
                {...register('listId')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                disabled={!selectedSpaceId}
                value={watch('listId') || ""}
              >
                <option value="">Selecione uma lista</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
              {errors.listId && (
                <p className="mt-1 text-sm text-red-600">{errors.listId.message}</p>
              )}
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
            </div>

            <div>
              <button
                type="submit"
                disabled={isSaveDisabled}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-5 w-5 mr-2" />
                {loading ? 'Salvando...' : 'Salvar Configuração'}
              </button>
            </div>
          </form>
        )}
      </div>

      {config && !isLoading && (
        <div className="bg-white p-6 rounded-lg shadow">
          <ClickUpIntegration />
        </div>
      )}
    </div>
  );
}