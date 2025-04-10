"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ticketService = void 0;
const admin = require("firebase-admin");
const ticket_1 = require("../types/ticket");
exports.ticketService = {
    async handleClickUpEvent(payload) {
        var _a, _b, _c, _d, _e, _f;
        try {
            const { event_type, task_id, history_items } = payload;
            // Buscar ticket pelo taskId
            const ticketsRef = admin.firestore().collection('tickets');
            const snapshot = await ticketsRef.where('taskId', '==', task_id).get();
            if (snapshot.empty) {
                console.log('Nenhum ticket encontrado para a tarefa:', task_id);
                return;
            }
            const ticketDoc = snapshot.docs[0];
            const ticketRef = ticketDoc.ref;
            switch (event_type) {
                case 'taskStatusUpdated': {
                    const newStatus = (_b = (_a = history_items[0]) === null || _a === void 0 ? void 0 : _a.after) === null || _b === void 0 ? void 0 : _b.status;
                    if (newStatus && ticket_1.clickupStatusReverseMap[newStatus]) {
                        await ticketRef.update({
                            status: ticket_1.clickupStatusReverseMap[newStatus],
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }
                    break;
                }
                case 'taskDeleted': {
                    await ticketRef.delete();
                    break;
                }
                case 'taskUpdated': {
                    const updates = {
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    };
                    history_items.forEach((item) => {
                        if (item.field === 'name') {
                            updates.title = item.after;
                        }
                        if (item.field === 'description') {
                            updates.description = item.after;
                        }
                        if (item.field === 'priority') {
                            const priorityValue = parseInt(item.after.priority);
                            if (ticket_1.clickupPriorityReverseMap[priorityValue]) {
                                updates.priority = ticket_1.clickupPriorityReverseMap[priorityValue];
                            }
                        }
                        if (item.field === 'due_date') {
                            updates.deadline = admin.firestore.Timestamp.fromMillis(parseInt(item.after));
                        }
                    });
                    if (Object.keys(updates).length > 1) { // > 1 porque sempre terá updatedAt
                        await ticketRef.update(updates);
                    }
                    break;
                }
                case 'taskCommentPosted': {
                    const comment = (_c = history_items[0]) === null || _c === void 0 ? void 0 : _c.comment;
                    if (comment) {
                        await ticketRef.update({
                            comments: admin.firestore.FieldValue.arrayUnion({
                                id: comment.id,
                                content: comment.text_content,
                                userId: comment.user.id,
                                userName: comment.user.username,
                                createdAt: admin.firestore.FieldValue.serverTimestamp()
                            }),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }
                    break;
                }
                case 'taskAssigned': {
                    const assignee = (_f = (_e = (_d = history_items[0]) === null || _d === void 0 ? void 0 : _d.after) === null || _e === void 0 ? void 0 : _e.assignees) === null || _f === void 0 ? void 0 : _f[0];
                    if (assignee) {
                        await ticketRef.update({
                            assignedToId: assignee.id,
                            assignedToName: assignee.username,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }
                    break;
                }
            }
        }
        catch (error) {
            console.error('Erro ao processar evento do ClickUp:', error);
            throw error;
        }
    },
    async updateTicketStatus(ticketId, status) {
        const ticketRef = admin.firestore().collection('tickets').doc(ticketId);
        await ticketRef.update({
            status,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    },
    async updateTicket(ticketId, data) {
        const ticketRef = admin.firestore().collection('tickets').doc(ticketId);
        await ticketRef.update(Object.assign(Object.assign({}, data), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
    },
    async addComment(ticketId, comment) {
        const ticketRef = admin.firestore().collection('tickets').doc(ticketId);
        await ticketRef.update({
            comments: admin.firestore.FieldValue.arrayUnion(Object.assign(Object.assign({ id: admin.firestore.Timestamp.now().toMillis().toString() }, comment), { createdAt: admin.firestore.FieldValue.serverTimestamp() })),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    },
    async deleteTicket(ticketId) {
        const ticketRef = admin.firestore().collection('tickets').doc(ticketId);
        await ticketRef.delete();
    }
};
//# sourceMappingURL=ticketService.js.map