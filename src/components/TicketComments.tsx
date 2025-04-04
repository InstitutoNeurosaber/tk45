import { CollaborativeComments } from './CollaborativeComments';
import type { Ticket, Comment } from '../types/ticket';

interface TicketCommentsProps {
  ticket: Ticket;
  onCommentAdded?: (comment: Comment) => void;
}

export function TicketComments({ ticket, onCommentAdded }: TicketCommentsProps) {
  return <CollaborativeComments ticket={ticket} onCommentAdded={onCommentAdded} />;
}