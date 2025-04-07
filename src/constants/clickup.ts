// Constantes para integração com ClickUp

// Mapeamento de status do sistema para ClickUp
export const STATUS_MAP = {
  'open': 'ABERTO',
  'in_progress': 'EM ANDAMENTO', 
  'resolved': 'RESOLVIDO',
  'closed': 'FECHADO'
};

// Mapeamento inverso (de ClickUp para o sistema)
export const REVERSE_STATUS_MAP = {
  'ABERTO': 'open',
  'EM ANDAMENTO': 'in_progress',
  'RESOLVIDO': 'resolved',
  'FECHADO': 'closed'
};

// Mapeamento de prioridade do sistema para ClickUp
export const PRIORITY_MAP = {
  'low': 3,
  'medium': 2, 
  'high': 1,
  'critical': 4
};

// Mapeamento inverso de prioridade (de ClickUp para o sistema)
export const REVERSE_PRIORITY_MAP = {
  3: 'low',
  2: 'medium',
  1: 'high',
  4: 'critical'
};

// Constantes de URLs e configurações
export const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

// Métodos para validação de dados
export const isValidTicketId = (id: string | undefined): boolean => {
  return typeof id === 'string' && id.length > 0;
};

// Nome do campo personalizado para ID do ticket
export const TICKET_ID_FIELD_NAME = 'ticket_id';

// Mensagens de erro para melhor padronização 
export const ERROR_MESSAGES = {
  INVALID_API_KEY: 'API Key inválida ou expirada. Verifique sua configuração.',
  LIST_NOT_FOUND: 'Lista não encontrada. Verifique o ID da lista nas configurações.',
  STATUS_NOT_FOUND: 'Status não encontrado. Verifique se sua lista do ClickUp possui os status: ABERTO, EM ANDAMENTO, RESOLVIDO e FECHADO.',
  UNAUTHORIZED: 'Sem permissão para acessar esta lista. Verifique suas permissões.',
  LIST_ID_REQUIRED: 'ID da lista é obrigatório para sincronização com ClickUp.',
  INVALID_UUID: 'Campo personalizado com formato inválido. O ID do campo personalizado deve ser um UUID válido.',
  DEFAULT_ERROR: 'Erro ao comunicar com o ClickUp. Tente novamente mais tarde.'
}; 