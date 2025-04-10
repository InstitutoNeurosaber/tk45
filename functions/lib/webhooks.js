"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupWebhookQueue = exports.processWebhookQueue = void 0;
const functions = require("firebase-functions/v2");
const admin = require("firebase-admin");
const axios_1 = require("axios");
const axios_retry_1 = require("axios-retry");
// Configurar axios com retry
const axiosInstance = axios_1.default.create({
    timeout: 30000
});
(0, axios_retry_1.default)(axiosInstance, {
    retries: 3,
    retryDelay: (retryCount) => {
        return retryCount * 1000;
    },
    retryCondition: (error) => {
        var _a;
        return axios_retry_1.default.isNetworkOrIdempotentRequestError(error) ||
            error.code === 'ECONNABORTED' ||
            (((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) && error.response.status >= 500);
    }
});
// Inicializar admin se ainda não foi feito
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
// Processar webhooks da fila a cada 1 minuto
exports.processWebhookQueue = functions.scheduler
    .onSchedule('every 1 minutes', {
    timeoutSeconds: 540,
    memory: '256MB'
})
    .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    try {
        // Buscar webhooks pendentes
        const queueRef = db.collection('webhook_queue');
        const pendingWebhooks = await queueRef
            .where('status', '==', 'pending')
            .where('nextAttempt', '<=', now)
            .where('attempts', '<', 3)
            .limit(10)
            .get();
        if (pendingWebhooks.empty) {
            console.log('Nenhum webhook pendente para processar');
            return null;
        }
        const batch = db.batch();
        const processPromises = [];
        pendingWebhooks.forEach(doc => {
            const webhook = doc.data();
            const processPromise = axiosInstance({
                method: 'POST',
                url: webhook.webhook.url,
                headers: Object.assign({ 'Content-Type': 'application/json', 'Accept': 'application/json' }, webhook.webhook.headers),
                data: webhook.data
            })
                .then(() => {
                batch.update(doc.ref, {
                    status: 'completed',
                    completedAt: now,
                    error: null
                });
                console.log(`Webhook ${doc.id} processado com sucesso`);
            })
                .catch(error => {
                var _a;
                const nextAttempt = new Date();
                nextAttempt.setMinutes(nextAttempt.getMinutes() + (webhook.attempts + 1) * 5);
                batch.update(doc.ref, {
                    status: webhook.attempts >= 2 ? 'failed' : 'pending',
                    attempts: webhook.attempts + 1,
                    nextAttempt: admin.firestore.Timestamp.fromDate(nextAttempt),
                    error: {
                        message: error.message,
                        code: error.code,
                        response: (_a = error.response) === null || _a === void 0 ? void 0 : _a.data
                    }
                });
                console.error(`Erro ao processar webhook ${doc.id}:`, error);
            });
            processPromises.push(processPromise);
        });
        await Promise.all(processPromises);
        await batch.commit();
        console.log(`Processados ${pendingWebhooks.size} webhooks`);
        return null;
    }
    catch (error) {
        console.error('Erro ao processar fila de webhooks:', error);
        return null;
    }
});
// Limpar webhooks antigos completados/falhados
exports.cleanupWebhookQueue = functions.scheduler
    .onSchedule('every 24 hours', {
    timeoutSeconds: 540,
    memory: '256MB'
})
    .onRun(async (context) => {
    const cutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    try {
        const queueRef = db.collection('webhook_queue');
        const oldWebhooks = await queueRef
            .where('status', 'in', ['completed', 'failed'])
            .where('createdAt', '<=', cutoff)
            .limit(100)
            .get();
        if (oldWebhooks.empty) {
            return null;
        }
        const batch = db.batch();
        oldWebhooks.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Removidos ${oldWebhooks.size} webhooks antigos`);
        return null;
    }
    catch (error) {
        console.error('Erro ao limpar fila de webhooks:', error);
        return null;
    }
});
//# sourceMappingURL=webhooks.js.map