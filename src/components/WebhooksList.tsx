import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { AlertCircle } from 'lucide-react';

interface Webhook {
  id: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  events: string[];
  headers: {
    name: string;
    testUrl: string;
    url: string;
    userId: string;
  };
}

export function WebhooksList() {
  const { data: webhooks, isLoading, error } = useQuery<Webhook[]>({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Usuário não autenticado');
      }

      console.log('Token encontrado:', token.substring(0, 10) + '...');
      
      const response = await fetch('/.netlify/functions/list-webhooks', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Erro na resposta:', errorData);
        throw new Error(errorData.message || 'Falha ao carregar webhooks');
      }
      
      const data = await response.json();
      console.log('Webhooks recebidos:', data);
      return data;
    },
    retry: false,
    refetchInterval: 5000 // Atualiza a cada 5 segundos
  });

  if (isLoading) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Carregando</AlertTitle>
        <AlertDescription>Buscando webhooks...</AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Erro ao carregar webhooks'}
        </AlertDescription>
      </Alert>
    );
  }

  if (!webhooks || webhooks.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Nenhum webhook encontrado</AlertTitle>
        <AlertDescription>Não há webhooks configurados no momento.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhooks Configurados ({webhooks.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Eventos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>Atualizado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {webhooks.map((webhook) => (
              <TableRow key={webhook.id}>
                <TableCell>{webhook.headers.name}</TableCell>
                <TableCell className="font-mono">{webhook.headers.url}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {webhook.events.map((event) => (
                      <Badge key={event} variant="secondary">
                        {event}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={webhook.active ? 'default' : 'destructive'}>
                    {webhook.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {format(new Date(webhook.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </TableCell>
                <TableCell>
                  {format(new Date(webhook.updatedAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
} 