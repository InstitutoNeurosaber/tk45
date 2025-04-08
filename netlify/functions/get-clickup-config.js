const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');

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
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }

  // Verificar se o método é GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método não permitido' })
    };
  }

  try {
    // Buscar configuração ativa do ClickUp
    const configsRef = collection(db, 'clickup_configs');
    const q = query(configsRef, where('active', '==', true));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Nenhuma configuração do ClickUp encontrada' })
      };
    }

    // Obter o primeiro documento ativo
    const configDoc = snapshot.docs[0];
    const data = configDoc.data();
    const config = {
      id: configDoc.id,
      ...data,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate()
    };

    // Remover a chave API da resposta para segurança
    const { apiKey, ...safeConfig } = config;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        config: safeConfig,
        hasApiKey: !!apiKey
      })
    };
  } catch (error) {
    console.error('Erro ao buscar configuração do ClickUp:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro ao buscar configuração do ClickUp' })
    };
  }
}; 