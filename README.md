# Sistema de Gestão de Tickets com Integração ao ClickUp

## Visão Geral

O sistema é uma plataforma de gestão de tickets (help desk) com integração nativa ao ClickUp, projetada para facilitar o gerenciamento de solicitações de suporte, problemas e tarefas em ambientes corporativos. A plataforma oferece uma interface intuitiva para usuários e administradores, com recursos avançados de rastreamento, categorização e priorização de tickets.

## Características Principais

- **Gerenciamento de Tickets**: Criação, atualização, atribuição e fechamento de tickets
- **Categorização e Priorização**: Organização de tickets por categoria (software, hardware, rede, outros) e prioridade (baixa, normal, alta, urgente)
- **Fluxo de Trabalho Definido**: Estados de tickets (aberto, em andamento, resolvido, fechado)
- **Controle de Acesso**: Diferentes níveis de acesso para usuários e administradores
- **Notificações**: Sistema de notificações para manter os usuários informados sobre atualizações
- **Dashboard Analítico**: Visualização de métricas e estatísticas para administradores
- **Integrações**: Sincronização bidirecional com ClickUp e possibilidade de integração com Gmail
- **Webhooks**: Configuração de webhooks para integração com sistemas externos

## Arquitetura Técnica

### Frontend
- **Framework**: React com TypeScript
- **UI**: Tailwind CSS para estilização
- **Gerenciamento de Estado**: Zustand para gerenciamento global de estado
- **Roteamento**: React Router para navegação
- **Formulários**: React Hook Form para validação e gerenciamento de formulários

### Backend
- **Firebase**: Backend como serviço (BaaS)
  - Firestore: Banco de dados NoSQL
  - Authentication: Autenticação e autorização
  - Storage: Armazenamento de arquivos e anexos
  - Cloud Functions: Funções serverless para processamento em segundo plano
- **Netlify Functions**: Funções serverless para endpoints de API, especialmente para webhooks

### Integrações
- **ClickUp**: Sincronização bidirecional de tickets como tarefas
- **Gmail**: Integração opcional para envio e recebimento de emails relacionados a tickets
- **Webhooks**: Suporte a webhooks personalizáveis para integrações com sistemas externos

## Modelo de Dados

### Tickets
```typescript
interface Ticket {
  id: string;
  title: string;
  description: string;
  category: 'software' | 'hardware' | 'network' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: Date;
  updatedAt: Date;
  deadline: Date;
  deadlineHistory?: DeadlineHistory[];
  userId: string;
  assignedToId?: string;
  assignedToName?: string;
  comments?: Comment[];
  attachments?: Attachment[];
  taskId?: string;  // ID da tarefa no ClickUp
  gmailId?: string; // ID da mensagem no Gmail
  priorityLockedBy?: string;
  priorityLockedAt?: Date;
  priorityReason?: string;
}
```

### Usuários
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date | null;
  profile?: UserProfile;
}
```

### Webhooks
```typescript
interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  testUrl?: string;
  events: WebhookEvent[];
  headers?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  active: boolean;
}
```

## Fluxo de Trabalho de Tickets

1. **Criação**: Um usuário cria um ticket especificando título, descrição, categoria e prioridade
2. **Notificação**: O sistema notifica os administradores sobre o novo ticket
3. **Atribuição**: Um administrador pode atribuir o ticket a um usuário específico
4. **Processamento**: O ticket passa pelos estados: aberto → em andamento → resolvido → fechado
5. **Sincronização com ClickUp**: O ticket é automaticamente sincronizado como uma tarefa no ClickUp
6. **Bidirecionamento**: Alterações feitas no ClickUp são refletidas no sistema e vice-versa

## Prazo de Resolução Baseado em Prioridade

- **Baixa**: 7 dias
- **Normal**: 3 dias
- **Alta**: 24 horas
- **Urgente**: 4 horas

## Integrações Externas

### ClickUp
A integração com o ClickUp permite:
- Criação automática de tarefas no ClickUp quando tickets são criados
- Sincronização do status entre ticket e tarefa
- Atualização de títulos, descrições e prioridades em ambos os sistemas
- Comentários sincronizados entre o ticket e a tarefa

### Gmail (Opcional)
A integração com o Gmail permite:
- Criação de tickets a partir de emails recebidos
- Envio de notificações por email quando tickets são atualizados
- Vinculação de conversas de email a tickets existentes

## Webhooks

O sistema suporta webhooks configuráveis para integração com sistemas externos:

### Eventos suportados:
- `ticket.created`: Quando um novo ticket é criado
- `ticket.updated`: Quando um ticket é atualizado
- `ticket.status_changed`: Quando o status de um ticket muda
- `ticket.comment_added`: Quando um comentário é adicionado a um ticket
- `ticket.assigned`: Quando um ticket é atribuído a um usuário
- `ticket.deleted`: Quando um ticket é excluído

## Componentes Principais

### Dashboard
Interface para administradores visualizarem métricas como:
- Total de tickets
- Tickets por status
- Tickets por categoria
- Tempo médio de resolução
- Variação no volume de tickets

### Lista de Tickets
Visualização principal para usuários e administradores com:
- Filtros por status, prioridade e categoria
- Busca por título ou descrição
- Ordenação por diferentes campos
- Ações rápidas (mudança de status, atribuição)

### Detalhes do Ticket
Interface detalhada para visualizar e editar tickets:
- Informações completas do ticket
- Histórico de alterações
- Comentários e discussões
- Anexos e documentos
- Controles para mudança de status e prioridade

### Configuração de Webhooks
Interface para administradores configurarem webhooks:
- Criação de novos webhooks
- Seleção de eventos a serem notificados
- Teste de webhooks
- Ativação/desativação de webhooks

## Funções Netlify

O sistema utiliza funções Netlify para processar webhooks e interações com APIs externas:

### clickup-webhook.ts
Processa webhooks recebidos do ClickUp, atualizando os tickets correspondentes quando tarefas são modificadas.

### tickets.ts
Fornece APIs para gerenciamento de tickets através de endpoints HTTP.

## Segurança

- Autenticação baseada em Firebase Authentication
- Autorização baseada em funções (roles)
- CORS configurado para proteger endpoints de API
- Validação de dados em todos os endpoints
- Rate limiting para prevenir abusos

## Escalabilidade

O sistema foi projetado para escalar através de:
- Uso de Firebase para gerenciamento automático de infraestrutura
- Funções serverless para processamento sem servidor
- Cache otimizado para reduzir chamadas de banco de dados
- Estratégias de retry com backoff exponencial para operações com sistemas externos

## Manutenção e Monitoramento

- Logs detalhados para rastreamento de erros
- Fila de webhooks com retry automático para operações falhas
- Tratamento consistente de erros em toda a aplicação

## Requisitos Técnicos

- Node.js 18+ para desenvolvimento e deploy
- Firebase projeto configurado
- Conta Netlify para deploy
- Conta ClickUp para integração (opcional)
- Conta Gmail para integração (opcional)

## Ambiente de Desenvolvimento

1. Clone o repositório
2. Execute `npm install` para instalar dependências
3. Configure as variáveis de ambiente necessárias
4. Execute `npm run dev` para iniciar o servidor de desenvolvimento
5. Execute `npm run build` para compilar para produção

## Deploy

O sistema é configurado para deploy no Netlify, com as funções serverless processadas pelo Netlify Functions.