import { Handler } from '@netlify/functions';
import axios from 'axios';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { STATUS_MAP } from '../../src/constants/clickup';

export const handler: Handler = async (event) => {
  // Permitir preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Verificar se o método é POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método não permitido' })
    };
  }

  try {
    const { taskId, status } = JSON.parse(event.body || '{}');

    if (!taskId || !status) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'taskId e status são obrigatórios' })
      };
    }

    // Verificar se o status é válido
    const clickupStatus = STATUS_MAP[status];
    if (!clickupStatus) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Status inválido' })
      };
    }

    // Buscar configuração do ClickUp
    const configsRef = doc(db, 'clickup_configs', 'default');
    const configDoc = await getDoc(configsRef);
    
    if (!configDoc.exists()) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Configuração do ClickUp não encontrada' })
      };
    }

    const config = configDoc.data();
    
    // Chamar a API do ClickUp para atualizar o status
    await axios({
      method: 'PUT',
      url: `https://api.clickup.com/api/v2/task/${taskId}`,
      headers: {
        'Authorization': config.apiKey,
        'Content-Type': 'application/json'
      },
      data: {
        status: clickupStatus
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Status atualizado com sucesso',
        taskId,
        status,
        clickupStatus
      })
    };
  } catch (error) {
    console.error('Erro ao atualizar status no ClickUp:', error);
    
    const errorMessage = error.response?.data?.err || 'Erro ao atualizar status';
    
    return {
      statusCode: error.response?.status || 500,
      body: JSON.stringify({ error: errorMessage })
    };
  }
}; 