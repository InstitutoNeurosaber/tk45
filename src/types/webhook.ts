export type WebhookEvent = 
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.deleted'
  | 'ticket.status_changed'
  | 'ticket.commented'
  | 'ticket.deadline_changed'
  | 'ticket.priority_changed';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  event: EmailEvent;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type EmailEvent = 
  | 'ticket_created'
  | 'ticket_updated'
  | 'ticket_closed'
  | 'comment_added'
  | 'attachment_added';

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  testUrl?: string;
  events: WebhookEvent[];
  active: boolean;
  userId: string;
  headers?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  description?: string;
  emailTemplates?: EmailTemplate[];
}

export interface WebhookPayload {
  event: WebhookEvent;
  data: unknown;
  timestamp: string;
  targetUrl?: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}