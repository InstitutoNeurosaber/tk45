import { Handler } from '@netlify/functions';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

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
const auth = getAuth();

interface Webhook {
  id: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  events: string[];
  headers: {
    name: string;
    testUrl: string;
    url: string;
    userId: string;
  };
}

export const handler: Handler = async (event) => {
  console.log('Iniciando listagem de webhooks');
  
  // Verificar se o usuário está autenticado
  const authHeader = event.headers.authorization;
  if (!authHeader) {
    console.log('Sem header de autorização');
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'Não autorizado' })
    };
  }

  try {
    // Verificar token
    const token = authHeader.replace('Bearer ', '');
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;
    console.log('Usuário autenticado:', userId);

    // Buscar todos os webhooks no Firestore
    console.log('Buscando webhooks no Firestore');
    const webhooksRef = db.collection('webhooks');
    
    // Buscar todos os webhooks sem restrição
    console.log('Buscando todos os webhooks');
    const snapshot = await webhooksRef.get();
    
    const webhooks: Webhook[] = [];
    snapshot.forEach(doc => {
      console.log('Webhook encontrado:', doc.id);
      const data = doc.data();
      webhooks.push({
        id: doc.id,
        active: data.active || false,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        events: data.events || [],
        headers: {
          name: data.headers?.name || '',
          testUrl: data.headers?.testUrl || '',
          url: data.headers?.url || '',
          userId: data.headers?.userId || ''
        }
      });
    });

    console.log(`Total de webhooks encontrados: ${webhooks.length}`);
    console.log('Webhooks:', JSON.stringify(webhooks, null, 2));

    return {
      statusCode: 200,
      body: JSON.stringify(webhooks)
    };
  } catch (error) {
    console.error('Erro ao buscar webhooks:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    };
  }
}; 