const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, getDoc, setDoc } = require('firebase/firestore');

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

const handler = async (event) => {
  // Configurar headers CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Lidar com preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    // Verificar autenticação
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Não autorizado',
          message: 'Token de autenticação não fornecido'
        })
      };
    }

    const token = authHeader.replace('Bearer ', '');
    const userId = token;

    if (event.httpMethod === 'GET') {
      // Buscar credenciais
      const credentialsRef = doc(db, 'googleDriveCredentials', userId);
      const credentialsDoc = await getDoc(credentialsRef);

      if (!credentialsDoc.exists()) {
        return {
          statusCode: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            clientId: '',
            clientSecret: '',
            redirectUri: '',
            projectId: ''
          })
        };
      }

      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentialsDoc.data())
      };
    } else if (event.httpMethod === 'POST') {
      // Salvar credenciais
      const credentials = JSON.parse(event.body);
      const credentialsRef = doc(db, 'googleDriveCredentials', userId);
      await setDoc(credentialsRef, credentials);

      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Credenciais salvas com sucesso'
        })
      };
    }

    return {
      statusCode: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Método não permitido',
        message: 'Método HTTP não suportado'
      })
    };
  } catch (error) {
    console.error('Erro:', error);
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Erro interno',
        message: error.message
      })
    };
  }
};

module.exports = { handler }; 