import { Handler } from '@netlify/functions';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fetch from 'node-fetch';

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

interface UpdateStatusRequest {
  ticketId: string;
  newStatus: string;
}

// Função para obter configuração do ClickUp
async function getClickUpConfig() {
  console.log('[UpdateClickUpStatus] Buscando configuração ativa do ClickUp');
  
  const configsRef = db.collection('clickup_configs');
  const query = configsRef.where('active', '==', true).limit(1);
  const snapshot = await query.get();
  
  if (snapshot.empty) {
    console.log('[UpdateClickUpStatus] Nenhuma configuração ativa encontrada');
    throw new Error('Configuração do ClickUp não encontrada');
  }
  
  const configDoc = snapshot.docs[0];
  const config = configDoc.data();
  
  console.log('[UpdateClickUpStatus] Configuração encontrada:', configDoc.id);
  return config;
}

// Função para obter o ID da tarefa no ClickUp a partir do ID do ticket
async function getClickUpTaskId(ticketId: string) {
  console.log(`[UpdateClickUpStatus] Buscando tarefa no ClickUp para o ticket: ${ticketId}`);
  
  // Buscar o ticket no Firestore
  const ticketRef = db.collection('tickets').doc(ticketId);
  const ticketDoc = await ticketRef.get();
  
  if (!ticketDoc.exists) {
    console.log(`[UpdateClickUpStatus] Ticket não encontrado: ${ticketId}`);
    throw new Error(`Ticket não encontrado: ${ticketId}`);
  }
  
  const ticketData = ticketDoc.data();
  
  if (!ticketData?.clickUpTaskId) {
    console.log(`[UpdateClickUpStatus] Ticket não possui ID da tarefa no ClickUp: ${ticketId}`);
    throw new Error(`Ticket não está vinculado a uma tarefa no ClickUp: ${ticketId}`);
  }
  
  console.log(`[UpdateClickUpStatus] ID da tarefa no ClickUp encontrado: ${ticketData.clickUpTaskId}`);
  return ticketData.clickUpTaskId;
}

// Mapear o status interno para o status no ClickUp
function mapStatus(status: string): string {
  console.log(`[UpdateClickUpStatus] Mapeando status: ${status}`);
  
  // Status pode variar dependendo das configurações do ClickUp
  // Importante: esses valores devem corresponder exatamente aos nomes de status no seu ClickUp
  switch (status.toUpperCase()) {
    case 'ABERTO':
      return 'Aberto';
    case 'EM ANDAMENTO':
      return 'Em andamento';
    case 'RESOLVIDO':
      return 'Resolvido';
    case 'FECHADO':
      return 'Fechado';
    default:
      console.log(`[UpdateClickUpStatus] Status não mapeado: ${status}, usando original`);
      return status;
  }
}

export const handler: Handler = async (event) => {
  // Configurar CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Responder diretamente às requisições OPTIONS (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }

  // Validar método HTTP
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: 'Método não permitido' })
    };
  }

  try {
    const requestBody: UpdateStatusRequest = JSON.parse(event.body || '{}');
    
    // Validar dados da requisição
    if (!requestBody.ticketId || !requestBody.newStatus) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Parâmetros inválidos: ticketId e newStatus são obrigatórios' })
      };
    }

    // Obter API Key do ClickUp e outras configurações
    const clickUpConfig = await getClickUpConfig();
    const apiKey = clickUpConfig.apiKey;
    
    // Obter ID da tarefa no ClickUp
    const taskId = await getClickUpTaskId(requestBody.ticketId);
    
    // Mapear o status para o formato esperado pelo ClickUp
    const mappedStatus = mapStatus(requestBody.newStatus);
    
    console.log(`[UpdateClickUpStatus] Atualizando status da tarefa ${taskId} para: ${mappedStatus}`);
    
    // Fazer requisição para a API do ClickUp
    const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey
      },
      body: JSON.stringify({
        status: mappedStatus
      })
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('[UpdateClickUpStatus] Erro ao atualizar status:', responseData);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          message: 'Erro ao atualizar status no ClickUp',
          error: responseData
        })
      };
    }
    
    console.log('[UpdateClickUpStatus] Status atualizado com sucesso');
    
    // Atualizar o status no Firestore também
    await db.collection('tickets').doc(requestBody.ticketId).update({
      status: requestBody.newStatus,
      updatedAt: new Date()
    });
    
    // Retornar sucesso
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        message: 'Status atualizado com sucesso',
        data: {
          ticketId: requestBody.ticketId,
          clickUpTaskId: taskId,
          newStatus: requestBody.newStatus,
          mappedStatus
        }
      })
    };
  } catch (error) {
    console.error('[UpdateClickUpStatus] Erro:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: 'Erro ao atualizar status', 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      })
    };
  }
};
