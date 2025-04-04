import * as admin from 'firebase-admin';
import * as api from './api';
import * as webhooks from './webhooks';
import * as functions from 'firebase-functions';

admin.initializeApp();

// Exportar endpoints da API
export const clickupEvent = api.handleClickUpEvent;
export const ticketStatus = api.updateTicketStatus;
export const ticketPriority = api.updateTicketPriority;
export const ticketComment = api.addTicketComment;
export const ticketDelete = api.deleteTicket;

// Exportar funções de webhook
export const processWebhookQueue = webhooks.processWebhookQueue;
export const cleanupWebhookQueue = webhooks.cleanupWebhookQueue;

export const deleteUser = functions.region('southamerica-east1').https.onCall(async (data, context) => {
  // Verificar se o usuário está autenticado
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'O usuário precisa estar autenticado'
    );
  }

  // Buscar dados do usuário que fez a requisição
  const callerUid = context.auth.uid;
  const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
  
  if (!callerDoc.exists) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Usuário não encontrado'
    );
  }

  const callerData = callerDoc.data();
  const { userId } = data;

  // Permitir que usuários deletem suas próprias contas OU que admins deletem qualquer conta
  if (callerUid !== userId && (!callerData || callerData.role !== 'admin')) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Você só pode deletar sua própria conta ou ser um administrador para deletar outras contas'
    );
  }

  // Não permitir deletar o admin principal
  if (userId === 'thiagomateus.ti@neurosaber.com.br') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Não é possível deletar o usuário administrador'
    );
  }

  try {
    // Deletar usuário no Authentication
    await admin.auth().deleteUser(userId);
    return { success: true };
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Erro ao deletar usuário no Authentication'
    );
  }
});

export const listAuthUsers = functions.region('southamerica-east1').https.onCall(async (data, context) => {
  // Verificar se o usuário está autenticado
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'O usuário precisa estar autenticado'
    );
  }

  // Buscar dados do usuário que fez a requisição
  const callerUid = context.auth.uid;
  const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
  
  if (!callerDoc.exists) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Usuário não encontrado'
    );
  }

  const callerData = callerDoc.data();
  
  // Verificar se o usuário tem permissão de admin
  if (!callerData || callerData.role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Apenas administradores podem listar usuários'
    );
  }

  try {
    // Listar todos os usuários do Authentication
    const listUsersResult = await admin.auth().listUsers();
    return listUsersResult.users.map(user => ({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName
    }));
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Erro ao listar usuários'
    );
  }
});