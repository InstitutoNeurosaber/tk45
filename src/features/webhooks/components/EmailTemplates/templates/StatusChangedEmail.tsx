import {
  Body,
  Button,
  Container,
  Column,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
  Tailwind,
} from '@react-email/components';
import * as React from 'react';

interface StatusChangedEmailProps {
  userName: string;
  ticketId: string;
  ticketTitle: string;
  oldStatus: string;
  newStatus: string;
  updatedAt: string;
  ticketUrl: string;
}

const baseUrl = import.meta.env.VITE_BASE_URL || 'http://localhost:3000';

const getStatusColor = (status: string) => {
  const colors = {
    'Aberto': 'bg-blue-100 text-blue-800',
    'Em Andamento': 'bg-yellow-100 text-yellow-800',
    'Concluído': 'bg-green-100 text-green-800',
    'Cancelado': 'bg-red-100 text-red-800',
  };
  return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

export const StatusChangedEmail = ({
  userName,
  ticketId,
  ticketTitle,
  oldStatus,
  newStatus,
  updatedAt,
  ticketUrl,
}: StatusChangedEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Status do ticket atualizado: {ticketTitle}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-8 px-4">
            <Section className="bg-white rounded-xl shadow-lg overflow-hidden">
              {/* Header */}
              <Row className="bg-blue-600 px-8 py-6">
                <Column>
                  <Img
                    src={`${baseUrl}/logo-white.png`}
                    width="150"
                    height="40"
                    alt="Logo"
                    className="my-0 mx-auto"
                  />
                </Column>
              </Row>

              {/* Content */}
              <Section className="px-8 py-6">
                <Heading className="text-2xl font-bold text-gray-800 mb-4 text-center">
                  Status do Ticket Atualizado
                </Heading>

                <Text className="text-gray-700 text-base mb-6">
                  Olá <span className="font-semibold">{userName}</span>,
                </Text>

                <Text className="text-gray-700 text-base">
                  O status do ticket foi atualizado. Confira os detalhes abaixo:
                </Text>

                {/* Ticket Details Card */}
                <Section className="bg-gray-50 rounded-lg border border-gray-200 mt-6 mb-6 overflow-hidden">
                  <Row className="bg-gray-100 px-6 py-4">
                    <Column>
                      <Text className="text-sm font-medium text-gray-500 m-0">
                        Ticket #{ticketId}
                      </Text>
                    </Column>
                    <Column align="right">
                      <Text className="text-sm text-gray-500 m-0">
                        {updatedAt}
                      </Text>
                    </Column>
                  </Row>
                  <Section className="px-6 py-4">
                    <Text className="text-lg font-semibold text-gray-800 mb-4">
                      {ticketTitle}
                    </Text>

                    {/* Status Change */}
                    <Section className="flex items-center justify-center space-x-4">
                      <Section className="text-center">
                        <Text className="text-sm text-gray-500 mb-2">Status Anterior</Text>
                        <Text className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(oldStatus)}`}>
                          {oldStatus}
                        </Text>
                      </Section>

                      <Text className="text-gray-400 text-xl">→</Text>

                      <Section className="text-center">
                        <Text className="text-sm text-gray-500 mb-2">Novo Status</Text>
                        <Text className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(newStatus)}`}>
                          {newStatus}
                        </Text>
                      </Section>
                    </Section>
                  </Section>
                </Section>

                {/* CTA Button */}
                <Section className="text-center">
                  <Button
                    className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    href={ticketUrl}
                  >
                    Ver Ticket
                  </Button>
                </Section>
              </Section>

              {/* Footer */}
              <Section className="bg-gray-50 px-8 py-6 text-center">
                <Text className="text-gray-600 text-sm">
                  Este é um email automático. Por favor, não responda.
                </Text>
                <Hr className="border-gray-200 my-4" />
                <Text className="text-gray-500 text-xs">
                  © 2024 Neuropainel. Todos os direitos reservados.
                </Text>
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}; 