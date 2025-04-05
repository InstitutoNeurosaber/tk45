import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Clock, Info, CheckCircle, XCircle } from 'lucide-react';
import { useClickUpStore } from '../stores/clickupStore';
import { useAuthStore } from '../stores/authStore';
import { ClickUpAPI } from '../lib/clickup';
import { ClickUpIntegration } from './ClickUpIntegration';
import { clickupService } from '../services/clickupService';
import { ClickUpConfigTest } from './ClickUpConfigTest';

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
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'warning'>('success');
  const [didAutoVerify, setDidAutoVerify] = useState(false);

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
      console.log('[ClickUpConfig] Iniciando carregamento da configuração para usuário:', user.uid);
      
      // Função para verificar o estado após o carregamento
      const verificarEstado = () => {
        const currentConfig = useClickUpStore.getState().config;
        console.log('[ClickUpConfig] Verificando config após carregamento:', currentConfig);
        
        if (!currentConfig) {
          console.warn('[ClickUpConfig] Configuração não carregada, tentando recuperar do localStorage');
          
          // Tentativa de recuperação manual do localStorage
          try {
            const savedConfig = localStorage.getItem('clickup-config');
            if (savedConfig) {
              const parsedConfig = JSON.parse(savedConfig);
              console.log('[ClickUpConfig] Configuração recuperada do localStorage:', parsedConfig);
              
              if (parsedConfig) {
                // Restaurar manualmente a configuração
                useClickUpStore.setState({
                  config: parsedConfig,
                  selectedWorkspaceId: parsedConfig.workspaceId,
                  selectedSpaceId: parsedConfig.spaceId,
                  selectedListId: parsedConfig.listId
                });
                
                console.log('[ClickUpConfig] Estado restaurado manualmente do localStorage');
              }
            }
          } catch (error) {
            console.error('[ClickUpConfig] Erro ao recuperar dados do localStorage:', error);
          }
        }
        
        setIsLoading(false);
      };
      
      // Carregar configuração do Firestore e depois verificar
      fetchConfig(user.uid)
        .then(() => {
          console.log('[ClickUpConfig] Configuração carregada com sucesso');
          // Verificar após um pequeno delay para garantir que o estado foi atualizado
          setTimeout(verificarEstado, 200);
        })
        .catch(error => {
          console.error('[ClickUpConfig] Erro ao carregar configuração:', error);
          verificarEstado();
        });
    }
  }, [user, fetchConfig]);

  // Preencher formulário com configuração existente e carregar dados relacionados
  useEffect(() => {
    if (config) {
      console.log('[ClickUpConfig] Preenchendo formulário com configuração existente:', config);
      
      // Verificar se todos os campos necessários estão presentes
      if (!config.workspaceId || !config.spaceId || !config.listId) {
        console.warn('[ClickUpConfig] ATENÇÃO: Configuração incompleta detectada ao preencher formulário!', {
          workspaceId: config.workspaceId || 'AUSENTE',
          spaceId: config.spaceId || 'AUSENTE',
          listId: config.listId || 'AUSENTE'
        });
      }
      
      // Atualizar valores do formulário
      reset({
        apiKey: config.apiKey,
        workspaceId: config.workspaceId,
        spaceId: config.spaceId,
        listId: config.listId,
        active: config.active
      });
      
      // Salvar no localStorage como fallback de segurança
      try {
        localStorage.setItem('clickup-config', JSON.stringify(config));
        console.log('[ClickUpConfig] Configuração salva no localStorage como backup');
      } catch (error) {
        console.error('[ClickUpConfig] Erro ao salvar configuração no localStorage:', error);
      }
      
      // Verificar se os valores foram definidos corretamente
      setTimeout(() => {
        const formValues = {
          apiKey: watch('apiKey'),
          workspaceId: watch('workspaceId'),
          spaceId: watch('spaceId'),
          listId: watch('listId'),
          active: watch('active')
        };
        console.log('[ClickUpConfig] Valores do formulário após reset:', formValues);
        
        // Verificar se os valores do formulário correspondem à configuração
        const missingFields = [];
        if (formValues.apiKey !== config.apiKey) missingFields.push('apiKey');
        if (formValues.workspaceId !== config.workspaceId) missingFields.push('workspaceId');
        if (formValues.spaceId !== config.spaceId) missingFields.push('spaceId');
        if (formValues.listId !== config.listId) missingFields.push('listId');
        
        if (missingFields.length > 0) {
          console.warn('[ClickUpConfig] ATENÇÃO: Valores do formulário não correspondem à configuração:', missingFields);
          
          // Tentar corrigir manualmente
          if (missingFields.includes('workspaceId') && config.workspaceId) {
            setValue('workspaceId', config.workspaceId);
          }
          if (missingFields.includes('spaceId') && config.spaceId) {
            setValue('spaceId', config.spaceId);
          }
          if (missingFields.includes('listId') && config.listId) {
            setValue('listId', config.listId);
          }
        }
      }, 300);
      
      // Carregar dados relacionados
      loadClickUpData(config.apiKey, config.workspaceId, config.spaceId);
    } else {
      console.log('[ClickUpConfig] Nenhuma configuração encontrada para preencher o formulário');
    }
  }, [config, reset, loadClickUpData, watch, setValue]);

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

  // Função para verificar a lista do ClickUp
  const verifyClickUpList = async () => {
    try {
      setIsLoading(true);
      setTestResult(null);
      
      if (!config?.listId) {
        setTestResult({
          success: false,
          message: 'Por favor, configure o ID da lista primeiro'
        });
        return;
      }
      
      // Testar conexão com a API do ClickUp
      const listId = config.listId;
      try {
        console.log(`[ClickUpConfig] Testando conexão com a lista ${listId}...`);
        // Criar instância da API diretamente para testes específicos
        const clickup = new ClickUpAPI(config.apiKey);
        
        // Verificar se a lista existe
        let listData: any;
        try {
          // Primeiro tentar obter dados da lista diretamente
          listData = await clickup.getList(listId);
        } catch (e) {
          // Se o método direto falhar, usar o método indireto para obter a lista
          const listsResponse = await clickup.getLists(config.spaceId || '');
          listData = listsResponse.lists.find((l: any) => l.id === listId);
          
          if (!listData) {
            throw new Error(`Lista com ID ${listId} não encontrada`);
          }
        }
        
        console.log(`[ClickUpConfig] Lista encontrada: ${listData.name}`);
        
        // Verificar os status disponíveis na lista
        if (listData && listData.statuses && Array.isArray(listData.statuses)) {
          const availableStatuses = listData.statuses.map((s: any) => s.status);
          console.log(`[ClickUpConfig] Status disponíveis na lista ${listId}:`, availableStatuses);
          
          // Status que devem existir no ClickUp para o funcionamento da integração
          const requiredStatuses = ['aberto', 'em andamento', 'resolvido', 'fechado'];
          
          // Verificar se todos os status necessários estão disponíveis (case insensitive)
          const missingStatuses = requiredStatuses.filter(status => 
            !availableStatuses.some((availableStatus: string) => 
              availableStatus.toLowerCase() === status.toLowerCase()
            )
          );
          
          if (missingStatuses.length > 0) {
            setTestResult({
              success: false,
              message: `Atenção: Os seguintes status estão faltando na lista do ClickUp: ${missingStatuses.join(', ')}. ` +
                      `Você precisa criar estes status exatamente com estes nomes para que a sincronização funcione corretamente. ` +
                      `Status encontrados: ${availableStatuses.join(', ')}`
            });
          } else {
            setTestResult({
              success: true,
              message: `Lista verificada com sucesso! Todos os status necessários foram encontrados: ${requiredStatuses.join(', ')}`
            });
          }
        } else {
          // Se não conseguimos obter os status, verificamos se a lista existe tentando buscar tarefas
          await clickup.getAllTasks(listId);
          setTestResult({
            success: true,
            message: `Lista verificada com sucesso! ID: ${listId}. Não foi possível verificar os status - verifique manualmente se os status aberto, em andamento, resolvido e fechado existem.`
          });
        }
      } catch (apiError) {
        console.error("[ClickUpConfig] Erro ao testar lista:", apiError);
        
        let errorMessage = "Erro ao verificar lista do ClickUp";
        if (apiError instanceof Error) {
          if (apiError.message.includes("not found") || apiError.message.includes("404")) {
            errorMessage = `A lista com ID ${listId} não foi encontrada no ClickUp. Verifique se o ID está correto.`;
          } else if (apiError.message.includes("unauthorized") || apiError.message.includes("401")) {
            errorMessage = "API Key inválida ou sem permissão para acessar a lista. Verifique suas credenciais.";
          } else {
            errorMessage = apiError.message;
          }
        }
        
        setTestResult({
          success: false,
          message: errorMessage
        });
      }
    } catch (error) {
      console.error("[ClickUpConfig] Erro geral em verifyClickUpList:", error);
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Erro ao verificar configuração do ClickUp"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const onSubmit = async (data: ConfigFormData) => {
    if (!user) {
      console.error('[ClickUpConfig] Tentativa de salvar configuração sem usuário autenticado');
      return;
    }

    console.log('[ClickUpConfig] Salvando configuração com dados:', data);

    try {
      setTestResult(null); // Limpar resultados anteriores
      
      // Verificar se todos os campos importantes estão preenchidos
      if (!data.workspaceId || !data.spaceId || !data.listId) {
        console.warn('[ClickUpConfig] ATENÇÃO: Tentando salvar configuração incompleta!', {
          workspaceId: data.workspaceId || 'AUSENTE',
          spaceId: data.spaceId || 'AUSENTE',
          listId: data.listId || 'AUSENTE'
        });
        
        if (!window.confirm(
          'Configuração incompleta! Pelo menos um dos campos obrigatórios está faltando: ' +
          'Workspace, Space ou Lista. Deseja continuar mesmo assim?'
        )) {
          setTestResult({
            success: false,
            message: 'Operação cancelada. Por favor, preencha todos os campos obrigatórios.'
          });
          return;
        }
      }
      
      // Primeiro, verificar se conseguimos acessar a lista configurada
      try {
        setTestResult({
          success: true,
          message: 'Verificando acesso à lista configurada...'
        });
        
        const clickup = new ClickUpAPI(data.apiKey);
        await clickup.getAllTasks(data.listId);
        
        // Lista verificada com sucesso, prosseguir com o salvamento
        setTestResult({
          success: true,
          message: 'Lista verificada com sucesso! Salvando configuração...'
        });
      } catch (error) {
        // Erro ao verificar lista, perguntar se deseja prosseguir mesmo assim
        if (!window.confirm(
          `Erro ao verificar lista (${error instanceof Error ? error.message : 'Erro desconhecido'}). ` +
          'A lista pode não existir ou você pode não ter acesso a ela. ' +
          'Deseja salvar a configuração mesmo assim?'
        )) {
          setTestResult({
            success: false,
            message: 'Operação cancelada pelo usuário.'
          });
          return;
        }
      }
      
      // Registrar que estamos salvando
      setTestResult({
        success: true,
        message: 'Salvando configuração...'
      });
      
      const configToSave = {
        ...data,
        userId: user.uid
      };
      console.log('[ClickUpConfig] Dados finais a serem salvos:', configToSave);
      
      await saveConfig(configToSave);
      
      setTestResult({
        success: true,
        message: 'Configuração salva com sucesso!'
      });
      
      // Verificar se a configuração foi salva corretamente
      setTimeout(() => {
        const storeConfig = useClickUpStore.getState().config;
        console.log('[ClickUpConfig] Configuração atual no store após salvamento:', storeConfig);
      }, 500);
    } catch (error) {
      console.error('[ClickUpConfig] Erro ao salvar configuração:', error);
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao salvar configuração'
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

  const handleTestarStatusClickUp = async () => {
    setIsLoading(true);
    setMessage('');
    
    try {
      console.log("[ClickUpConfig] Testando status do ClickUp");
      
      // Verificar se o ClickUp está configurado
      const isConfigured = await clickupService.isConfigured();
      if (!isConfigured) {
        setMessage("ClickUp não está configurado. Configure a API Key e List ID primeiro.");
        setMessageType("error");
        return;
      }
      
      // Obter a configuração atual
      const configAtual = await clickupService['getConfig']();
      if (!configAtual || !configAtual.listId) {
        setMessage("Configuração incompleta. Verifique se o List ID está definido.");
        setMessageType("error");
        return;
      }
      
      // Obter a API
      const api = await clickupService['getAPI']();
      
      // Verificar os status disponíveis na lista
      try {
        console.log(`[ClickUpConfig] Obtendo tarefas da lista ${configAtual.listId} para verificar status`);
        const tasks = await api.getAllTasks(configAtual.listId);
        
        // Extrair os status disponíveis
        const availableStatuses = new Set<string>();
        if (tasks && tasks.tasks && Array.isArray(tasks.tasks)) {
          tasks.tasks.forEach((task: any) => {
            if (task.status && task.status.status) {
              availableStatuses.add(task.status.status);
            }
          });
        }
        
        // Status que devem existir no ClickUp
        const requiredStatuses = ['aberto', 'em andamento', 'resolvido', 'fechado'];
        
        // Verificar se todos os status necessários estão disponíveis (case insensitive)
        const missingStatuses = requiredStatuses.filter(status => 
          !availableStatuses.has(status)
        );
        
        if (missingStatuses.length > 0) {
          setMessage(`Atenção: Os seguintes status estão faltando no ClickUp: ${missingStatuses.join(', ')}. Isso pode causar erros ao atualizar tarefas.`);
          setMessageType("warning");
        } else {
          setMessage(`Configuração de status OK! Todos os status necessários foram encontrados: ${requiredStatuses.join(', ')}`);
          setMessageType("success");
        }
        
        console.log("[ClickUpConfig] Status disponíveis no ClickUp:", [...availableStatuses]);
      } catch (error) {
        console.error("[ClickUpConfig] Erro ao verificar status:", error);
        setMessage(`Erro ao verificar status: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        setMessageType("error");
      }
    } catch (error) {
      console.error("[ClickUpConfig] Erro ao testar status:", error);
      setMessage(`Erro ao testar status: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  // Verificar automaticamente a lista quando a configuração estiver carregada
  useEffect(() => {
    // Verificar apenas uma vez por sessão para evitar chamadas desnecessárias à API
    if (config && config.listId && config.apiKey && !didAutoVerify && !isLoading) {
      console.log('[ClickUpConfig] Verificando lista automaticamente:', config.listId);
      setDidAutoVerify(true);
      verifyClickUpList();
    }
  }, [config, isLoading, didAutoVerify]);

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center space-x-2 mb-4">
          <Clock className="h-6 w-6 text-blue-600" />
          <h2 className="text-lg font-medium text-gray-900">Configuração do ClickUp</h2>
        </div>

        {/* Resultados do teste */}
        {testResult && (
          <div className={`mt-6 p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-start">
              {testResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
              )}
              <div>
                <p className={testResult.success ? 'text-green-800' : 'text-red-800'}>
                  {testResult.message}
                </p>
              </div>
            </div>
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <div className="flex justify-between items-center">
                <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
                  API Key
                </label>
                <button
                  type="button"
                  onClick={testConnection}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Testar Conexão
                </button>
              </div>
              <div className="mt-1">
                <input
                  id="apiKey"
                  {...register('apiKey')}
                  type="text"
                  className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                    errors.apiKey ? 'border-red-300' : ''
                  }`}
                  placeholder="Informe sua API Key do ClickUp"
                />
                {errors.apiKey && (
                  <p className="mt-1 text-sm text-red-600">{errors.apiKey.message}</p>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                <a 
                  href="https://app.clickup.com/settings/apps" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  Obtenha sua API Key aqui →
                </a>
              </p>
            </div>

            <div>
              <label htmlFor="workspaceId" className="block text-sm font-medium text-gray-700">
                Workspace
              </label>
              <div className="mt-1">
                <select
                  id="workspaceId"
                  {...register('workspaceId')}
                  onChange={handleWorkspaceChange}
                  className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                    errors.workspaceId ? 'border-red-300' : ''
                  }`}
                  disabled={isLoading || workspaces.length === 0}
                >
                  <option value="">Selecione um Workspace</option>
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
              {workspaces.length === 0 && apiKey && (
                <p className="mt-1 text-xs text-yellow-600">
                  Nenhum workspace encontrado. Verifique sua API Key.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="spaceId" className="block text-sm font-medium text-gray-700">
                Space
              </label>
              <div className="mt-1">
                <select
                  id="spaceId"
                  {...register('spaceId')}
                  onChange={handleSpaceChange}
                  className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                    errors.spaceId ? 'border-red-300' : ''
                  }`}
                  disabled={isLoading || spaces.length === 0 || !selectedWorkspaceId}
                >
                  <option value="">Selecione um Space</option>
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
              {spaces.length === 0 && selectedWorkspaceId && (
                <p className="mt-1 text-xs text-yellow-600">
                  Nenhum space encontrado neste workspace.
                </p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center">
                <label htmlFor="listId" className="block text-sm font-medium text-gray-700">
                  Lista
                </label>
                {watch('listId') && (
                  <button
                    type="button"
                    onClick={verifyClickUpList}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Verificar Lista
                  </button>
                )}
              </div>
              <div className="mt-1">
                <select
                  id="listId"
                  {...register('listId')}
                  className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                    errors.listId ? 'border-red-300' : ''
                  }`}
                  disabled={isLoading || lists.length === 0 || !selectedSpaceId}
                >
                  <option value="">Selecione uma Lista</option>
                  {lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name} - ID: {list.id}
                    </option>
                  ))}
                </select>
                {errors.listId && (
                  <p className="mt-1 text-sm text-red-600">{errors.listId.message}</p>
                )}
              </div>
              {lists.length === 0 && selectedSpaceId && (
                <p className="mt-1 text-xs text-yellow-600">
                  Nenhuma lista encontrada neste space.
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                <Info className="inline-block h-3 w-3 mr-1" />
                As tarefas serão criadas nesta lista no ClickUp
              </p>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <input
                  id="active"
                  type="checkbox"
                  {...register('active')}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="active" className="text-sm font-medium text-gray-700">
                  Integração Ativa
                </label>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Quando ativa, os tickets serão automaticamente sincronizados com o ClickUp
              </p>
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

        {/* Adicionar onde for apropriado no JSX */}
        <button
          onClick={handleTestarStatusClickUp}
          className="mt-4 inline-flex items-center px-4 py-2 border border-blue-600 rounded-md shadow-sm text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          disabled={isLoading}
        >
          <span className="mr-2">🔍</span>
          Verificar Status do ClickUp
        </button>
      </div>

      {config && !isLoading && (
        <div className="bg-white p-6 rounded-lg shadow">
          <ClickUpIntegration />
        </div>
      )}

      {/* Adicionar a seção de testes */}
      {config && !isLoading && (
        <div>
          <ClickUpConfigTest />
        </div>
      )}

      {/* Teste de Status */}
      {config?.listId && config?.apiKey && (
        <StatusTester 
          listId={config.listId} 
          apiKey={config.apiKey}
        />
      )}
    </div>
  );
}

// Componente adicional para listar e testar status
function StatusTester({ listId, apiKey }: { listId: string; apiKey: string }) {
  const [loading, setLoading] = useState(false);
  const [statusList, setStatusList] = useState<Array<{status: string}>>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const requiredStatuses = ['aberto', 'em andamento', 'resolvido', 'fechado'];
  
  const loadStatus = async () => {
    if (!listId || !apiKey) {
      setErrorMessage('Configure o ID da lista e a API Key primeiro');
      return;
    }
    
    try {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      
      console.log('[StatusTester] Carregando status para a lista:', listId);
      const api = new ClickUpAPI(apiKey);
      
      try {
        const listData = await api.getList(listId);
        
        if (listData && listData.statuses) {
          console.log('[StatusTester] Status encontrados:', listData.statuses);
          setStatusList(listData.statuses);
          
          // Verificar status faltantes
          const availableStatuses = listData.statuses.map(s => s.status);
          const missingStatuses = requiredStatuses.filter(status => 
            !availableStatuses.some((availableStatus: string) => 
              availableStatus.toLowerCase() === status.toLowerCase()
            )
          );
          
          if (missingStatuses.length > 0) {
            setErrorMessage(`Faltam os seguintes status no ClickUp: ${missingStatuses.join(', ')}`);
          } else {
            setSuccessMessage('Todos os status necessários estão presentes no ClickUp!');
          }
        } else {
          setErrorMessage('Não foi possível carregar os status desta lista');
        }
      } catch (error) {
        console.error('[StatusTester] Erro ao carregar lista:', error);
        
        // Tentar método alternativo com tarefas
        try {
          console.log('[StatusTester] Tentando método alternativo com tarefas');
          const tasks = await api.getAllTasks(listId);
          
          // Extrair os status disponíveis das tarefas
          const availableStatuses = new Set<string>();
          if (tasks && tasks.tasks && Array.isArray(tasks.tasks)) {
            tasks.tasks.forEach((task: any) => {
              if (task.status && task.status.status) {
                availableStatuses.add(task.status.status);
              }
            });
            
            if (availableStatuses.size > 0) {
              // Converter para o formato esperado
              setStatusList([...availableStatuses].map(status => ({ status })));
              
              // Verificar status faltantes
              const missingStatuses = requiredStatuses.filter(status => 
                ![...availableStatuses].some((availableStatus: string) => 
                  availableStatus.toLowerCase() === status.toLowerCase()
                )
              );
              
              if (missingStatuses.length > 0) {
                setErrorMessage(`Faltam os seguintes status no ClickUp: ${missingStatuses.join(', ')}`);
              } else {
                setSuccessMessage('Todos os status necessários estão presentes no ClickUp!');
              }
            } else {
              setErrorMessage('Não foi possível encontrar nenhum status nas tarefas');
            }
          }
        } catch (taskError) {
          console.error('[StatusTester] Erro no método alternativo:', taskError);
          setErrorMessage(error instanceof Error ? error.message : 'Erro desconhecido');
        }
      }
    } catch (error) {
      console.error('[StatusTester] Erro ao carregar status:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };
  
  // Carregar status automaticamente ao montar o componente e quando listId ou apiKey mudarem
  useEffect(() => {
    if (listId && apiKey) {
      loadStatus();
    }
  }, [listId, apiKey]);
  
  const getMissingStatuses = () => {
    const availableStatuses = statusList.map(s => s.status);
    return requiredStatuses.filter(status => 
      !availableStatuses.some((availableStatus: string) => 
        availableStatus.toLowerCase() === status.toLowerCase()
      )
    );
  };
  
  // Esta função depende da API do ClickUp permitir criar status, o que pode não ser possível via API
  // Mantida como exemplo, mas pode exigir criação manual no ClickUp
  const createStatusInClickUp = async (statusName: string) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      
      // NOTA: Este endpoint pode não existir na API do ClickUp
      // A API atual (v2) não suporta criar status diretamente
      // Esta é uma implementação conceitual
      
      /*
      const api = new ClickUpAPI(apiKey);
      await api.request(`/list/${listId}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status: statusName
        })
      });
      */
      
      // Como provavelmente não é possível criar status via API, sugerimos manualmente
      setSuccessMessage(`Para criar o status "${statusName}", acesse o ClickUp, vá até a lista e adicione manualmente`);
      
      // Recarregar a lista após criar
      await loadStatus();
    } catch (error) {
      console.error('Erro ao criar status:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };
  
  const missingStatuses = getMissingStatuses();
  
  return (
    <div className="mt-6 p-6 bg-white rounded-lg shadow-md">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Diagnóstico de Status do ClickUp</h3>
      
      {loading && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-600 flex items-center">
          <div className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
          Verificando status no ClickUp...
        </div>
      )}
      
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600">
          {errorMessage}
        </div>
      )}
      
      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-600">
          {successMessage}
        </div>
      )}
      
      <div className="mb-4">
        <h4 className="font-medium text-gray-700 mb-2">Status Necessários</h4>
        <div className="flex flex-wrap gap-2">
          {requiredStatuses.map(status => (
            <span 
              key={status}
              className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                statusList.some(s => s.status.toLowerCase() === status.toLowerCase())
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {status}
            </span>
          ))}
        </div>
      </div>
      
      <div className="mb-4">
        <h4 className="font-medium text-gray-700 mb-2">Status Atuais na Lista</h4>
        {statusList.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {statusList.map((status, idx) => (
              <span key={idx} className="px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {status.status}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Nenhum status encontrado ou ainda não carregado</p>
        )}
      </div>
      
      {missingStatuses.length > 0 ? (
        <div className="mb-4">
          <h4 className="font-medium text-red-600 mb-2">Status que precisam ser criados</h4>
          <div className="space-y-2">
            {missingStatuses.map(status => (
              <div key={status} className="flex items-center">
                <span className="text-red-600 font-medium mr-2">{status}</span>
                <button
                  onClick={() => createStatusInClickUp(status)}
                  disabled={loading}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Instruções para criar
                </button>
              </div>
            ))}
          </div>
          <p className="mt-4 text-gray-600 text-sm">
            <strong>Importante:</strong> É necessário criar manualmente cada status no ClickUp para que a sincronização funcione corretamente. 
            Acesse a sua lista no ClickUp, vá até as configurações e adicione os status listados acima com exatamente os mesmos nomes.
          </p>
        </div>
      ) : statusList.length > 0 ? (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-green-600">Todos os status necessários estão configurados! A sincronização deve funcionar corretamente.</p>
        </div>
      ) : null}
      
      <div className="mt-4">
        <button
          onClick={loadStatus}
          disabled={loading || !listId || !apiKey}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
        >
          {loading ? 'Carregando...' : 'Recarregar Status'}
        </button>
      </div>
    </div>
  );
}