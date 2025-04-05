import React, { useState, useEffect, useRef } from 'react';
import { ChatContainer, MessageList, Message, MessageInput, TypingIndicator } from '@chatscope/chat-ui-kit-react';
import { useAuth } from '../contexts/AuthContext';
import { useTickets } from '../contexts/TicketContext';
import { ClickUpService } from '../services/clickupService';
import { Image as ImageIcon, Send } from 'lucide-react';
import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

interface ChatCommentsProps {
  ticketId: string;
}

interface Comment {
  id: string;
  content: string;
  userId: string;
  userName: string;
  ticketId: string;
  createdAt: Date;
}

export const ChatComments: React.FC<ChatCommentsProps> = ({ ticketId }) => {
  const { user } = useAuth();
  const { addComment, comments, loading } = useTickets();
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (message: string) => {
    if (!message.trim() || !user) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const comment: Comment = {
        id: uuidv4(),
        content: message,
        userId: user.uid,
        userName: user.displayName || 'Usuário',
        ticketId,
        createdAt: new Date()
      };

      await addComment(comment);
      setNewComment('');

      // Sincronizar com o ClickUp
      const clickupService = new ClickUpService();
      setIsSyncing(true);
      try {
        await clickupService.addComment(ticketId, comment);
      } catch (error) {
        console.error('Erro ao sincronizar com ClickUp:', error);
      } finally {
        setIsSyncing(false);
      }
    } catch (error) {
      setError('Erro ao adicionar comentário');
      console.error('Erro ao adicionar comentário:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!user) return;

    try {
      const storageRef = ref(storage, `tickets/${ticketId}/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const comment: Comment = {
        id: uuidv4(),
        content: `![${file.name}](${url})`,
        userId: user.uid,
        userName: user.displayName || 'Usuário',
        ticketId,
        createdAt: new Date()
      };

      await addComment(comment);

      // Sincronizar com o ClickUp
      const clickupService = new ClickUpService();
      setIsSyncing(true);
      try {
        await clickupService.addComment(ticketId, comment);
      } catch (error) {
        console.error('Erro ao sincronizar com ClickUp:', error);
      } finally {
        setIsSyncing(false);
      }
    } catch (error) {
      setError('Erro ao fazer upload da imagem');
      console.error('Erro ao fazer upload:', error);
    }
  };

  const formatMessage = (comment: Comment) => ({
    message: comment.content,
    sender: comment.userId,
    direction: comment.userId === user?.uid ? 'outgoing' : 'incoming',
    position: 'single',
    timestamp: new Date(comment.createdAt).toLocaleString('pt-BR')
  });

  return (
    <div className="flex flex-col h-[500px] min-h-[300px] bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Comentários</h2>
      </div>

      <div className="flex-1 overflow-hidden">
        <ChatContainer>
          <MessageList
            typingIndicator={isSyncing ? <TypingIndicator content="Sincronizando com ClickUp..." /> : null}
          >
            {comments
              .filter((comment: Comment) => comment.ticketId === ticketId)
              .map((comment: Comment) => (
                <Message
                  key={comment.id}
                  model={formatMessage(comment)}
                />
              ))}
          </MessageList>
          <MessageInput
            placeholder="Digite sua mensagem..."
            onSend={handleSubmit}
            attachButton={false}
            disabled={isSubmitting}
          />
        </ChatContainer>
      </div>

      {error && (
        <div className="p-2 text-red-500 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}; 