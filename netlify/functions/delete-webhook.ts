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

interface DeleteWebhookRequest {
  webhookId: string;
  userId?: string;
}

export const handler: Handler = async (event) => {
  console.log('Iniciando exclusão de webhook via API');
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Método não permitido' })
    };
  }

  // Validar headers de autenticação
  const authHeader = event.headers.authorization;
  let userId: string | undefined;
  let isAdmin = false;

  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '');
      console.log('Token recebido para autenticação');
      
      const decodedToken = await auth.verifyIdToken(token);
      userId = decodedToken.uid;
      console.log(`Usuário autenticado: ${userId}`);

      // Verificar se o usuário é administrador
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      isAdmin = userData?.role === 'admin';
      console.log(`Usuário ${userId} é admin: ${isAdmin}`);
    } catch (authError) {
      console.error('Erro na autenticação:', authError);
      // Continuar mesmo sem autenticação válida, mas com recursos limitados
    }
  } else {
    console.log('Sem header de autorização, continuando com recursos limitados');
  }

  try {
    const requestData: DeleteWebhookRequest = JSON.parse(event.body || '{}');
    
    if (!requestData.webhookId) {
      console.error('ID do webhook não fornecido');
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'ID do webhook é obrigatório' })
      };
    }

    console.log(`Excluindo webhook: ${requestData.webhookId}`);
    const webhookId = requestData.webhookId;
    
    // Verificar se o webhook existe antes de excluir
    let webhookOwner: string | undefined;
    
    // Verificar na coleção webhooks_config
    try {
      const webhookDoc = await db.collection('webhooks_config').doc(webhookId).get();
      
      if (webhookDoc.exists) {
        const webhookData = webhookDoc.data();
        webhookOwner = webhookData?.userId;
        
        // Verificar permissão
        if (!isAdmin && userId && webhookOwner && userId !== webhookOwner) {
          console.error(`Usuário ${userId} não tem permissão para excluir webhook de ${webhookOwner}`);
          return {
            statusCode: 403,
            body: JSON.stringify({ message: 'Você não tem permissão para excluir este webhook' })
          };
        }
        
        // Excluir webhook
        await db.collection('webhooks_config').doc(webhookId).delete();
        console.log(`Webhook excluído com sucesso da coleção webhooks_config: ${webhookId}`);
      } else {
        console.log(`Webhook ${webhookId} não encontrado na coleção webhooks_config`);
      }
    } catch (error) {
      console.error(`Erro ao verificar/excluir webhook da coleção webhooks_config:`, error);
    }
    
    // Verificar e excluir também da coleção webhooks
    try {
      const webhookDoc = await db.collection('webhooks').doc(webhookId).get();
      
      if (webhookDoc.exists) {
        const webhookData = webhookDoc.data();
        const oldWebhookOwner = webhookData?.headers?.userId || webhookData?.userId;
        
        // Verificar permissão
        if (!isAdmin && userId && oldWebhookOwner && userId !== oldWebhookOwner) {
          console.warn(`Usuário ${userId} não tem permissão para excluir webhook de ${oldWebhookOwner} na coleção antiga`);
          // Continuamos mesmo assim, pois já excluímos da coleção principal
        } else {
          // Excluir webhook
          await db.collection('webhooks').doc(webhookId).delete();
          console.log(`Webhook excluído com sucesso da coleção webhooks: ${webhookId}`);
        }
      } else {
        console.log(`Webhook ${webhookId} não encontrado na coleção webhooks`);
      }
    } catch (error) {
      console.error(`Erro ao verificar/excluir webhook da coleção webhooks:`, error);
    }
    
    // Buscar documentos por ID em outras coleções
    try {
      // Procurar em webhook_queue se existir
      const queueDocs = await db.collection('webhook_queue')
        .where('webhookId', '==', webhookId)
        .limit(10)
        .get();
      
      if (!queueDocs.empty) {
        console.log(`Encontrados ${queueDocs.size} documentos relacionados na fila`);
        const batch = db.batch();
        
        queueDocs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        console.log(`Documentos relacionados na fila excluídos com sucesso`);
      }
    } catch (cleanupError) {
      console.warn('Erro ao limpar documentos relacionados:', cleanupError);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: 'Webhook excluído com sucesso',
        webhookId
      })
    };
  } catch (error) {
    console.error('Erro ao excluir webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false,
        message: 'Erro interno do servidor', 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      })
    };
  }
};
