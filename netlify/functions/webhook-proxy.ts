import { Handler } from '@netlify/functions';
import axios from 'axios';

export const handler: Handler = async (event) => {
  // Configurar headers CORS padrão para todas as respostas
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-From-Testing, X-From-Webhook',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  // Verificar se é uma requisição OPTIONS (preflight CORS)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    };
  }

  // Verificar se a requisição é POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Método não permitido',
        message: 'Esta função aceita apenas o método POST'
      })
    };
  }

  // Verificar se o caminho é para validação de URL
  const isValidateUrl = event.path.endsWith('/validate-url');

  try {
    // Verificar se o corpo da requisição existe
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Corpo da requisição vazio',
          message: 'O corpo da requisição é obrigatório'
        })
      };
    }

    // Parsear o corpo da requisição
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      console.error('[Webhook Proxy] Erro ao parsear JSON:', parseError);
      return {
        statusCode: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Formato JSON inválido',
          message: 'O corpo da requisição deve ser um JSON válido'
        })
      };
    }

    // Se for uma requisição para validar URL
    if (isValidateUrl) {
      return await handleUrlValidation(requestBody, corsHeaders);
    }

    // Se for uma requisição para encaminhar webhook
    return await handleWebhookProxy(requestBody, corsHeaders);
  } catch (error) {
    console.error('[Webhook Proxy] Erro interno:', error);
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Erro interno do servidor',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    };
  }
};

/**
 * Função para validar URLs
 */
async function handleUrlValidation(requestBody: any, corsHeaders: Record<string, string>) {
  const { url } = requestBody;

  if (!url) {
    return {
      statusCode: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'URL não fornecida',
        message: 'O parâmetro url é obrigatório'
      })
    };
  }

  try {
    const response = await axios.head(url, {
      timeout: 5000,
      validateStatus: () => true
    });

    const statusCode = response.status;

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        valid: statusCode < 400,
        statusCode,
        message: statusCode < 400
          ? 'URL válida e acessível'
          : `URL retornou status ${statusCode}`
      })
    };
  } catch (error) {
    console.error('[Webhook Proxy] Erro ao validar URL:', error);

    let errorMessage = 'Erro ao validar URL';

    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Conexão recusada pelo servidor';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Tempo limite excedido';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Servidor não encontrado';
      }
    }

    return {
      statusCode: 200, // Retornar 200 mesmo em caso de erro para evitar falhas em cascata
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        valid: false,
        error: errorMessage,
        message: errorMessage
      })
    };
  }
}

/**
 * Função para encaminhar webhooks
 */
async function handleWebhookProxy(requestBody: any, corsHeaders: Record<string, string>) {
  // Obter dados da requisição
  const { targetUrl, event, data, ...restPayload } = requestBody;

  if (!targetUrl) {
    console.error('[Webhook Proxy] URL de destino não fornecida');
    return {
      statusCode: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'URL de destino não fornecida',
        message: 'O parâmetro targetUrl é obrigatório'
      })
    };
  }

  // Verificar formato da URL para evitar erros comuns
  let webhookUrl = targetUrl;

  // Corrigir URLs comuns com erros de digitação
  if (webhookUrl.includes('sistemaneurousaber')) {
    webhookUrl = webhookUrl.replace('sistemaneurousaber', 'sistemaneurosaber');
    console.log('[Webhook Proxy] URL corrigida (neurousaber -> neurosaber):', webhookUrl);
  }

  // Corrigir caminhos plurais incorretos
  if (webhookUrl.includes('/webhooks/')) {
    webhookUrl = webhookUrl.replace('/webhooks/', '/webhook/');
    console.log('[Webhook Proxy] Caminho corrigido (webhooks -> webhook):', webhookUrl);
  }

  // Garantir protocolo https
  if (!webhookUrl.startsWith('http')) {
    webhookUrl = 'https://' + webhookUrl;
    console.log('[Webhook Proxy] Protocolo adicionado:', webhookUrl);
  }

  console.log(`[Webhook Proxy] Enviando evento "${event}" para ${webhookUrl}`);

  // Criar payload final
  const payload = {
    event,
    data,
    timestamp: new Date().toISOString(),
    ...restPayload
  };

  // Definir cabeçalhos para a solicitação
  const headers = {
    'Content-Type': 'application/json',
    'X-From-Webhook': 'true',
    'X-From-Testing': 'false',
    'User-Agent': 'Webhook-Proxy-Netlify-Function'
  };

  try {
    // Configuração do timeout para evitar esperas muito longas
    const timeoutMs = 15000; // 15 segundos

    // Tentar enviar o webhook com timeout
    const response = await axios.post(webhookUrl, payload, {
      headers,
      timeout: timeoutMs,
      validateStatus: () => true // Não lançar erro para nenhum status HTTP
    });

    const statusCode = response.status;
    const responseData = response.data;

    console.log(`[Webhook Proxy] Resposta recebida (${statusCode}):`,
      typeof responseData === 'object' ? JSON.stringify(responseData, null, 2) : responseData
    );

    // Retornar a resposta do serviço de destino
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: statusCode >= 200 && statusCode < 300,
        targetUrl: webhookUrl,
        statusCode,
        response: responseData,
        originalUrl: targetUrl !== webhookUrl ? targetUrl : undefined
      })
    };
  } catch (error) {
    console.error('[Webhook Proxy] Erro ao encaminhar webhook:', error);

    let errorMessage = 'Erro desconhecido';
    let errorDetails: string | Record<string, any> | undefined = undefined;

    if (axios.isAxiosError(error)) {
      errorMessage = error.message;

      if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Conexão recusada pelo servidor';
        errorDetails = 'O servidor de destino não está acessível';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Tempo limite excedido';
        errorDetails = 'O servidor de destino demorou muito para responder';
      } else if (error.response) {
        errorMessage = `Erro HTTP ${error.response.status}`;
        errorDetails = error.response.data;
      }
    }

    return {
      statusCode: 502,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        details: errorDetails,
        targetUrl: webhookUrl,
        originalUrl: targetUrl !== webhookUrl ? targetUrl : undefined
      })
    };
  }
}
