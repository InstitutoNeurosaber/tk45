import { Handler } from '@netlify/functions';
import axios from 'axios';

export const handler: Handler = async (event) => {
  // Permitir preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: ''
    };
  }

  // Extrair API key do cabeçalho Authorization ou query param
  const apiKey = 
    event.headers.authorization || 
    event.headers.Authorization || 
    event.queryStringParameters?.api_key || 
    '';

  if (!apiKey) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'API key não fornecida' })
    };
  }

  const { path } = event.queryStringParameters || {};
  
  if (!path) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Parâmetro path é obrigatório' })
    };
  }

  try {
    const response = await axios({
      method: event.httpMethod as any,
      url: `https://api.clickup.com/api/v2/${path}`,
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      data: event.httpMethod !== 'GET' ? JSON.parse(event.body || '{}') : undefined,
      params: event.httpMethod === 'GET' ? event.queryStringParameters : undefined
    });

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(response.data)
    };
  } catch (error) {
    console.error('Erro ao chamar API do ClickUp:', error);
    
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data || { error: 'Erro interno do servidor' };
    
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(errorMessage)
    };
  }
}; 