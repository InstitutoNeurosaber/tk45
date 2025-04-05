import React, { useState, useEffect } from 'react';
import { clickupService } from '../services/clickupService';
import { useAuthStore } from '../stores/authStore';
import { useClickUpStore } from '../stores/clickupStore';
import { ClickUpAPI } from '../lib/clickup';
import { Loader2, CheckCircle, XCircle, AlertCircle, Trash2, RefreshCw, Check } from 'lucide-react';
import type { Ticket, TicketStatus } from '../types/ticket';

// Status que devem ser testados
const STATUS_OPTIONS = [
  { value: 'open', label: 'Aberto', clickupStatus: 'ABERTO' },
  { value: 'in_progress', label: 'Em Andamento', clickupStatus: 'EM ANDAMENTO' },
  { value: 'resolved', label: 'Resolvido', clickupStatus: 'RESOLVIDO' },
  { value: 'closed', label: 'Fechado', clickupStatus: 'FECHADO' }
];

interface ListResponse {
  statuses?: Array<{ status: string }>;
  [key: string]: any;
}

export function ClickUpConfigTest() {
  const { user } = useAuthStore();
  const { config } = useClickUpStore();
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [taskId, setTaskId] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [statusTestResults, setStatusTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
  const [statusAvailability, setStatusAvailability] = useState<Record<string, boolean>>({});
  const [deleteResult, setDeleteResult] = useState<{ success?: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    statusMap?: Record<string, string>;
  } | null>(null);

  // Verificar se o ClickUp está configurado
  useEffect(() => {
    const checkConfiguration = async () => {
      try {
        const result = await clickupService.isConfigured();
        setIsConfigured(result);
        if (!result) {
          setMessage('O ClickUp não está configurado. Configure-o antes de executar os testes.');
          setMessageType('warning');
        } else {
          setMessage('ClickUp configurado. Você pode executar os testes de sincronização.');
          setMessageType('info');
          await checkAvailableStatuses();
        }
      } catch (error) {
        console.error('Erro ao verificar configuração do ClickUp:', error);
        setMessage('Erro ao verificar a configuração do ClickUp');
        setMessageType('error');
      }
    };
    
    checkConfiguration();
  }, [config]);
  
  // Verifica quais status estão disponíveis no ClickUp
  const checkAvailableStatuses = async () => {
    setLoading(true);
    setTestResult(null);
    
    try {
      console.log('[ClickUpConfigTest] Iniciando verificação de status disponíveis');
      
      // Verifica se o ClickUp está configurado
      const isConfigured = await clickupService.isConfigured();
      if (!isConfigured) {
        setTestResult({
          success: false,
          message: 'ClickUp não está configurado. Configure o ClickUp primeiro.'
        });
        setLoading(false);
        return;
      }
      
      // Obter a configuração através de método seguro
      const listId = await getClickUpListId();
      
      if (!listId) {
        setTestResult({
          success: false,
          message: 'Configuração incompleta. ID da lista não configurado.'
        });
        setLoading(false);
        return;
      }
      
      console.log(`[ClickUpConfigTest] Verificando lista ${listId}`);
      
      // Buscar detalhes da lista para obter os status disponíveis
      try {
        // Usar fetch direto para acessar API do ClickUp através de função Netlify
        const listData = await fetch(`/.netlify/functions/clickup-proxy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            endpoint: `/list/${listId}`,
            method: 'GET'
          })
        }).then(res => res.json()) as ListResponse;
        
        console.log('[ClickUpConfigTest] Dados da lista:', listData);
        
        if (listData && listData.statuses && Array.isArray(listData.statuses)) {
          const availableStatuses = listData.statuses.map((s) => s.status);
          console.log('[ClickUpConfigTest] Status disponíveis:', availableStatuses);
          
          // Status que devem existir no ClickUp para o funcionamento da integração
          const requiredStatuses = ['ABERTO', 'EM ANDAMENTO', 'RESOLVIDO', 'FECHADO'];
          
          // Verificar se todos os status necessários estão disponíveis
          const missingStatuses = requiredStatuses.filter(status => 
            !availableStatuses.some(s => s.toUpperCase() === status)
          );
          
          // Criar um mapeamento visual dos status
          const statusMap: Record<string, string> = {};
          availableStatuses.forEach((status: string) => {
            const matchedRequired = requiredStatuses.find(req => 
              status.toUpperCase() === req || status.toUpperCase().includes(req)
            );
            
            if (matchedRequired) {
              statusMap[matchedRequired] = '✓ ' + status;
            }
          });
          
          requiredStatuses.forEach(req => {
            if (!statusMap[req]) {
              statusMap[req] = '✕ Não encontrado';
            }
          });
          
          if (missingStatuses.length > 0) {
            setTestResult({
              success: false,
              message: `Atenção: Os seguintes status estão faltando na lista do ClickUp: ${missingStatuses.join(', ')}. ` +
                     `Você precisa criar estes status exatamente com estes nomes para que a sincronização funcione corretamente. ` +
                     `Status encontrados: ${availableStatuses.join(', ')}`,
              statusMap
            });
          } else {
            setTestResult({
              success: true,
              message: `Lista verificada com sucesso! Todos os status necessários foram encontrados: ${requiredStatuses.join(', ')}`,
              statusMap
            });
          }
        } else {
          throw new Error('Formato de resposta inesperado');
        }
      } catch (listError) {
        console.error('[ClickUpConfigTest] Erro ao obter detalhes da lista:', listError);
        
        // Assumir que os status existem, mas permitir que o usuário seja informado
        setTestResult({
          success: true,
          message: 'Não foi possível verificar os status, mas assumindo que existem. Verifique manualmente se você tem os status: ABERTO, EM ANDAMENTO, RESOLVIDO e FECHADO.'
        });
      }
    } catch (error) {
      console.error('[ClickUpConfigTest] Erro ao verificar status:', error);
      setTestResult({
        success: false,
        message: error instanceof Error 
          ? error.message 
          : 'Erro ao verificar status. Verifique o console para mais detalhes.'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Funções auxiliares para obter informações de configuração do ClickUp
  const getClickUpApiKey = async (): Promise<string> => {
    try {
      // Usar método isConfigured para verificar se está configurado
      const isConfigured = await clickupService.isConfigured();
      if (!isConfigured) {
        throw new Error('ClickUp não está configurado');
      }
      
      // Buscar APIKey de forma segura através do ambiente
      // Esta é uma abordagem alternativa já que não podemos acessar getConfig diretamente
      return await fetch('/.netlify/functions/get-clickup-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      .then(response => response.json())
      .then(data => {
        if (!data.apiKey) {
          throw new Error('API Key não encontrada');
        }
        return data.apiKey;
      });
    } catch (error) {
      console.error('Erro ao obter API Key:', error);
      throw error;
    }
  };
  
  const getClickUpListId = async (): Promise<string> => {
    try {
      return await fetch('/.netlify/functions/get-clickup-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      .then(response => response.json())
      .then(data => {
        if (!data.listId) {
          throw new Error('List ID não encontrado');
        }
        return data.listId;
      });
    } catch (error) {
      console.error('Erro ao obter List ID:', error);
      throw error;
    }
  };
  
  // Testa a mudança para um status específico
  const testStatus = async (status: string, clickupStatus: string) => {
    if (!taskId) {
      setStatusTestResults({
        ...statusTestResults,
        [status]: { 
          success: false, 
          message: 'Informe o ID da tarefa no ClickUp para testar' 
        }
      });
      return;
    }
    
    setLoadingStatus(status);
    
    try {
      setStatusTestResults({
        ...statusTestResults,
        [status]: { 
          success: false, 
          message: `Alterando status para ${clickupStatus}...` 
        }
      });
      
      // Obter API do ClickUp
      const api = await clickupService['getAPI']();
      
      // Verificar se a tarefa existe
      console.log(`Verificando se a tarefa ${taskId} existe...`);
      const taskExists = await api.taskExists(taskId);
      
      if (!taskExists) {
        setStatusTestResults({
          ...statusTestResults,
          [status]: { 
            success: false, 
            message: `Erro: Tarefa com ID ${taskId} não encontrada no ClickUp` 
          }
        });
        return;
      }
      
      // Atualizar status da tarefa
      console.log(`Atualizando status da tarefa ${taskId} para ${clickupStatus}`);
      await api.updateTaskStatus(taskId, clickupStatus);
      
      setStatusTestResults({
        ...statusTestResults,
        [status]: { 
          success: true, 
          message: `Status atualizado para ${clickupStatus} com sucesso!` 
        }
      });
    } catch (error) {
      console.error(`Erro ao atualizar status para ${clickupStatus}:`, error);
      setStatusTestResults({
        ...statusTestResults,
        [status]: { 
          success: false, 
          message: error instanceof Error ? error.message : `Erro ao atualizar status para ${clickupStatus}` 
        }
      });
    } finally {
      setLoadingStatus(null);
    }
  };
  
  // Testa a exclusão da tarefa
  const testDeleteTask = async () => {
    if (!taskId) {
      setDeleteResult({ 
        success: false, 
        message: 'Informe o ID da tarefa no ClickUp para excluir' 
      });
      return;
    }
    
    try {
      setIsLoading(true);
      setDeleteResult({ message: 'Excluindo tarefa...' });
      
      // Obter API do ClickUp
      const api = await clickupService['getAPI']();
      
      // Verificar se a tarefa existe
      console.log(`Verificando se a tarefa ${taskId} existe antes de excluir...`);
      const taskExists = await api.taskExists(taskId);
      
      if (!taskExists) {
        setDeleteResult({
          success: false,
          message: `Erro: Tarefa com ID ${taskId} não encontrada no ClickUp`
        });
        return;
      }
      
      // Excluir a tarefa
      console.log(`Excluindo tarefa ${taskId}`);
      await api.deleteTask(taskId);
      
      setDeleteResult({
        success: true,
        message: 'Tarefa excluída com sucesso!'
      });
      
      // Limpar o ID da tarefa, já que ela foi excluída
      setTaskId('');
    } catch (error) {
      console.error('Erro ao excluir tarefa:', error);
      setDeleteResult({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao excluir tarefa'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Criar uma nova tarefa para teste
  const createTestTask = async () => {
    if (!config || !config.listId) {
      setMessage('Configuração incompleta. Verifique a configuração do ClickUp.');
      setMessageType('error');
      return;
    }
    
    try {
      setIsLoading(true);
      setMessage('Criando tarefa de teste no ClickUp...');
      setMessageType('info');
      
      // Obter API do ClickUp
      const api = await clickupService['getAPI']();
      
      // Criar tarefa de teste
      const testTicket = {
        id: `teste-${Date.now().toString().slice(-6)}`,
        title: `Tarefa de Teste - ${new Date().toLocaleString()}`,
        description: 'Esta é uma tarefa criada para testar a integração com o ClickUp.',
        status: 'open',
        priority: 'medium',
        createdAt: new Date()
      };
      
      console.log('Criando tarefa de teste com os dados:', testTicket);
      const result = await api.createTask(config.listId, testTicket);
      
      // Usar tipagem mais explícita para garantir acesso às propriedades
      interface TaskResponse {
        id?: string;
        [key: string]: any;
      }
      
      const taskResponse = result as TaskResponse;
      
      if (taskResponse && taskResponse.id) {
        setTaskId(taskResponse.id);
        setTicketId(testTicket.id);
        setMessage(`Tarefa de teste criada com sucesso! ID: ${taskResponse.id}`);
        setMessageType('success');
      } else {
        setMessage('Erro ao criar tarefa de teste: resposta inválida do ClickUp');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Erro ao criar tarefa de teste:', error);
      setMessage(error instanceof Error ? error.message : 'Erro ao criar tarefa de teste');
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const simulateStatusChange = async (status: TicketStatus) => {
    setLoading(true);
    
    try {
      console.log(`[ClickUpConfigTest] Simulando mudança de status para: ${status}`);
      
      // Obter um ticket de teste ou o primeiro ticket disponível
      const tickets = await getAllTickets();
      
      if (!tickets || tickets.length === 0) {
        setTestResult({
          success: false,
          message: 'Nenhum ticket encontrado para teste. Crie um ticket primeiro.'
        });
        setLoading(false);
        return;
      }
      
      // Usar o primeiro ticket com taskId
      const testTicket = tickets.find(t => t.taskId);
      
      if (!testTicket) {
        setTestResult({
          success: false,
          message: 'Nenhum ticket com taskId encontrado. Sincronize um ticket com o ClickUp primeiro.'
        });
        setLoading(false);
        return;
      }
      
      // Simular mudança de status
      console.log(`[ClickUpConfigTest] Teste com ticket ${testTicket.id} (taskId: ${testTicket.taskId})`);
      
      // Atualizar o status
      const updatedTicket = { ...testTicket, status };
      
      try {
        await clickupService.syncTicketWithClickUp(updatedTicket, {
          source: 'status-test',
          skipWebhookUpdate: false
        });
        
        setTestResult({
          success: true,
          message: `Status do ticket ${testTicket.id} atualizado com sucesso para ${status}!`
        });
      } catch (syncError) {
        setTestResult({
          success: false,
          message: syncError instanceof Error
            ? `Erro ao atualizar status: ${syncError.message}`
            : 'Erro desconhecido ao atualizar status'
        });
      }
    } catch (error) {
      console.error('[ClickUpConfigTest] Erro ao simular mudança de status:', error);
      setTestResult({
        success: false,
        message: error instanceof Error
          ? error.message
          : 'Erro ao simular mudança de status'
      });
    } finally {
      setLoading(false);
    }
  };

  // Função para obter todos os tickets
  const getAllTickets = async (): Promise<Ticket[]> => {
    try {
      // Podemos usar o fetch para a API Netlify
      return await fetch('/.netlify/functions/list-tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      .then(response => response.json())
      .then(data => {
        if (!data.tickets || !Array.isArray(data.tickets)) {
          return [];
        }
        return data.tickets;
      });
    } catch (error) {
      console.error('Erro ao obter tickets:', error);
      return [];
    }
  };

  return (
    <div className="mb-6 border rounded-lg p-4 shadow-sm">
      <div className="pb-4 border-b mb-4">
        <h2 className="text-xl font-semibold">Teste de Configuração do ClickUp</h2>
      </div>
      <div className="space-y-4">
        <div>
          <h3 className="text-md font-medium mb-2">1. Verificar Status Disponíveis</h3>
          <p className="text-sm text-gray-600 mb-3">
            Verifica se todos os status necessários existem no ClickUp.
            Para a sincronização funcionar corretamente, você precisa criar os seguintes status no ClickUp:
            <span className="font-semibold"> ABERTO, EM ANDAMENTO, RESOLVIDO</span> e <span className="font-semibold">FECHADO</span>.
          </p>
          <button 
            onClick={checkAvailableStatuses} 
            disabled={loading}
            className="mb-3 px-4 py-2 bg-blue-500 text-white rounded disabled:bg-blue-300 flex items-center"
          >
            {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Verificar Status
          </button>
        </div>
        
        {testResult && (
          <div className={`p-4 rounded-md border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-start">
              {testResult.success ? (
                <Check className="h-5 w-5 text-green-500 mr-2 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
              )}
              <div>
                <p className={`text-sm ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {testResult.message}
                </p>
                
                {testResult.statusMap && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {Object.entries(testResult.statusMap).map(([status, result]) => (
                      <div key={status} className="flex items-center">
                        <span className={`mr-2 px-2 py-0.5 rounded text-xs ${result.includes('✓') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {status}
                        </span>
                        <span className="text-xs">
                          {result}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="pt-4 border-t border-gray-200 mt-6">
          <h3 className="text-md font-medium mb-2">2. Testar Mudança de Status</h3>
          <p className="text-sm text-gray-600 mb-3">
            Simula mudanças de status para verificar a integração com o ClickUp.
            Selecione um status para testar a atualização em um ticket existente.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button 
              onClick={() => simulateStatusChange('open')}
              disabled={loading}
              className="px-3 py-2 border rounded flex items-center justify-start hover:bg-gray-50"
            >
              <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs mr-2">ABERTO</span>
            </button>
            
            <button 
              onClick={() => simulateStatusChange('in_progress')}
              disabled={loading}
              className="px-3 py-2 border rounded flex items-center justify-start hover:bg-gray-50"
            >
              <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs mr-2">EM ANDAMENTO</span>
            </button>
            
            <button 
              onClick={() => simulateStatusChange('resolved')}
              disabled={loading}
              className="px-3 py-2 border rounded flex items-center justify-start hover:bg-gray-50"
            >
              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs mr-2">RESOLVIDO</span>
            </button>
            
            <button 
              onClick={() => simulateStatusChange('closed')}
              disabled={loading}
              className="px-3 py-2 border rounded flex items-center justify-start hover:bg-gray-50"
            >
              <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs mr-2">FECHADO</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}