import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { AlertCircle, RefreshCw, Edit, Trash2, Play, ExternalLink } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useWebhookStore } from '../stores/webhookStore';
import { Button } from './ui/button';

interface Webhook {
  id: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  events: string[];
  headers: {
    name: string;
    testUrl: string;
    url: string;
    userId: string;
  };
}

// Mapeamento de eventos para rótulos mais amigáveis
const eventLabels: Record<string, string> = {
  'ticket.created': 'Ticket Criado',
  'ticket.updated': 'Ticket Atualizado',
  'ticket.status_changed': 'Status Alterado',
  'ticket.comment_added': 'Comentário Adicionado',
  'ticket.assigned': 'Ticket Atribuído',
  'ticket.deleted': 'Ticket Excluído'
};

export function WebhooksList() {
  const { user } = useAuthStore();
  const { deleteWebhook, testWebhook } = useWebhookStore();
  const [manualRefreshCounter, setManualRefreshCounter] = useState(0);
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);
  
  // Adiciona logs para o token atual
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      console.log('Token atual (primeiros 20 caracteres):', token.substring(0, 20) + '...');
      console.log('Usuário atual:', user?.uid);
    } else {
      console.log('Token não encontrado!');
    }
  }, [user]);

  const { data: webhooks, isLoading, error, refetch } = useQuery<Webhook[]>({
    queryKey: ['webhooks', manualRefreshCounter, user?.uid],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Usuário não autenticado');
      }

      console.log('Token encontrado:', token.substring(0, 20) + '...');
      console.log('Iniciando busca de webhooks...');
      
      try {
        const response = await fetch('/.netlify/functions/list-webhooks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ userId: user?.uid })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Erro na resposta:', errorText);
          try {
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.message || 'Falha ao carregar webhooks');
          } catch (e) {
            throw new Error(`Erro ${response.status}: ${errorText || 'Falha ao carregar webhooks'}`);
          }
        }
        
        const data = await response.json();
        console.log('Webhooks recebidos:', data);
        
        // Verificar e normalizar os dados
        const normalizedData = Array.isArray(data) 
          ? data 
          : (data.webhooks || []);

        return normalizedData.map((webhook: any) => {
          // Garantir que todos os campos necessários existam
          return {
            id: webhook.id || 'id-desconhecido',
            active: webhook.active || false,
            createdAt: webhook.createdAt || new Date().toISOString(),
            updatedAt: webhook.updatedAt || new Date().toISOString(),
            events: Array.isArray(webhook.events) ? webhook.events : [],
            headers: {
              name: webhook.headers?.name || webhook.name || 'Sem nome',
              testUrl: webhook.headers?.testUrl || webhook.testUrl || '',
              url: webhook.headers?.url || webhook.url || '',
              userId: webhook.headers?.userId || webhook.userId || ''
            }
          };
        });
      } catch (error) {
        console.error('Erro completo ao buscar webhooks:', error);
        throw error;
      }
    },
    retry: 1,
    refetchInterval: 30000 // Reduzir para 30 segundos para menos sobrecarga
  });

  const handleManualRefresh = () => {
    console.log('Atualizando manualmente...');
    setManualRefreshCounter(prev => prev + 1);
    refetch();
  };

  const handleEditWebhook = (webhook: Webhook) => {
    // Navegar para a página de edição com o webhook selecionado
    console.log('Editar webhook:', webhook);
    // Implementar navegação ou modal para edição
  };

  const handleDeleteWebhook = async (id: string) => {
    setSelectedWebhook(id);
    setConfirmDelete(true);
  };

  const confirmDeleteWebhook = async () => {
    if (!selectedWebhook) return;
    
    try {
      await deleteWebhook(selectedWebhook);
      console.log('Webhook deletado com sucesso:', selectedWebhook);
      setConfirmDelete(false);
      setSelectedWebhook(null);
      handleManualRefresh();
    } catch (error) {
      console.error('Erro ao deletar webhook:', error);
      alert('Erro ao deletar webhook. Tente novamente.');
    }
  };

  const handleTestWebhook = async (webhook: Webhook) => {
    setIsTestingWebhook(true);
    setTestResult(null);
    
    try {
      // Teste com evento de comentário adicionado
      const payload = {
        event: 'ticket.comment_added',
        data: {
          ticketId: 'test-123',
          comment: {
            id: 'comment-' + Date.now(),
            content: 'Teste de webhook via interface',
            userId: user?.uid || 'test-user',
            createdAt: new Date().toISOString()
          },
          metadata: {
            ticketTitle: 'Ticket de Teste',
            ticketStatus: 'open'
          }
        },
        timestamp: new Date().toISOString(),
        user: {
          id: user?.uid || 'test-user',
          email: user?.email || 'test@example.com',
          name: 'Usuário de Teste'
        }
      };
      
      // Use a URL correta de acordo com a disponibilidade
      const url = webhook.headers.testUrl || webhook.headers.url;
      
      console.log(`Testando webhook ${webhook.id} para URL: ${url}`);
      
      const result = await fetch('/.netlify/functions/webhook-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUrl: url,
          ...payload
        })
      });
      
      if (!result.ok) {
        throw new Error(`Erro HTTP ${result.status}: ${await result.text()}`);
      }
      
      const responseData = await result.json();
      console.log('Teste de webhook bem-sucedido:', responseData);
      
      setTestResult({
        success: true,
        message: 'Webhook testado com sucesso!'
      });
    } catch (error) {
      console.error('Erro ao testar webhook:', error);
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao testar webhook'
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  if (isLoading) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Carregando</AlertTitle>
        <AlertDescription>Buscando webhooks...</AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Erro ao carregar webhooks'}
        </AlertDescription>
        <button 
          onClick={handleManualRefresh}
          className="mt-2 flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" /> Tentar novamente
        </button>
      </Alert>
    );
  }

  if (!webhooks || webhooks.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Nenhum webhook encontrado</AlertTitle>
        <AlertDescription>
          Não há webhooks configurados no momento.
          <button 
            onClick={handleManualRefresh}
            className="ml-2 text-blue-500 hover:underline"
          >
            Atualizar
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Webhooks Configurados ({webhooks.length})</CardTitle>
        <button
          onClick={handleManualRefresh}
          className="flex items-center text-gray-500 hover:text-gray-700"
          title="Atualizar"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </CardHeader>
      <CardContent>
        {testResult && (
          <Alert className={`mb-4 ${testResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
            <AlertCircle className={`h-4 w-4 ${testResult.success ? 'text-green-600' : 'text-red-600'}`} />
            <AlertTitle>{testResult.success ? 'Sucesso' : 'Erro'}</AlertTitle>
            <AlertDescription>
              {testResult.message}
            </AlertDescription>
          </Alert>
        )}
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Eventos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Atualizado</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {webhooks.map((webhook) => (
              <TableRow key={webhook.id}>
                <TableCell>{webhook.headers.name}</TableCell>
                <TableCell className="font-mono text-xs max-w-[200px] truncate">
                  <a 
                    href={webhook.headers.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center text-blue-600 hover:underline"
                  >
                    {webhook.headers.url}
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {webhook.events.map((event) => (
                      <Badge key={event} variant="secondary" title={event}>
                        {eventLabels[event] || event}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={webhook.active ? 'default' : 'destructive'}>
                    {webhook.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {format(new Date(webhook.updatedAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTestWebhook(webhook)}
                      disabled={isTestingWebhook}
                      title="Testar Webhook"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditWebhook(webhook)}
                      title="Editar Webhook"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteWebhook(webhook.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Excluir Webhook"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {confirmDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md w-full">
              <h3 className="text-lg font-medium mb-4">Confirmar exclusão</h3>
              <p className="mb-6">Tem certeza que deseja excluir este webhook? Esta ação não pode ser desfeita.</p>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setConfirmDelete(false);
                    setSelectedWebhook(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDeleteWebhook}
                >
                  Excluir
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 