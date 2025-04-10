import { useState, useEffect } from 'react';
import { emailService } from '../services/emailService';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  trigger: 'created' | 'status_changed' | 'commented' | 'deadline_changed' | 'priority_changed';
}

const defaultTemplates: EmailTemplate[] = [
  {
    id: 'ticket-created',
    name: 'Ticket Criado',
    subject: 'Novo Ticket: #{ticketId}',
    body: `Olá {userName},

Um novo ticket foi criado:

ID: #{ticketId}
Título: {ticketTitle}
Descrição: {ticketDescription}

Acesse o sistema para mais detalhes.`,
    trigger: 'created'
  },
  {
    id: 'status-changed',
    name: 'Status Alterado',
    subject: 'Status do Ticket #{ticketId} Atualizado',
    body: `Olá {userName},

O status do ticket #{ticketId} foi alterado:

Status Anterior: {oldStatus}
Novo Status: {newStatus}
Título: {ticketTitle}

Acesse o sistema para mais detalhes.`,
    trigger: 'status_changed'
  },
  {
    id: 'new-comment',
    name: 'Novo Comentário',
    subject: 'Novo Comentário no Ticket #{ticketId}',
    body: `Olá {userName},

Um novo comentário foi adicionado ao ticket #{ticketId}:

Comentário: {commentText}
Por: {commentAuthor}

Acesse o sistema para mais detalhes.`,
    trigger: 'commented'
  },
  {
    id: 'deadline-changed',
    name: 'Prazo Alterado',
    subject: 'Prazo do Ticket #{ticketId} Atualizado',
    body: `Olá {userName},

O prazo do ticket #{ticketId} foi alterado:

Prazo Anterior: {oldDeadline}
Novo Prazo: {newDeadline}
Título: {ticketTitle}

Acesse o sistema para mais detalhes.`,
    trigger: 'deadline_changed'
  },
  {
    id: 'priority-changed',
    name: 'Prioridade Alterada',
    subject: 'Prioridade do Ticket #{ticketId} Atualizada',
    body: `Olá {userName},

A prioridade do ticket #{ticketId} foi alterada:

Prioridade Anterior: {oldPriority}
Nova Prioridade: {newPriority}
Título: {ticketTitle}

Acesse o sistema para mais detalhes.`,
    trigger: 'priority_changed'
  }
];

export const useEmailTemplates = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>(defaultTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    emailService.setTemplates(templates);
  }, [templates]);

  const updateTemplate = (updatedTemplate: EmailTemplate) => {
    setTemplates(prevTemplates =>
      prevTemplates.map(template =>
        template.id === updatedTemplate.id ? updatedTemplate : template
      )
    );
    setSelectedTemplate(updatedTemplate);
    setIsEditing(false);
  };

  return {
    templates,
    selectedTemplate,
    isEditing,
    setSelectedTemplate,
    setIsEditing,
    updateTemplate,
  };
}; 