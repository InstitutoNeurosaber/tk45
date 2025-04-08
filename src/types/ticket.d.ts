export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  userId: string;
  userName?: string;
  createdAt: Date;
  updatedAt: Date;
  deadline?: Date;
  taskId?: string;
  listId?: string;
  clickupStatus?: string;
  attachments?: Attachment[];
  priorityLockedBy?: string;
  priorityLockedAt?: Date;
  priorityReason?: string;
  commentCount?: number;
}

export interface Comment {
  id: string;
  ticketId: string;
  content: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  createdAt: Date;
  attachments?: CommentAttachment[];
}

export interface CommentAttachment {
  id: string;
  url: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: Date;
} 