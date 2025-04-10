import { EmailTemplate } from '../types/EmailTemplate';
import { supabase } from '../lib/supabaseClient';

const TABLE_NAME = 'email_templates';

export const emailTemplateService = {
  async getAll(): Promise<EmailTemplate[]> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getById(id: number): Promise<EmailTemplate | null> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async create(template: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<EmailTemplate> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert([template])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: number, template: Partial<EmailTemplate>): Promise<EmailTemplate> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(template)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: number): Promise<void> {
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}; 