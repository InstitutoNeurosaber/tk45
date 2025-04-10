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

interface TicketCreatedEmailProps {
  userName: string;
  ticketId: string;
  ticketTitle: string;
  ticketDescription: string;
  createdAt: string;
  ticketUrl: string;
}

const baseUrl = import.meta.env.VITE_BASE_URL || 'http://localhost:3000';

export const TicketCreatedEmail = ({
  userName,
  ticketId,
  ticketTitle,
  ticketDescription,
  createdAt,
  ticketUrl,
}: TicketCreatedEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Novo ticket criado: {ticketTitle}</Preview>
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
                  Novo Ticket Criado
                </Heading>

                <Text className="text-gray-700 text-base mb-6">
                  Olá <span className="font-semibold">{userName}</span>,
                </Text>

                <Text className="text-gray-700 text-base">
                  Um novo ticket foi criado no sistema. Confira os detalhes abaixo:
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
                        {createdAt}
                      </Text>
                    </Column>
                  </Row>
                  <Section className="px-6 py-4">
                    <Text className="text-lg font-semibold text-gray-800 mb-2">
                      {ticketTitle}
                    </Text>
                    <Text className="text-gray-600 whitespace-pre-wrap">
                      {ticketDescription}
                    </Text>
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