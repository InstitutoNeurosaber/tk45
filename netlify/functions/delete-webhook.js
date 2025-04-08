const axios = require('axios');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, getDoc, deleteDoc } = require('firebase/firestore');

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

exports.handler = async (event) => {
  // Permitir preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS'
      },
      body: ''
    };
  }

  // Verificar se o método é DELETE
  if (event.httpMethod !== 'DELETE') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método não permitido' })
    };
  }

  // Extrair o ID do webhook da URL
  const { id } = event.queryStringParameters || {};
  
  if (!id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'ID do webhook é obrigatório' })
    };
  }

  try {
    // Buscar webhook no Firestore
    const webhookRef = doc(collection(db, 'webhooks'), id);
    const webhookDoc = await getDoc(webhookRef);
    
    if (!webhookDoc.exists()) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Webhook não encontrado' })
      };
    }

    // Pegar dados do webhook
    const webhookData = webhookDoc.data();

    // Buscar configuração do ClickUp
    const configsRef = collection(db, 'clickup_configs');
    const configDoc = await getDoc(doc(configsRef, webhookData.configId || 'default'));
    
    if (!configDoc.exists()) {
      // Se não encontrar a configuração, apenas excluir do Firestore
      await deleteDoc(webhookRef);
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'Webhook removido do banco de dados (ClickUp não encontrado)' 
        })
      };
    }

    const config = configDoc.data();
    
    // Chamar a API do ClickUp para excluir o webhook remotamente
    try {
      await axios({
        method: 'DELETE',
        url: `https://api.clickup.com/api/v2/webhook/${webhookData.webhookId}`,
        headers: {
          'Authorization': config.apiKey,
          'Content-Type': 'application/json'
        }
      });
    } catch (clickupError) {
      console.warn('Erro ao excluir webhook do ClickUp:', clickupError);
      // Continuar mesmo com erro do ClickUp
    }

    // Excluir webhook do Firestore
    await deleteDoc(webhookRef);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook excluído com sucesso' })
    };
  } catch (error) {
    console.error('Erro ao excluir webhook:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro ao excluir webhook' })
    };
  }
}; 