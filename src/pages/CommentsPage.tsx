import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  MessageSquare, 
  Loader
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Comments } from '../components/Comments';
import { useAuthStore } from '../stores/authStore';
import { Ticket } from '../types/ticket';

export function CommentsPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticketId) {
      setError('ID do ticket não fornecido');
      setLoading(false);
      return;
    }

    const fetchTicket = async () => {
      try {
        setLoading(true);
        const ticketDoc = await getDoc(doc(db, 'tickets', ticketId));
        
        if (!ticketDoc.exists()) {
          setError('Ticket não encontrado');
          setLoading(false);
          return;
        }
        
        const ticketData = ticketDoc.data();
        setTicket({
          id: ticketDoc.id,
          ...ticketData,
          createdAt: ticketData.createdAt.toDate(),
          updatedAt: ticketData.updatedAt.toDate(),
          deadline: ticketData.deadline?.toDate()
        } as Ticket);
        
        setLoading(false);
      } catch (err) {
        console.error('Erro ao carregar ticket:', err);
        setError('Erro ao carregar ticket. Por favor, tente novamente.');
        setLoading(false);
      }
    };

    fetchTicket();
  }, [ticketId]);

  // Voltar para a página anterior
  const handleBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" aria-busy="true" aria-live="polite">
        <Loader className="h-10 w-10 text-primary animate-spin" />
        <span className="sr-only">Carregando...</span>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error || 'Ticket não encontrado'}</p>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <button 
            onClick={handleBack}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Cabeçalho */}
      <div className="mb-6">
        <button 
          onClick={handleBack}
          className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 mb-4"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </button>
        
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <MessageSquare className="h-6 w-6 mr-2 text-blue-600" />
          Comentários
        </h1>
        <p className="text-gray-600 mt-1">Ticket: {ticket.title}</p>
      </div>
      
      {/* Container de comentários */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <Comments ticket={ticket} />
      </div>
    </div>
  );
} 