import React, { useState, useEffect } from 'react';
import { ClickUpAPI } from '../lib/clickup';
import { useClickUpStore } from '../stores/clickupStore';
import { useAuthStore } from '../stores/authStore';
import { useTicketStore } from '../stores/ticketStore';
import { Loader2, RefreshCw, Link, CheckCircle2, AlertCircle } from 'lucide-react';
import { STATUS_MAP, ERROR_MESSAGES } from '../constants/clickup';

export function ClickUpIntegration() {
  const { user } = useAuthStore();
  const { config } = useClickUpStore();
  const { tickets } = useTicketStore();
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<{ 
    status: 'idle' | 'syncing' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });

  // Carregar tarefas do ClickUp
  const fetchTasks = async () => {
    if (!config || !config.apiKey || !config.listId) {
      setSyncStatus({ 
        status: 'error', 
        message: 'Configuração do ClickUp incompleta. Configure a API Key e a Lista primeiro.' 
      });
      return;
    }

    try {
      setLoading(true);
      setSyncStatus({ status: 'idle', message: '' });
      
      console.log(`[ClickUpIntegration] Buscando tarefas da lista ${config.listId}`);
      const clickup = new ClickUpAPI(config.apiKey);
      const response = await clickup.getAllTasks(config.listId);
      
      setTasks(response.tasks || []);
      console.log(`[ClickUpIntegration] ${response.tasks?.length || 0} tarefas encontradas`);
    } catch (error) {
      console.error('[ClickUpIntegration] Erro ao buscar tarefas:', error);
      setSyncStatus({ 
        status: 'error', 
        message: error instanceof Error ? error.message : ERROR_MESSAGES.DEFAULT_ERROR
      });
    } finally {
      setLoading(false);
    }
  };

  // Sincronizar tickets com o ClickUp
  const syncTicketsToClickUp = async () => {
    if (!config || !config.apiKey || !config.listId || !tickets.length) {
      setSyncStatus({ 
        status: 'error', 
        message: 'Configuração incompleta ou não há tickets para sincronizar' 
      });
      return;
    }

    try {
      setSyncStatus({ status: 'syncing', message: 'Sincronizando tickets com o ClickUp...' });
      
      console.log(`[ClickUpIntegration] Iniciando sincronização de ${tickets.length} tickets`);
      const clickup = new ClickUpAPI(config.apiKey);
      let successCount = 0;
      let errorCount = 0;
      
      // Buscar tarefas existentes para comparação
      console.log(`[ClickUpIntegration] Buscando tarefas existentes na lista ${config.listId}`);
      const response = await clickup.getAllTasks(config.listId);
      const existingTasks = response.tasks || [];
      
      // Criar um mapa de tarefas pelo ID do ticket para busca mais eficiente
      const taskMap = new Map();
      
      // Verificar campos personalizados nas tarefas
      existingTasks.forEach(task => {
        if (task.custom_fields) {
          // Ao invés de usar o campo personalizado para mapear, vamos usar o título do ticket
          // para tentar encontrar a tarefa correspondente
          taskMap.set(task.id, task);
          
          // Também mapeamos pelo nome para facilitar a busca
          if (task.name) {
            taskMap.set(task.name, task);
          }
        }
      });
      
      console.log(`[ClickUpIntegration] Encontradas ${existingTasks.length} tarefas existentes`);
      
      // Processar cada ticket
      for (const ticket of tickets) {
        try {
          // Verificar se já existe tarefa para este ticket pelo nome (em vez de custom_fields)
          const ticketTitle = ticket.title;
          
          // Procurar a tarefa pelo título ou ID do ticket 
          const existingTask = taskMap.get(ticketTitle) || taskMap.get(ticket.id);
          
          if (existingTask) {
            // Atualizar tarefa existente
            console.log(`[ClickUpIntegration] Atualizando tarefa existente para ticket ${ticket.id}`);
            
            // Mapear o status usando a constante padronizada
            const clickupStatus = STATUS_MAP[ticket.status as keyof typeof STATUS_MAP] || STATUS_MAP.open;
            
            await clickup.updateTaskStatus(existingTask.id, clickupStatus);
            successCount++;
          } else {
            // Criar nova tarefa
            console.log(`[ClickUpIntegration] Criando nova tarefa para ticket ${ticket.id}`);
            await clickup.createTask(config.listId, ticket);
            successCount++;
          }
        } catch (error) {
          console.error(`[ClickUpIntegration] Erro ao sincronizar ticket ${ticket.id}:`, error);
          errorCount++;
        }
      }
      
      setSyncStatus({ 
        status: 'success', 
        message: `Sincronização concluída. ${successCount} tickets sincronizados com sucesso. ${errorCount} erros.` 
      });
      
      // Atualizar a lista de tarefas
      if (successCount > 0) {
        fetchTasks();
      }
    } catch (error) {
      console.error('[ClickUpIntegration] Erro na sincronização:', error);
      setSyncStatus({ 
        status: 'error', 
        message: error instanceof Error ? error.message : ERROR_MESSAGES.DEFAULT_ERROR
      });
    }
  };

  useEffect(() => {
    if (user && config) {
      fetchTasks();
    }
  }, [user, config]);

  if (!config || !config.apiKey) {
    return (
      <div className="bg-yellow-50 p-4 rounded-md">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-yellow-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">Configuração Necessária</h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                Configure o ClickUp na aba de configuração antes de usar esta funcionalidade.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">Tarefas no ClickUp</h2>
        <div className="space-x-2">
          <button
            onClick={fetchTasks}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar
          </button>
          <button
            onClick={syncTicketsToClickUp}
            disabled={loading || syncStatus.status === 'syncing'}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Link className="h-4 w-4 mr-2" />
            Sincronizar Tickets
          </button>
        </div>
      </div>

      {syncStatus.status !== 'idle' && (
        <div className={`p-4 rounded-md ${
          syncStatus.status === 'error' ? 'bg-red-50' :
          syncStatus.status === 'success' ? 'bg-green-50' :
          'bg-blue-50'
        }`}>
          <div className="flex">
            {syncStatus.status === 'error' ? (
              <AlertCircle className="h-5 w-5 text-red-400" />
            ) : syncStatus.status === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            ) : (
              <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
            )}
            <div className="ml-3">
              <h3 className={`text-sm font-medium ${
                syncStatus.status === 'error' ? 'text-red-800' :
                syncStatus.status === 'success' ? 'text-green-800' :
                'text-blue-800'
              }`}>
                {syncStatus.status === 'error' ? 'Erro' :
                 syncStatus.status === 'success' ? 'Sucesso' :
                 'Sincronizando'}
              </h3>
              <div className={`mt-2 text-sm ${
                syncStatus.status === 'error' ? 'text-red-700' :
                syncStatus.status === 'success' ? 'text-green-700' :
                'text-blue-700'
              }`}>
                <p>{syncStatus.message}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-gray-50 p-6 text-center rounded-md">
          <p className="text-gray-500">Nenhuma tarefa encontrada no ClickUp.</p>
          <p className="text-sm text-gray-400 mt-1">
            Clique em "Sincronizar Tickets" para criar tarefas baseadas nos seus tickets.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden rounded-md">
          <ul className="divide-y divide-gray-200">
            {tasks.map((task) => (
              <li key={task.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-4"
                      style={{ 
                        backgroundColor: 
                          task.status?.status === 'RESOLVIDO' || task.status?.status === 'complete' ? '#10B981' :
                          task.status?.status === 'EM ANDAMENTO' || task.status?.status === 'in progress' ? '#F59E0B' :
                          task.status?.status === 'FECHADO' || task.status?.status === 'closed' ? '#6B7280' :
                          '#3B82F6'
                      }}
                      aria-label={`Status: ${task.status?.status}`}
                    />
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">{task.name}</h3>
                      <p className="text-xs text-gray-500">
                        Status: {task.status?.status || 'Não definido'}
                        {task.due_date && ` • Prazo: ${new Date(task.due_date).toLocaleDateString('pt-BR')}`}
                      </p>
                    </div>
                  </div>
                  <a 
                    href={task.url} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <Link className="h-3 w-3 mr-1" />
                    Ver no ClickUp
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 