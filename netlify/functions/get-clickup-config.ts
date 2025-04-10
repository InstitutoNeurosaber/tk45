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

// Retorna informações de configuração do ClickUp para o frontend
export const handler: Handler = async (event) => {
  // Configurar CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Responder diretamente às requisições OPTIONS (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }

  try {
    // Verificar autenticação (opcional, remover se não for necessário)
    let userId: string | null = null;
    
    const authHeader = event.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await auth.verifyIdToken(token);
        userId = decodedToken.uid;
        console.log(`Usuário autenticado: ${userId}`);
      } catch (authError) {
        console.warn('Erro na autenticação:', authError);
        // Continuar mesmo sem autenticação válida, mas com limitações
      }
    }

    // Buscar configuração ativa
    console.log('[GetClickUpConfig] Buscando configuração ativa do ClickUp');
    
    const configsRef = db.collection('clickup_configs');
    const query = configsRef.where('active', '==', true).limit(1);
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      console.log('[GetClickUpConfig] Nenhuma configuração ativa encontrada');
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: 'Configuração do ClickUp não encontrada' })
      };
    }
    
    const configDoc = snapshot.docs[0];
    const config = configDoc.data();
    
    console.log('[GetClickUpConfig] Configuração encontrada:', configDoc.id);
    
    // Retornar apenas o necessário para o frontend
    // Note que estamos enviando o apiKey por motivos de teste, em produção seria melhor usar proxy
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        apiKey: config.apiKey,
        listId: config.listId,
        workspaceId: config.workspaceId,
        spaceId: config.spaceId
      })
    };
  } catch (error) {
    console.error('[GetClickUpConfig] Erro ao obter configuração:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: 'Erro ao obter configuração do ClickUp', 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      })
    };
  }
};
