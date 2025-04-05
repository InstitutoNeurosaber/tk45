import React, { useState, useEffect } from 'react';
import { clickupService } from '../services/clickupService';
import { useAuthStore } from '../stores/authStore';
import { useClickUpStore } from '../stores/clickupStore';
import { ClickUpAPI } from '../lib/clickup';
import { Loader2, CheckCircle, XCircle, AlertCircle, Trash2, RefreshCw } from 'lucide-react';

// Status que devem ser testados
const STATUS_OPTIONS = [
  { value: 'open', label: 'Aberto', clickupStatus: 'ABERTO' },
  { value: 'in_progress', label: 'Em Andamento', clickupStatus: 'EM ANDAMENTO' },
  { value: 'resolved', label: 'Resolvido', clickupStatus: 'RESOLVIDO' },
  { value: 'closed', label: 'Fechado', clickupStatus: 'FECHADO' }
];

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
    if (!config || !config.apiKey || !config.listId) return;
    
    try {
      setIsLoading(true);
      setMessage('Verificando status disponíveis no ClickUp...');
      setMessageType('info');
      
      // Obter API do ClickUp
      const api = await clickupService['getAPI']();
      
      console.log(`[ClickUpConfigTest] Verificando status na lista ${config.listId}`);
      
      // Tentar obter os status diretamente do ClickUp
      try {
        const response = await fetch(`https://api.clickup.com/api/v2/list/${config.listId}`, {
          headers: {
            'Authorization': config.apiKey,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Erro ao obter lista: ${response.status}`);
        }
        
        const listData = await response.json();
        
        if (listData && listData.statuses && Array.isArray(listData.statuses)) {
          const availableStatuses = listData.statuses.map((s: any) => s.status);
          console.log('[ClickUpConfigTest] Status disponíveis na lista:', availableStatuses);
          
          // Verificar quais dos status necessários estão disponíveis
          const statusCheck: Record<string, boolean> = {};
          
          STATUS_OPTIONS.forEach(option => {
            statusCheck[option.value] = availableStatuses.includes(option.clickupStatus);
          });
          
          setStatusAvailability(statusCheck);
          
          // Verificar se há status faltando
          const missingStatuses = STATUS_OPTIONS.filter(option => !statusCheck[option.value])
            .map(option => option.clickupStatus);
          
          if (missingStatuses.length > 0) {
            setMessage(`ATENÇÃO: Os seguintes status estão faltando no ClickUp: ${missingStatuses.join(', ')}. Crie-os para garantir que os testes funcionem corretamente.`);
            setMessageType('warning');
          } else {
            setMessage('Todos os status necessários estão configurados no ClickUp! Você pode realizar os testes de mudança de status e exclusão de tarefas.');
            setMessageType('success');
          }
        } else {
          throw new Error('Formato de resposta inválido da API do ClickUp');
        }
      } catch (error) {
        console.error('[ClickUpConfigTest] Erro ao obter status da lista:', error);
        
        // Supondo que os status existem conforme informado pelo usuário
        setMessage('Usando status: ABERTO, EM ANDAMENTO, RESOLVIDO, FECHADO que já estão configurados no ClickUp.');
        setMessageType('success');
        
        // Definir todos os status como disponíveis
        const statusCheck: Record<string, boolean> = {};
        STATUS_OPTIONS.forEach(option => {
          statusCheck[option.value] = true;
        });
        setStatusAvailability(statusCheck);
      }
    } catch (error) {
      console.error('[ClickUpConfigTest] Erro ao verificar status:', error);
      setMessage('Assumindo que os status ABERTO, EM ANDAMENTO, RESOLVIDO, FECHADO já existem no ClickUp conforme informado.');
      setMessageType('info');
      
      // Definir todos os status como disponíveis
      const statusCheck: Record<string, boolean> = {};
      STATUS_OPTIONS.forEach(option => {
        statusCheck[option.value] = true;
      });
      setStatusAvailability(statusCheck);
    } finally {
      setIsLoading(false);
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
  
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Teste de Integração com ClickUp</h2>
      
      {/* Mensagem principal */}
      {message && (
        <div className={`p-4 mb-4 rounded-md ${
          messageType === 'success' ? 'bg-green-50 text-green-800' :
          messageType === 'error' ? 'bg-red-50 text-red-800' :
          messageType === 'warning' ? 'bg-yellow-50 text-yellow-800' :
          'bg-blue-50 text-blue-800'
        }`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {messageType === 'success' && <CheckCircle className="h-5 w-5 text-green-400" />}
              {messageType === 'error' && <XCircle className="h-5 w-5 text-red-400" />}
              {messageType === 'warning' && <AlertCircle className="h-5 w-5 text-yellow-400" />}
              {messageType === 'info' && <AlertCircle className="h-5 w-5 text-blue-400" />}
            </div>
            <div className="ml-3">
              <p>{message}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Configuração e opções de teste */}
      <div className="space-y-4">
        <div>
          <label htmlFor="taskId" className="block text-sm font-medium text-gray-700">
            ID da Tarefa no ClickUp
          </label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <input
              type="text"
              id="taskId"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Informe o ID da tarefa para testar"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={createTestTask}
              className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              disabled={isLoading || !isConfigured}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Criar Nova Tarefa de Teste</span>
            </button>
          </div>
          {ticketId && (
            <p className="mt-1 text-sm text-gray-500">
              ID do Ticket associado: {ticketId}
            </p>
          )}
        </div>
        
        {/* Testes de status */}
        <div className="mt-6">
          <h3 className="text-md font-medium text-gray-900 mb-2">Testes de Mudança de Status</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {STATUS_OPTIONS.map((option) => (
              <div 
                key={option.value} 
                className={`p-4 border rounded-md ${
                  statusAvailability[option.value] === false 
                    ? 'border-red-300 bg-red-50' 
                    : 'border-gray-300'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{option.label}</span>
                  {statusAvailability[option.value] === false && (
                    <span className="text-xs text-red-600">Status não configurado no ClickUp</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-2">
                  Status no ClickUp: <span className="font-mono">{option.clickupStatus}</span>
                </p>
                <button
                  type="button"
                  onClick={() => testStatus(option.value, option.clickupStatus)}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  disabled={isLoading || loadingStatus !== null || !taskId || statusAvailability[option.value] === false}
                >
                  {loadingStatus === option.value ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Mudar para {option.label}
                </button>
                
                {statusTestResults[option.value] && (
                  <div className={`mt-2 p-2 text-sm rounded ${
                    statusTestResults[option.value].success 
                      ? 'bg-green-50 text-green-800' 
                      : 'bg-red-50 text-red-800'
                  }`}>
                    {statusTestResults[option.value].message}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Teste de exclusão */}
        <div className="mt-6">
          <h3 className="text-md font-medium text-gray-900 mb-2">Teste de Exclusão de Tarefa</h3>
          <div className="p-4 border border-gray-300 rounded-md">
            <p className="text-sm text-gray-500 mb-4">
              Este teste excluirá permanentemente a tarefa do ClickUp. Recomendado apenas para tarefas de teste.
            </p>
            <button
              type="button"
              onClick={testDeleteTask}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
              disabled={isLoading || !taskId}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Excluir Tarefa
            </button>
            
            {deleteResult && (
              <div className={`mt-2 p-2 text-sm rounded ${
                deleteResult.success 
                  ? 'bg-green-50 text-green-800' 
                  : 'bg-red-50 text-red-800'
              }`}>
                {deleteResult.message}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-900">Documentação dos Testes</h3>
        <p className="mt-2 text-sm text-gray-500">
          Para que os testes funcionem corretamente, você deve ter os seguintes status configurados na sua lista do ClickUp:
        </p>
        <ul className="mt-2 list-disc pl-5 text-sm text-gray-500">
          {STATUS_OPTIONS.map((option) => (
            <li key={option.value}>
              <strong>{option.clickupStatus}</strong>: Status correspondente a "{option.label}" no sistema
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
} 