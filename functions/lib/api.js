"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.deleteTicket = exports.addTicketComment = exports.updateTicketPriority = exports.updateTicketStatus = exports.createTicket = void 0;
const functions = require("firebase-functions/v2");
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const ticketService_1 = require("./services/ticketService");
// Middleware para validar token de API
const validateApiKey = async (req) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey)
        return false;
    try {
        const apiKeysRef = admin.firestore().collection('api_keys');
        const snapshot = await apiKeysRef.where('key', '==', apiKey).where('active', '==', true).get();
        return !snapshot.empty;
    }
    catch (error) {
        console.error('Erro ao validar API key:', error);
        return false;
    }
};
// Endpoint para criar ticket
exports.createTicket = functions.https.onRequest(async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Método não permitido' });
            return;
        }
        const isValidKey = await validateApiKey(req);
        if (!isValidKey) {
            res.status(401).json({ error: 'API key inválida' });
            return;
        }
        const { title, description, category, priority } = req.body;
        if (!title || !description || !category || !priority) {
            res.status(400).json({ error: 'Dados inválidos' });
            return;
        }
        const ticket = await ticketService_1.ticketService.createTicket({
            title,
            description,
            category,
            priority,
            userId: 'system'
        });
        res.status(201).json(ticket);
    }
    catch (error) {
        console.error('Erro ao criar ticket:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});
// Endpoint para atualizar status
exports.updateTicketStatus = functions.https.onRequest(async (req, res) => {
    try {
        if (req.method !== 'PUT') {
            res.status(405).json({ error: 'Método não permitido' });
            return;
        }
        const isValidKey = await validateApiKey(req);
        if (!isValidKey) {
            res.status(401).json({ error: 'API key inválida' });
            return;
        }
        const { ticketId } = req.params;
        const { status } = req.body;
        if (!ticketId || !status) {
            res.status(400).json({ error: 'Dados inválidos' });
            return;
        }
        await ticketService_1.ticketService.updateTicketStatus(ticketId, status);
        res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('Erro ao atualizar status:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});
// Endpoint para atualizar prioridade
exports.updateTicketPriority = functions.https.onRequest(async (req, res) => {
    try {
        if (req.method !== 'PUT') {
            res.status(405).json({ error: 'Método não permitido' });
            return;
        }
        const isValidKey = await validateApiKey(req);
        if (!isValidKey) {
            res.status(401).json({ error: 'API key inválida' });
            return;
        }
        const { ticketId } = req.params;
        const { priority } = req.body;
        if (!ticketId || !priority) {
            res.status(400).json({ error: 'Dados inválidos' });
            return;
        }
        await ticketService_1.ticketService.updateTicket(ticketId, { priority });
        res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('Erro ao atualizar prioridade:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});
// Endpoint para adicionar comentário
exports.addTicketComment = functions.https.onRequest(async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Método não permitido' });
            return;
        }
        const isValidKey = await validateApiKey(req);
        if (!isValidKey) {
            res.status(401).json({ error: 'API key inválida' });
            return;
        }
        const { ticketId } = req.params;
        const { content, userId } = req.body;
        if (!ticketId || !content || !userId) {
            res.status(400).json({ error: 'Dados inválidos' });
            return;
        }
        const comment = await ticketService_1.ticketService.addComment(ticketId, {
            content,
            userId
        });
        res.status(201).json(comment);
    }
    catch (error) {
        console.error('Erro ao adicionar comentário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});
// Endpoint para excluir ticket
exports.deleteTicket = functions.https.onRequest(async (req, res) => {
    try {
        if (req.method !== 'DELETE') {
            res.status(405).json({ error: 'Método não permitido' });
            return;
        }
        const isValidKey = await validateApiKey(req);
        if (!isValidKey) {
            res.status(401).json({ error: 'API key inválida' });
            return;
        }
        const { ticketId } = req.params;
        if (!ticketId) {
            res.status(400).json({ error: 'ID do ticket não fornecido' });
            return;
        }
        await ticketService_1.ticketService.deleteTicket(ticketId);
        res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('Erro ao excluir ticket:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});
// Função para deletar usuário
exports.deleteUser = functions.https.onCall(async (data, context) => {
    // Verificar se o usuário está autenticado
    if (!context.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    // Verificar se o usuário é admin
    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    const userData = userDoc.data();
    if (!userData || userData.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Apenas administradores podem deletar usuários');
    }
    const { userId } = data;
    if (!userId) {
        throw new https_1.HttpsError('invalid-argument', 'ID do usuário não fornecido');
    }
    try {
        // Deletar usuário do Firestore
        await admin.firestore().collection('users').doc(userId).delete();
        // Deletar usuário do Authentication
        await admin.auth().deleteUser(userId);
        return { success: true };
    }
    catch (error) {
        console.error('Erro ao deletar usuário:', error);
        throw new https_1.HttpsError('internal', 'Erro ao deletar usuário');
    }
});
//# sourceMappingURL=api.js.map