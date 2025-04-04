import { Handler } from '@netlify/functions';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

export const handler: Handler = async (event) => {
  // Verificar se o usuário está autenticado e é admin
  const authHeader = event.headers.authorization;
  if (!authHeader) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'Não autorizado' })
    };
  }

  try {
    // Buscar todos os webhooks no Firestore
    const webhooksRef = db.collection('webhooks');
    const snapshot = await webhooksRef.get();
    
    const webhooks = [];
    snapshot.forEach(doc => {
      webhooks.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return {
      statusCode: 200,
      body: JSON.stringify(webhooks)
    };
  } catch (error) {
    console.error('Erro ao buscar webhooks:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Erro interno do servidor' })
    };
  }
}; 