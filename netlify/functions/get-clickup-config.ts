import { Handler } from '@netlify/functions';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';

export const handler: Handler = async (event) => {
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
    const config = {
      id: configDoc.id,
      ...configDoc.data(),
      createdAt: configDoc.data().createdAt.toDate(),
      updatedAt: configDoc.data().updatedAt.toDate()
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