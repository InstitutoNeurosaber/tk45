import { Handler } from '@netlify/functions';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Inicialização do Firebase
if (!getApps().length) {
  console.log('Inicializando Firebase Admin...');
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      })
    });
    console.log('Firebase Admin inicializado com sucesso');
  } catch (error) {
    console.error('Erro ao inicializar Firebase Admin:', error);
  }
}

const db = getFirestore();

interface ClickUpProxyRequest {
  endpoint: string;
  method?: string;
  body?: any;
}

// Obter API Key do ClickUp a partir da configuração
async function getClickUpApiKey(): Promise<string> {
  try {
    // Buscar configuração ativa do ClickUp
    const configsRef = db.collection('clickup_configs');
    const snapshot = await configsRef.where('active', '==', true).limit(1).get();
    
    if (snapshot.empty) {
      throw new Error('Configuração do ClickUp não encontrada');
    }
    
    const config = snapshot.docs[0].data();
    
    if (!config.apiKey) {
      throw new Error('API Key do ClickUp não configurada');
    }
    
    return config.apiKey;
  } catch (error) {
    console.error('Erro ao obter API Key do ClickUp:', error);
    throw error;
  }
}

export const handler: Handler = async (event) => {
  // Configurar CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST'
  };
  
  // Responder diretamente às requisições OPTIONS (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }
  
  // Verificar método
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: 'Método não permitido' })
    };
  }
  
  try {
    // Extrair parâmetros da requisição
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Requisição sem corpo' })
      };
    }
    
    const req: ClickUpProxyRequest = JSON.parse(event.body);
    
    // Validar endpoint
    if (!req.endpoint) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Endpoint não especificado' })
      };
    }
    
    // Obter API Key
    console.log(`[ClickUpProxy] Obtendo API Key para requisição a ${req.endpoint}`);
    const apiKey = await getClickUpApiKey();
    
    // Preparar URL completa da API
    const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';
    const url = `${CLICKUP_API_BASE}${req.endpoint}`;
    
    console.log(`[ClickUpProxy] Fazendo requisição para ${url}`);
    
    // Configurar e enviar a requisição
    const requestOptions: RequestInit = {
      method: req.method || 'GET',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: req.body ? JSON.stringify(req.body) : undefined
    };
    
    // Fazer a requisição
    const response = await fetch(url, requestOptions);
    const responseData = await response.json();
    
    // Responder com o resultado
    return {
      statusCode: response.status,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(responseData)
    };
  } catch (error) {
    console.error('[ClickUpProxy] Erro ao processar requisição:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: 'Erro ao processar requisição',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    };
  }
};
