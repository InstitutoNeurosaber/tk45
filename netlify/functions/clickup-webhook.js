const axios = require('axios');

// Mapas para converter status e prioridade do ClickUp
const clickupStatusReverseMap = {
  'to do': 'pending',
  'in progress': 'in_progress',
  'in review': 'reviewing',
  'done': 'completed',
  'closed': 'closed'
};

const clickupPriorityReverseMap = {
  1: 'urgent',
  2: 'high',
  3: 'normal',
  4: 'low'
};

exports.handler = async (event) => {
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

    // Note: Implementação simplificada para evitar erros
    console.log(`Processando webhook do ClickUp para task ${task_id}`);
    console.log(`Tipo de evento: ${event_type}`);

    // Implementação baseada no tipo de evento
    switch (event_type) {
      case 'taskStatusUpdated': {
        const newStatus = history_items[0]?.after?.status;
        if (newStatus && clickupStatusReverseMap[newStatus]) {
          console.log(`Status atualizado para: ${newStatus} (${clickupStatusReverseMap[newStatus]})`);
          // Implementação será feita diretamente no frontend
        }
        break;
      }

      case 'taskDeleted': {
        console.log(`Task ${task_id} excluída`);
        // Implementação será feita diretamente no frontend
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

        console.log(`Task ${task_id} atualizada:`, updates);
        // Implementação será feita diretamente no frontend
        break;
      }

      case 'taskCommentPosted': {
        const comment = history_items[0]?.comment;
        if (comment) {
          console.log(`Novo comentário de ${comment.user.username}: ${comment.text_content}`);
          // Implementação será feita diretamente no frontend
        }
        break;
      }

      case 'taskAssigned': {
        const assignee = history_items[0]?.after?.assignees?.[0];
        if (assignee) {
          console.log(`Task ${task_id} atribuída para: ${assignee.username}`);
          // Implementação será feita diretamente no frontend
        }
        break;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook processado com sucesso' })
    };
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Erro interno do servidor' })
    };
  }
}; 