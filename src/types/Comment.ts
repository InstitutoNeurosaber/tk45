export interface CommentAttachment {
  id: string;
  url: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: Date;
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