import React, { useEffect, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { TicketCreatedEmail } from './templates/TicketCreatedEmail';
import { StatusChangedEmail } from './templates/StatusChangedEmail';
import { NewCommentEmail } from './templates/NewCommentEmail';

interface EmailTemplatePreviewProps {
  template: {
    trigger: string;
    variables: Record<string, string>;
  };
}

export const EmailTemplatePreview: React.FC<EmailTemplatePreviewProps> = ({ template }) => {
  const [renderedHtml, setRenderedHtml] = useState<string>('');

  useEffect(() => {
    const renderEmailTemplate = () => {
      const baseUrl = import.meta.env.VITE_BASE_URL || 'http://localhost:3000';
      const ticketUrl = `${baseUrl}/tickets/${template.variables.ticketId}`;

      let emailComponent;
      switch (template.trigger) {
        case 'created':
          emailComponent = (
            <TicketCreatedEmail
              userName={template.variables.userName}
              ticketId={template.variables.ticketId}
              ticketTitle={template.variables.ticketTitle}
              ticketDescription={template.variables.ticketDescription}
              createdAt={template.variables.createdAt}
              ticketUrl={ticketUrl}
            />
          );
          break;

        case 'status_changed':
          emailComponent = (
            <StatusChangedEmail
              userName={template.variables.userName}
              ticketId={template.variables.ticketId}
              ticketTitle={template.variables.ticketTitle}
              oldStatus={template.variables.oldStatus}
              newStatus={template.variables.newStatus}
              updatedAt={template.variables.updatedAt}
              ticketUrl={ticketUrl}
            />
          );
          break;

        case 'commented':
          emailComponent = (
            <NewCommentEmail
              userName={template.variables.userName}
              ticketId={template.variables.ticketId}
              ticketTitle={template.variables.ticketTitle}
              commentText={template.variables.commentText}
              commentAuthor={template.variables.commentAuthor}
              commentedAt={template.variables.commentedAt}
              ticketUrl={ticketUrl}
            />
          );
          break;

        default:
          emailComponent = <div>Template não encontrado</div>;
      }

      try {
        // Renderiza o componente de email para HTML
        const html = renderToString(emailComponent);
        
        // Adiciona meta tags e estilos necessários
        const fullHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Visualização do Email</title>
              <style>
                body {
                  margin: 0;
                  padding: 0;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  background-color: #ffffff;
                }
                .email-container {
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                }
              </style>
            </head>
            <body>
              <div class="email-container">
                ${html}
              </div>
            </body>
          </html>
        `;
        
        setRenderedHtml(fullHtml);
      } catch (error) {
        console.error('Erro ao renderizar o template:', error);
        setRenderedHtml('<div>Erro ao renderizar o template</div>');
      }
    };

    renderEmailTemplate();
  }, [template]);

  return (
    <div className="email-preview" style={{ height: '100%', backgroundColor: '#f5f5f5', padding: '20px' }}>
      <iframe
        srcDoc={renderedHtml}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '8px',
          backgroundColor: '#ffffff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
        sandbox="allow-same-origin"
        title="Visualização do Email"
      />
    </div>
  );
}; 