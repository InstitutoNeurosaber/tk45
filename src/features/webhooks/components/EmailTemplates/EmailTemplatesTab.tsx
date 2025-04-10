import React, { useState, useEffect } from 'react';
import { EmailTemplatePreview } from './EmailTemplatePreview';
import './EmailTemplatesTab.css';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  trigger: 'created' | 'status_changed' | 'commented';
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
  }
];

const sampleVariables = {
  created: {
    userName: 'João Silva',
    ticketId: 'TK-123',
    ticketTitle: 'Problema com Login',
    ticketDescription: 'Usuários relatam dificuldade para fazer login no sistema.',
    createdAt: new Date().toLocaleString(),
  },
  status_changed: {
    userName: 'Maria Santos',
    ticketId: 'TK-456',
    ticketTitle: 'Atualizar Documentação',
    oldStatus: 'Em Andamento',
    newStatus: 'Concluído',
    updatedAt: new Date().toLocaleString(),
  },
  commented: {
    userName: 'Pedro Costa',
    ticketId: 'TK-789',
    ticketTitle: 'Bug no Relatório',
    commentText: 'O problema foi identificado e será corrigido na próxima sprint.',
    commentAuthor: 'Ana Lima',
    commentedAt: new Date().toLocaleString(),
  }
};

export const EmailTemplatesTab: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>(defaultTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (templates.length > 0 && !selectedTemplate) {
      setSelectedTemplate(templates[0]);
    }
  }, [templates]);

  const handleTemplateSelect = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setIsEditing(false);
    setShowPreview(false);
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setShowPreview(false);
  };

  const handlePreviewClick = () => {
    setShowPreview(true);
    setIsEditing(false);
  };

  const handleSave = (updatedTemplate: EmailTemplate) => {
    setTemplates(templates.map(t => 
      t.id === updatedTemplate.id ? updatedTemplate : t
    ));
    setSelectedTemplate(updatedTemplate);
    setIsEditing(false);
  };

  const availableVariables = {
    'created': [
      '{userName}', '{ticketId}', '{ticketTitle}', '{ticketDescription}', '{createdAt}'
    ],
    'status_changed': [
      '{userName}', '{ticketId}', '{ticketTitle}', '{oldStatus}', '{newStatus}', '{updatedAt}'
    ],
    'commented': [
      '{userName}', '{ticketId}', '{ticketTitle}', '{commentText}', '{commentAuthor}', '{commentedAt}'
    ]
  };

  if (!selectedTemplate) {
    return <div>Carregando templates...</div>;
  }

  return (
    <div className="email-templates-container">
      <div className="templates-list">
        <h2>Templates de Email</h2>
        <div className="templates-grid">
          {templates.map(template => (
            <div 
              key={template.id}
              className={`template-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
              onClick={() => handleTemplateSelect(template)}
            >
              <h3>{template.name}</h3>
              <p className="trigger-type">Gatilho: {template.trigger.replace('_', ' ')}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="template-editor">
        <div className="editor-header">
          <h2>{isEditing ? 'Editando Template' : 'Visualizando Template'}</h2>
          <div className="editor-actions">
            {!isEditing && !showPreview && (
              <>
                <button className="preview-button" onClick={handlePreviewClick}>
                  Visualizar
                </button>
                <button className="edit-button" onClick={handleEditClick}>
                  Editar
                </button>
              </>
            )}
            {showPreview && (
              <button className="back-button" onClick={() => setShowPreview(false)}>
                Voltar
              </button>
            )}
          </div>
        </div>

        {showPreview ? (
          <EmailTemplatePreview
            template={{
              trigger: selectedTemplate.trigger,
              variables: sampleVariables[selectedTemplate.trigger]
            }}
          />
        ) : isEditing ? (
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            handleSave({
              ...selectedTemplate,
              name: formData.get('name') as string,
              subject: formData.get('subject') as string,
              body: formData.get('body') as string,
            });
          }}>
            <div className="form-group">
              <label htmlFor="name">Nome do Template</label>
              <input
                id="name"
                name="name"
                defaultValue={selectedTemplate.name}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="subject">Assunto</label>
              <input
                id="subject"
                name="subject"
                defaultValue={selectedTemplate.subject}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="body">Corpo do Email</label>
              <textarea
                id="body"
                name="body"
                defaultValue={selectedTemplate.body}
                required
                rows={10}
              />
            </div>
            <div className="template-variables">
              <h4>Variáveis Disponíveis:</h4>
              <div className="variables-list">
                {availableVariables[selectedTemplate.trigger].map(variable => (
                  <span key={variable} className="variable-tag">
                    {variable}
                  </span>
                ))}
              </div>
            </div>
            <div className="button-group">
              <button type="submit" className="save-button">
                Salvar
              </button>
              <button
                type="button"
                className="cancel-button"
                onClick={() => setIsEditing(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="template-preview">
            <div className="preview-field">
              <label>Nome:</label>
              <p>{selectedTemplate.name}</p>
            </div>
            <div className="preview-field">
              <label>Assunto:</label>
              <p>{selectedTemplate.subject}</p>
            </div>
            <div className="preview-field">
              <label>Corpo:</label>
              <pre>{selectedTemplate.body}</pre>
            </div>
            <div className="template-variables">
              <h4>Variáveis Disponíveis:</h4>
              <div className="variables-list">
                {availableVariables[selectedTemplate.trigger].map(variable => (
                  <span key={variable} className="variable-tag">
                    {variable}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 