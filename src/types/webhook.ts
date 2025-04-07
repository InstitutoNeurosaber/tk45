export interface WebhookConfig {
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

export type WebhookEvent = 
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.status_changed'
  | 'ticket.assigned'
  | 'ticket.deleted';

export interface WebhookPayload {
  event: WebhookEvent;
  data: unknown;
  timestamp: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}