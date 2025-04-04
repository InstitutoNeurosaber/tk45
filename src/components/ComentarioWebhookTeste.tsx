import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { webhookService } from '../services/webhookService';

export function ComentarioWebhookTeste() {
  const { user, userData } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState('https://webhook.sistemaneurosaber.com.br/webhook/comentario');
  const [erro, setErro] = useState<string | null>(null);

  async function testarWebhook() {
    if (!user || !userData) {
      setErro('Usuário não autenticado');
      return;
    }

    setLoading(true);
    setResultado('Enviando webhook...');
    setErro(null);

    try {
      console.log('[WebhookTeste] Iniciando teste de webhook direto');
      
      // Criar dados de teste similares a um comentário
      const dataTest = {
        ticketId: 'teste-' + Date.now(),
        status: 'commented',
        previousStatus: 'open',
        userId: user.uid,
        userName: userData.name,
        comment: {
          id: crypto.randomUUID(),
          content: 'Teste manual de webhook ' + new Date().toISOString(),
          userId: user.uid,
          userName: userData.name,
          createdAt: new Date()
        }
      };
      
      console.log('[WebhookTeste] Enviando webhook com dados:', dataTest);
      
      // Enviar webhook usando o serviço
      const resposta = await webhookService.sendWebhookNotification('ticket.status_changed', dataTest);
      
      console.log('[WebhookTeste] Resposta do webhook:', resposta);
      setResultado(JSON.stringify(resposta || {status: 'sem resposta'}, null, 2));
    } catch (error) {
      console.error('[WebhookTeste] Erro ao enviar webhook:', error);
      setErro(error instanceof Error ? error.message : 'Erro desconhecido');
      setResultado(null);
    } finally {
      setLoading(false);
    }
  }

  async function testarWebhookViaFetch() {
    if (!targetUrl) {
      setErro('URL de destino é obrigatória');
      return;
    }

    setLoading(true);
    setResultado(`Enviando webhook diretamente para ${targetUrl}...`);
    setErro(null);

    try {
      const dataTest = {
        event: 'ticket.status_changed',
        data: {
          ticketId: 'teste-fetch-' + Date.now(),
          status: 'commented',
          previousStatus: 'open',
          comment: {
            id: crypto.randomUUID(),
            content: 'Teste via fetch direto ' + new Date().toISOString(),
            createdAt: new Date()
          }
        },
        timestamp: new Date().toISOString()
      };
      
      console.log('[WebhookTeste] Enviando via fetch para:', targetUrl);
      console.log('[WebhookTeste] Dados:', dataTest);
      
      const resposta = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataTest)
      });
      
      if (resposta.ok) {
        const data = await resposta.json();
        console.log('[WebhookTeste] Resposta ok:', data);
        setResultado(JSON.stringify(data, null, 2));
      } else {
        const text = await resposta.text();
        console.error('[WebhookTeste] Erro HTTP:', resposta.status, text);
        setErro(`Erro ${resposta.status}: ${text}`);
        setResultado(`Resposta não-OK: ${resposta.status}`);
      }
    } catch (error) {
      console.error('[WebhookTeste] Erro ao enviar via fetch:', error);
      setErro(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  async function testarWebhookViaProxy() {
    setLoading(true);
    setResultado('Enviando webhook via proxy de produção...');
    setErro(null);

    try {
      const payload = {
        targetUrl,
        event: 'ticket.status_changed',
        data: {
          ticketId: 'teste-proxy-' + Date.now(),
          comment: {
            id: crypto.randomUUID(),
            content: 'Teste via proxy em produção ' + new Date().toISOString(),
            createdAt: new Date()
          }
        }
      };
      
      console.log('[WebhookTeste] Enviando via proxy:', payload);
      
      const resposta = await fetch('https://tickets.sistemaneurosaber.com.br/.netlify/functions/webhook-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      console.log('[WebhookTeste] Status da resposta:', resposta.status);
      
      if (resposta.ok) {
        const data = await resposta.json();
        console.log('[WebhookTeste] Resposta do proxy:', data);
        setResultado(JSON.stringify(data, null, 2));
      } else {
        const text = await resposta.text();
        console.error('[WebhookTeste] Erro no proxy:', resposta.status, text);
        setErro(`Erro ${resposta.status}: ${text}`);
        setResultado(text);
      }
    } catch (error) {
      console.error('[WebhookTeste] Erro ao enviar via proxy:', error);
      setErro(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 mb-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Teste de Webhook</h2>
      
      <div className="mb-4">
        <label className="block mb-2 text-sm font-medium">URL de destino</label>
        <input
          type="text"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
        />
      </div>
      
      <div className="flex flex-wrap gap-2 mb-4">
        <button 
          onClick={testarWebhook} 
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400"
        >
          {loading ? 'Carregando...' : 'Testar via WebhookService'}
        </button>
        
        <button 
          onClick={testarWebhookViaFetch} 
          disabled={loading}
          className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:bg-gray-400"
        >
          {loading ? 'Carregando...' : 'Testar Direto (Fetch)'}
        </button>
        
        <button 
          onClick={testarWebhookViaProxy}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400"
        >
          {loading ? 'Carregando...' : 'Testar Via Proxy'}
        </button>
      </div>
      
      {erro && (
        <div className="p-4 mb-4 bg-red-100 border-l-4 border-red-500">
          <p className="text-red-700">Erro: {erro}</p>
        </div>
      )}
      
      {resultado && (
        <div className="p-4 bg-gray-100 rounded-md max-h-80 overflow-auto">
          <pre className="whitespace-pre-wrap break-words">{resultado}</pre>
        </div>
      )}
    </div>
  );
} 