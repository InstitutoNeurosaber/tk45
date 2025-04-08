const axios = require('axios');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBNGvGob1xRGf86twcBxEaGRMxvZH8sOT0",
  authDomain: "neuro-painel.firebaseapp.com",
  projectId: "neuro-painel",
  storageBucket: "neuro-painel.appspot.com",
  messagingSenderId: "790923095549",
  appId: "1:790923095549:web:6aff1a9ff9c9ff2f31bd94"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Mapeamento de status
const STATUS_MAP = {
  'open': 'ABERTO',
  'in_progress': 'EM ANDAMENTO',
  'resolved': 'RESOLVIDO',
  'closed': 'FECHADO'
};

exports.handler = async (event) => {
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