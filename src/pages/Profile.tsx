import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { Card, CardHeader, CardContent, CardTitle } from '../components/ui/card';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Botão Voltar */}
      <button
        onClick={() => navigate('/')}
        className="mb-6 flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </button>

      <h1 className="text-3xl font-bold mb-8">Meu Perfil</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Informações Pessoais */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Pessoais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt="Foto de perfil" 
                    className="w-20 h-20 rounded-full"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-2xl">{user.email?.[0].toUpperCase()}</span>
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-semibold">{user.displayName || 'Usuário'}</h3>
                  <p className="text-gray-600">{user.email}</p>
                </div>
              </div>

              <div className="pt-4">
                <h4 className="text-sm font-medium text-gray-500 mb-2">Email verificado</h4>
                <p className="text-sm">
                  {user.emailVerified ? (
                    <span className="text-green-600">✓ Verificado</span>
                  ) : (
                    <span className="text-red-600">✗ Não verificado</span>
                  )}
                </p>
              </div>

              <div className="pt-4">
                <h4 className="text-sm font-medium text-gray-500 mb-2">Membro desde</h4>
                <p className="text-sm">
                  {user.metadata?.creationTime ? 
                    new Date(user.metadata.creationTime).toLocaleDateString('pt-BR') : 
                    'Data não disponível'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configurações */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <button
                onClick={() => {/* TODO: Implementar alteração de senha */}}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Alterar Senha
              </button>

              <button
                onClick={() => {/* TODO: Implementar atualização de perfil */}}
                className="w-full px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-600 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Atualizar Perfil
              </button>

              <button
                onClick={handleSignOut}
                className="w-full px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-600 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Sair
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 