const axios = require('axios');

/**
 * Handler para o webhook proxy
 */
exports.handler = async (event) => {
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
async function handleUrlValidation(requestBody, corsHeaders) {
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
async function handleWebhookProxy(requestBody, corsHeaders) {
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
  if (!webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://')) {
    webhookUrl = `https://${webhookUrl}`;
    console.log(`[Webhook Proxy] URL ajustada para: ${webhookUrl}`);
  }

  // Criar payload para envio
  const payload = {
    event,
    data,
    timestamp: Date.now(),
    ...restPayload
  };

  // Tentar enviar o webhook
  try {
    console.log(`[Webhook Proxy] Enviando webhook para: ${webhookUrl}`);
    console.log('[Webhook Proxy] Payload:', JSON.stringify(payload));
    
    const isTestMode = requestBody.isTestMode === true;
    
    // Verificar se é modo de teste (não envia realmente)
    if (isTestMode) {
      console.log('[Webhook Proxy] Modo de teste ativado, não enviando requisição real');
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          testMode: true,
          message: 'Webhook seria enviado com sucesso (modo de teste)',
          requestDetails: {
            url: webhookUrl,
            method: 'POST',
            payload
          }
        })
      };
    }
    
    // Enviar a requisição real
    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-From-Webhook': 'true',
        ...(requestBody.headers || {})
      },
      timeout: 10000,
      validateStatus: () => true
    });
    
    const responseStatus = response.status;
    console.log(`[Webhook Proxy] Resposta do webhook: ${responseStatus}`);
    
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: responseStatus >= 200 && responseStatus < 300,
        targetStatus: responseStatus,
        message: responseStatus >= 200 && responseStatus < 300
          ? 'Webhook enviado com sucesso'
          : `Falha ao enviar webhook, status: ${responseStatus}`,
        targetResponse: typeof response.data === 'object' 
          ? response.data 
          : { rawResponse: String(response.data).substring(0, 500) }
      })
    };
  } catch (error) {
    console.error('[Webhook Proxy] Erro ao enviar webhook:', error);
    
    let errorMessage = 'Erro ao enviar webhook';
    let errorDetails = {};
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Conexão recusada pelo servidor de destino';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Tempo limite excedido ao tentar enviar webhook';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Servidor de destino não encontrado';
      }
      
      errorDetails = {
        code: error.code,
        message: error.message,
        response: error.response?.data
      };
    }
    
    return {
      statusCode: 200, // Retornar 200 mesmo com erro para evitar cascata de falhas
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        details: errorDetails,
        message: `Falha ao enviar webhook: ${errorMessage}`
      })
    };
  }
} 