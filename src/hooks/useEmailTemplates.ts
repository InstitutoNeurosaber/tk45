import { useState } from 'react';
import { EmailTemplate } from '../types/EmailTemplate';
import { emailTemplateService } from '../services/emailTemplateService';
import { toast } from 'react-toastify';

export function useEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const data = await emailTemplateService.getAll();
      setTemplates(data);
    } catch (error) {
      console.error('Erro ao buscar templates:', error);
      toast.error('Não foi possível carregar os templates de email');
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async (template: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setLoading(true);
      const newTemplate = await emailTemplateService.create(template);
      setTemplates(prev => [newTemplate, ...prev]);
      toast.success('Template criado com sucesso!');
      return newTemplate;
    } catch (error) {
      console.error('Erro ao criar template:', error);
      toast.error('Não foi possível criar o template');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateTemplate = async (id: number, template: Partial<EmailTemplate>) => {
    try {
      setLoading(true);
      const updatedTemplate = await emailTemplateService.update(id, template);
      setTemplates(prev => prev.map(t => t.id === id ? updatedTemplate : t));
      toast.success('Template atualizado com sucesso!');
      return updatedTemplate;
    } catch (error) {
      console.error('Erro ao atualizar template:', error);
      toast.error('Não foi possível atualizar o template');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (id: number) => {
    try {
      setLoading(true);
      await emailTemplateService.delete(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
      toast.success('Template removido com sucesso!');
    } catch (error) {
      console.error('Erro ao deletar template:', error);
      toast.error('Não foi possível remover o template');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = (template: EmailTemplate | null) => {
    setSelectedTemplate(template);
  };

  return {
    templates,
    loading,
    selectedTemplate,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    selectTemplate
  };
} 