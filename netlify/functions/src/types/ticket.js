export const statusLabels = {
    open: 'Aberto',
    in_progress: 'Em Andamento',
    resolved: 'Resolvido',
    closed: 'Fechado'
};
export const priorityLabels = {
    low: 'Baixa',
    medium: 'Normal',
    high: 'Alta',
    critical: 'Urgente'
};
export const categoryLabels = {
    software: 'Software',
    hardware: 'Hardware',
    network: 'Rede',
    other: 'Outro'
};
export const statusColors = {
    open: 'bg-red-100 text-red-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    resolved: 'bg-blue-100 text-blue-800',
    closed: 'bg-green-100 text-green-800'
};
export const priorityColors = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-blue-100 text-blue-800',
    high: 'bg-yellow-100 text-yellow-800',
    critical: 'bg-red-100 text-red-800'
};
export const priorityDeadlines = {
    low: 7 * 24 * 60 * 60 * 1000, // 7 dias
    medium: 3 * 24 * 60 * 60 * 1000, // 3 dias
    high: 24 * 60 * 60 * 1000, // 24 horas
    critical: 4 * 60 * 60 * 1000 // 4 horas
};
// Mapeamento de status para o ClickUp
export const clickupStatusMap = {
    open: 'ABERTO',
    in_progress: 'EM ANDAMENTO',
    resolved: 'RESOLVIDO',
    closed: 'FECHADO'
};
// Mapeamento reverso para converter status do ClickUp em status do sistema
export const clickupStatusReverseMap = {
    'ABERTO': 'open',
    'EM ANDAMENTO': 'in_progress',
    'RESOLVIDO': 'resolved',
    'FECHADO': 'closed'
};
//  Mapeamento de prioridades para o ClickUp
export const clickupPriorityMap = {
    critical: 1, // Urgente
    high: 2, // Alta
    medium: 3, // Normal
    low: 4 // Baixa
};
// Mapeamento reverso de prioridades do ClickUp
export const clickupPriorityReverseMap = {
    1: 'critical', // Urgente
    2: 'high', // Alta
    3: 'medium', // Normal
    4: 'low' // Baixa
};
