import { Handler } from '@netlify/functions';
import { clickupWebhookHandler } from '../../src/services/clickup/webhookHandler';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' })
    };
  }

  try {
    console.log('[ClickUp Webhook] Recebido evento do ClickUp');
    const payload = JSON.parse(event.body || '{}');
    
    // Processar o evento usando nosso manipulador especializado
    const result = await clickupWebhookHandler.processEvent(payload);
    
    if (result.success) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: result.message })
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: result.message })
      };
    }
  } catch (error) {
    console.error('[ClickUp Webhook] Erro ao processar webhook:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'Erro interno do servidor', 
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    };
  }
};