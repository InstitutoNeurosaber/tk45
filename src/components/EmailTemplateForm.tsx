import { useState } from 'react';
import './EmailTemplateForm.css';

interface EmailTemplate {
  name: string;
  subject: string;
  body: string;
  description: string;
}

interface EmailTemplateFormProps {
  onSubmit: (template: EmailTemplate) => void;
  initialData?: EmailTemplate;
}

export const EmailTemplateForm = ({ onSubmit, initialData }: EmailTemplateFormProps) => {
  const [template, setTemplate] = useState<EmailTemplate>(
    initialData || {
      name: '',
      subject: '',
      body: '',
      description: '',
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!template.name || !template.subject || !template.body) {
      alert('Por favor preencha todos os campos obrigatórios');
      return;
    }

    onSubmit(template);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setTemplate((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="email-template-form">
      <div className="form-group">
        <label htmlFor="name">Nome do Template *</label>
        <input
          id="name"
          name="name"
          value={template.name}
          onChange={handleChange}
          placeholder="Digite o nome do template"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="subject">Assunto *</label>
        <input
          id="subject"
          name="subject"
          value={template.subject}
          onChange={handleChange}
          placeholder="Digite o assunto do email"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="body">Corpo do Email *</label>
        <textarea
          id="body"
          name="body"
          value={template.body}
          onChange={handleChange}
          placeholder="Digite o conteúdo do email"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="description">Descrição</label>
        <textarea
          id="description"
          name="description"
          value={template.description}
          onChange={handleChange}
          placeholder="Digite uma descrição para o template (opcional)"
        />
      </div>

      <button type="submit" className="submit-button">
        Salvar Template
      </button>
    </form>
  );
}; 