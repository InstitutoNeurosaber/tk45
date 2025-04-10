"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const https_1 = require("firebase-functions/v2/https");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
// Carrega as variáveis de ambiente
dotenv.config();
// Configuração do transporter do Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
// Função para enviar email
exports.sendEmail = (0, https_1.onCall)({
    region: 'southamerica-east1',
    maxInstances: 10
}, async (request) => {
    // Verifica se o usuário está autenticado
    if (!request.auth) {
        throw new Error('O usuário precisa estar autenticado para enviar emails.');
    }
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: request.data.to,
            subject: request.data.subject,
            text: request.data.text,
            html: request.data.html
        };
        const result = await transporter.sendMail(mailOptions);
        return { success: true, messageId: result.messageId };
    }
    catch (error) {
        console.error('Erro ao enviar email:', error);
        throw new Error('Erro ao enviar email');
    }
});
//# sourceMappingURL=index.js.map