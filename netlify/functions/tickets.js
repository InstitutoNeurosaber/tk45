// Versão simplificada do serviço de tickets para o Netlify
const validateApiKey = async (apiKey) => {
  if (!apiKey) return false;
  // Implementar validação da API key aqui (simplificada)
  return true;
};

// Funções básicas de manipulação de tickets
const ticketService = {
  createTicket: async (data) => {
    console.log('Criando ticket:', data);
    // Implementação será feita diretamente no frontend
    return { id: 'mock-id', ...data };
  },
  
  updateTicketStatus: async (ticketId, status) => {
    console.log(`Atualizando status do ticket ${ticketId} para ${status}`);
    // Implementação será feita diretamente no frontend
    return true;
  },
  
  deleteTicket: async (ticketId) => {
    console.log(`Excluindo ticket ${ticketId}`);
    // Implementação será feita diretamente no frontend
    return true;
  }
};

exports.handler = async (event, context) => {
  // Verificar API key
  const apiKey = event.headers['x-api-key'];
  if (!await validateApiKey(apiKey)) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'API key inválida ou não fornecida' })
    };
  }

  try {
    switch (event.path) {
      case '/.netlify/functions/tickets': {
        if (event.httpMethod === 'POST') {
          const data = JSON.parse(event.body || '{}');
          const ticket = await ticketService.createTicket(data);
          return {
            statusCode: 201,
            body: JSON.stringify(ticket)
          };
        }
        break;
      }

      case '/.netlify/functions/tickets/status': {
        if (event.httpMethod === 'POST') {
          const { ticketId, status } = JSON.parse(event.body || '{}');
          await ticketService.updateTicketStatus(ticketId, status);
          return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
          };
        }
        break;
      }

      case '/.netlify/functions/tickets/delete': {
        if (event.httpMethod === 'POST') {
          const { ticketId } = JSON.parse(event.body || '{}');
          await ticketService.deleteTicket(ticketId);
          return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
          };
        }
        break;
      }
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'Rota não encontrada' })
    };

  } catch (error) {
    console.error('Erro na função Netlify:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: error instanceof Error ? error.message : 'Erro interno do servidor'
      })
    };
  }
}; 