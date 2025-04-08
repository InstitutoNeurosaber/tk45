export type WebhookEvent = 
  | 'ticket.created' 
  | 'ticket.updated' 
  | 'ticket.status_changed' 
  | 'ticket.assigned' 
  | 'ticket.deleted'; 