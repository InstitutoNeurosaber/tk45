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
  console.log('Headers da requisição:', JSON.stringify(event.headers));
  
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
    console.log('Token recebido (primeiros 20 caracteres):', token.substring(0, 20) + '...');
    
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;
    console.log('Usuário autenticado:', userId);

    // Verificar se o usuário é administrador
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const isAdmin = userData?.role === 'admin';
    console.log(`Usuário ${userId} é admin: ${isAdmin}`);
    console.log('Dados do usuário:', JSON.stringify(userData));

    // Buscar webhooks no Firestore
    console.log('Buscando webhooks no Firestore');
    
    // Buscar em ambas as coleções: webhooks_config (frontend) e webhooks (API)
    const webhooks: Webhook[] = [];
    
    // TEMPORÁRIO: Listar todas as coleções
    try {
      const collections = await db.listCollections();
      console.log('Coleções disponíveis no Firestore:');
      for (const collection of collections) {
        console.log(`- ${collection.id}`);
      }
    } catch (error) {
      console.error('Erro ao listar coleções:', error);
    }
    
    // 1. Buscar na coleção webhooks (API)
    try {
      console.log('Obtendo todos os webhooks da coleção webhooks para diagnóstico');
      const allWebhooksSnapshot = await db.collection('webhooks').get();
      console.log(`Total de documentos em webhooks: ${allWebhooksSnapshot.size}`);
      
      if (allWebhooksSnapshot.size > 0) {
        const sampleData = allWebhooksSnapshot.docs[0].data();
        console.log('Estrutura de exemplo da coleção webhooks:', JSON.stringify(sampleData));
      }
      
      // Obter webhooks filtrados por usuário, se não for admin
      let filteredSnapshot;
      if (isAdmin) {
        filteredSnapshot = allWebhooksSnapshot;
      } else {
        // Buscar por headers.userId explicitamente se existir na estrutura
        const userWebhooks = allWebhooksSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data.headers && data.headers.userId === userId;
        });
        console.log(`Webhooks filtrados manualmente para o usuário: ${userWebhooks.length}`);
        filteredSnapshot = { docs: userWebhooks, size: userWebhooks.length };
      }
      
      console.log(`Webhooks filtrados na coleção webhooks: ${filteredSnapshot.size}`);
      
      filteredSnapshot.docs.forEach(doc => {
        console.log(`Adicionando webhook de webhooks: ${doc.id}`);
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
    } catch (error) {
      console.error('Erro ao buscar webhooks da coleção webhooks:', error);
    }
    
    // 2. Buscar na coleção webhooks_config (frontend)
    try {
      console.log('Obtendo todos os webhooks da coleção webhooks_config para diagnóstico');
      const allConfigSnapshot = await db.collection('webhooks_config').get();
      console.log(`Total de documentos em webhooks_config: ${allConfigSnapshot.size}`);
      
      if (allConfigSnapshot.size > 0) {
        const sampleData = allConfigSnapshot.docs[0].data();
        console.log('Estrutura de exemplo da coleção webhooks_config:', JSON.stringify(sampleData));
      }
      
      // Obter webhooks filtrados por usuário, se não for admin
      let filteredSnapshot;
      if (isAdmin) {
        filteredSnapshot = allConfigSnapshot;
      } else {
        // Buscar por userId explicitamente para webhooks_config
        const userWebhooks = allConfigSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data.userId === userId;
        });
        console.log(`Webhooks_config filtrados manualmente para o usuário: ${userWebhooks.length}`);
        filteredSnapshot = { docs: userWebhooks, size: userWebhooks.length };
      }
      
      console.log(`Webhooks filtrados na coleção webhooks_config: ${filteredSnapshot.size}`);
      
      filteredSnapshot.docs.forEach(doc => {
        console.log(`Adicionando webhook de webhooks_config: ${doc.id}`);
        const data = doc.data();
        webhooks.push({
          id: doc.id,
          active: data.active || false,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          events: data.events || [],
          headers: {
            name: data.name || '',
            testUrl: data.testUrl || '',
            url: data.url || '',
            userId: data.userId || ''
          }
        });
      });
    } catch (error) {
      console.error('Erro ao buscar webhooks da coleção webhooks_config:', error);
    }

    console.log(`Total de webhooks encontrados combinados: ${webhooks.length}`);
    
    // TEMPORÁRIO: Para tentar um último recurso, retornar todos os webhooks para teste
    if (webhooks.length === 0 && isAdmin) {
      console.log('Como não encontramos webhooks e o usuário é admin, vamos listar tudo');
      
      try {
        const allWebhooks = await db.collection('webhooks').get();
        allWebhooks.forEach(doc => {
          const data = doc.data();
          webhooks.push({
            id: doc.id,
            active: data.active || false,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
            events: data.events || [],
            headers: {
              name: data.headers?.name || data.name || '',
              testUrl: data.headers?.testUrl || data.testUrl || '',
              url: data.headers?.url || data.url || '',
              userId: data.headers?.userId || data.userId || ''
            }
          });
        });
      } catch (error) {
        console.error('Último recurso falhou:', error);
      }
    }

    if (webhooks.length > 0) {
      console.log('Primeiro webhook:', JSON.stringify(webhooks[0], null, 2));
    } else {
      console.log('Nenhum webhook encontrado após todas as tentativas!');
    }

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