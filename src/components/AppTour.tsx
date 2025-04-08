import React, { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, EVENTS, ACTIONS, Step } from 'react-joyride';
import { useViewStore } from '../stores/viewStore';

interface AppTourProps {
  /** Indica se o tour deve iniciar automaticamente */
  autoStart?: boolean;
}

export function AppTour({ autoStart = true }: AppTourProps) {
  // Estado para controlar a execução do tour
  const [run, setRun] = useState(false);
  // Estado para controlar o passo atual (modo controlado)
  const [stepIndex, setStepIndex] = useState(0);
  
  // Buscar preferências do usuário
  const { theme, tourCompleted, completeTour, resetTour } = useViewStore();
  
  // Iniciar o tour automaticamente se for a primeira visita
  useEffect(() => {
    if (autoStart && !tourCompleted) {
      // Pequeno delay para garantir que os elementos estejam renderizados
      const timer = setTimeout(() => {
        setRun(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [autoStart, tourCompleted]);
  
  // Função para reiniciar o tutorial manualmente
  const reiniciarTutorial = () => {
    setStepIndex(0);
    setRun(true);
  };
  
  // Definir os passos do tutorial
  const passos: Step[] = [
    {
      target: '.app-header',
      content: 'Bem-vindo ao Sistema de Chamados! Vamos te mostrar como usar a aplicação.',
      placement: 'bottom',
      disableBeacon: true,
      title: 'Bem-vindo!',
    },
    {
      target: '.create-ticket-button',
      content: 'Clique aqui para criar um novo chamado quando precisar de suporte técnico.',
      placement: 'left',
      title: 'Criar Chamado',
    },
    {
      target: '.toggle-theme-button',
      content: 'Você pode alternar entre os modos claro e escuro conforme sua preferência visual.',
      placement: 'bottom',
      title: 'Alterar Tema',
    },
    {
      target: '.view-mode-toggle',
      content: 'Alterne entre a visualização em lista ou quadro kanban para organizar seus chamados.',
      placement: 'left',
      title: 'Visualização',
    },
    {
      target: '.ticket-list',
      content: 'Aqui você verá todos os seus chamados. Clique em um para visualizar os detalhes completos.',
      placement: 'top',
      title: 'Lista de Chamados',
    },
    {
      target: '.create-ticket-button',
      content: 'Vamos aprender a criar um chamado! Clique neste botão para abrir o formulário de criação.',
      placement: 'left',
      title: 'Criando um Chamado',
    },
    {
      target: 'body',
      content: 'No formulário de criação, preencha o título do chamado, descreva detalhadamente o problema, selecione a categoria adequada e defina a prioridade. Quanto mais informações você fornecer, mais rapidamente sua solicitação será atendida.',
      placement: 'center',
      title: 'Preenchendo o Formulário',
    },
    {
      target: 'body',
      content: 'Após preencher todos os campos necessários, clique no botão "Enviar" para criar o chamado. Um novo item será adicionado à sua lista de chamados.',
      placement: 'center',
      title: 'Enviando o Chamado',
    },
    {
      target: '.ticket-list',
      content: 'Após a criação, seu novo chamado aparecerá aqui. Você pode clicar nele para acompanhar seu progresso e interagir com a equipe de suporte.',
      placement: 'top',
      title: 'Acompanhando o Chamado',
    },
    {
      target: 'body',
      content: 'Na tela de detalhes do chamado, você pode adicionar comentários, anexar arquivos importantes e acompanhar todo o histórico de atendimento da sua solicitação.',
      placement: 'center',
      title: 'Detalhes do Chamado',
    },
    {
      target: 'body',
      content: 'Quando seu problema for resolvido, você pode marcar o chamado como "Concluído". Se não precisar mais dele, pode arquivá-lo para manter sua lista organizada e focada nas solicitações ativas.',
      placement: 'center',
      title: 'Concluindo o Chamado',
    }
  ];
  
  // Manipular callbacks do Joyride
  const processarEventoTutorial = (data: CallBackProps) => {
    const { action, index, status, type } = data;
    
    // Atualizar o índice do passo
    if (type === EVENTS.STEP_AFTER) {
      setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
    }
    
    // Finalizar o tour quando concluído ou pulado
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      completeTour();
    }
  };
  
  // Estilização baseada no tema atual
  const obterEstilos = () => {
    return {
      options: {
        arrowColor: theme === 'dark' ? '#374151' : '#ffffff',
        backgroundColor: theme === 'dark' ? '#374151' : '#ffffff',
        overlayColor: 'rgba(0, 0, 0, 0.5)',
        primaryColor: '#3b82f6',
        textColor: theme === 'dark' ? '#f3f4f6' : '#1f2937',
        zIndex: 1000,
      }
    };
  };
  
  return (
    <>
      <Joyride
        callback={processarEventoTutorial}
        continuous
        hideCloseButton={false}
        run={run}
        scrollToFirstStep
        showProgress
        showSkipButton
        stepIndex={stepIndex}
        steps={passos}
        styles={obterEstilos()}
        disableScrolling={false}
        locale={{
          back: 'Voltar',
          close: 'Fechar',
          last: 'Finalizar',
          next: 'Avançar',
          open: 'Abrir o tutorial',
          skip: 'Pular tutorial'
        }}
        floaterProps={{
          disableAnimation: false,
          styles: {
            floater: {
              filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.15))'
            }
          }
        }}
      />
      
      {/* Botão para reiniciar o tutorial manualmente */}
      {tourCompleted && (
        <button
          onClick={() => {
            resetTour();
            reiniciarTutorial();
          }}
          className="fixed bottom-4 right-4 z-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-lg"
          title="Mostrar Tutorial"
          aria-label="Abrir tutorial"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 4.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      )}
    </>
  );
} 