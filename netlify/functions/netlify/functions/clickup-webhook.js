import { ticketService } from '../../src/services/ticketService';
import { clickupStatusReverseMap, clickupPriorityReverseMap } from '../../src/types/ticket';
export const handler = async (event) => {
    var _a, _b, _c, _d, _e, _f;
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method Not Allowed' })
        };
    }
    try {
        const payload = JSON.parse(event.body || '{}');
        // Aqui você pode adicionar sua lógica de processamento do webhook
        console.log('Webhook recebido:', payload);
        const { event_type, task_id, history_items } = payload;
        // Buscar ticket pelo taskId
        const ticket = await ticketService.findByTaskId(task_id);
        if (!ticket) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'Ticket não encontrado' })
            };
        }
        switch (event_type) {
            case 'taskStatusUpdated': {
                const newStatus = (_b = (_a = history_items[0]) === null || _a === void 0 ? void 0 : _a.after) === null || _b === void 0 ? void 0 : _b.status;
                if (newStatus && clickupStatusReverseMap[newStatus]) {
                    await ticketService.updateTicketStatus(ticket.id, clickupStatusReverseMap[newStatus]);
                }
                break;
            }
            case 'taskDeleted': {
                await ticketService.deleteTicket(ticket.id);
                break;
            }
            case 'taskUpdated': {
                const updates = {};
                history_items.forEach((item) => {
                    if (item.field === 'name') {
                        updates.title = item.after;
                    }
                    if (item.field === 'description') {
                        updates.description = item.after;
                    }
                    if (item.field === 'priority') {
                        const priorityValue = parseInt(item.after.priority);
                        if (clickupPriorityReverseMap[priorityValue]) {
                            updates.priority = clickupPriorityReverseMap[priorityValue];
                        }
                    }
                    if (item.field === 'due_date') {
                        updates.deadline = new Date(parseInt(item.after));
                    }
                });
                if (Object.keys(updates).length > 0) {
                    await ticketService.updateTicket(ticket.id, updates);
                }
                break;
            }
            case 'taskCommentPosted': {
                const comment = (_c = history_items[0]) === null || _c === void 0 ? void 0 : _c.comment;
                if (comment) {
                    await ticketService.addComment(ticket.id, {
                        content: comment.text_content,
                        userId: comment.user.id,
                        userName: comment.user.username
                    });
                }
                break;
            }
            case 'taskAssigned': {
                const assignee = (_f = (_e = (_d = history_items[0]) === null || _d === void 0 ? void 0 : _d.after) === null || _e === void 0 ? void 0 : _e.assignees) === null || _f === void 0 ? void 0 : _f[0];
                if (assignee) {
                    await ticketService.updateTicket(ticket.id, {
                        assignedToId: assignee.id,
                        assignedToName: assignee.username
                    });
                }
                break;
            }
        }
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Webhook processado com sucesso' })
        };
    }
    catch (error) {
        console.error('Erro ao processar webhook:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Erro interno do servidor' })
        };
    }
};
