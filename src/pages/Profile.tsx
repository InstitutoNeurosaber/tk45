import React, { useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Card, CardHeader, CardContent, CardTitle } from '../components/ui/card';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Camera, Loader2, Upload, Moon, Sun } from 'lucide-react';
import { toast } from 'react-toastify';
import { getAuth, updateProfile, updatePassword, updateEmail, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useMongoImageUpload } from '../hooks/useMongoImageUpload';
import { useTheme } from '../hooks/useTheme';

export function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState(user?.displayName || '');
  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [newPhotoURL, setNewPhotoURL] = useState(user?.photoURL || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadImage, isUploading } = useMongoImageUpload();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handlePasswordChange = async () => {
    if (!user || !currentPassword || !newPassword) return;
    
    setIsUpdating(true);
    try {
      // Reautenticar o usuário antes de alterar a senha
      const credential = EmailAuthProvider.credential(
        user.email!,
        currentPassword
      );
      await reauthenticateWithCredential(user, credential);
      
      // Atualizar a senha
      await updatePassword(user, newPassword);
      
      toast.success('Senha alterada com sucesso!');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      toast.error('Erro ao alterar senha. Verifique sua senha atual.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleProfileUpdate = async () => {
    if (!user) return;
    
    setIsUpdating(true);
    try {
      // Atualizar nome e foto
      await updateProfile(user, {
        displayName: newDisplayName,
        photoURL: newPhotoURL
      });

      // Se o email foi alterado, atualizar email
      if (newEmail !== user.email) {
        // Reautenticar antes de alterar o email
        const credential = EmailAuthProvider.credential(
          user.email!,
          currentPassword
        );
        await reauthenticateWithCredential(user, credential);
        await updateEmail(user, newEmail);
      }

      toast.success('Perfil atualizado com sucesso!');
      setShowProfileModal(false);
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      toast.error('Erro ao atualizar perfil. Tente novamente.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione apenas imagens');
      return;
    }

    try {
      const imageUrl = await uploadImage(file);
      setNewPhotoURL(imageUrl);
      toast.success('Imagem carregada com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      toast.error('Erro ao fazer upload da imagem. Tente novamente.');
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Carregando...</p>
      </div>
    );
  }

  // Verificar se é uma conta do Gmail
  const isGmailAccount = user.email?.endsWith('@gmail.com');

  return (
    <div className="container mx-auto px-4 py-8 transition-colors duration-200">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </button>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
          aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </button>
      </div>

      <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Meu Perfil</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Informações Pessoais */}
        <Card className="bg-white dark:bg-gray-800 transition-colors duration-200">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Informações Pessoais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt="Foto de perfil" 
                    className="w-20 h-20 rounded-full border-2 border-gray-200 dark:border-gray-700"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <span className="text-2xl text-gray-600 dark:text-gray-300">{user.email?.[0].toUpperCase()}</span>
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{user.displayName || 'Usuário'}</h3>
                  <p className="text-gray-600 dark:text-gray-400 flex items-center">
                    {user.email}
                    {isGmailAccount && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        <Mail className="w-3 h-3 mr-1" />
                        Gmail
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="pt-4">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Email verificado</h4>
                <p className="text-sm">
                  {user.emailVerified ? (
                    <span className="text-green-600 dark:text-green-400">✓ Verificado</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">✗ Não verificado</span>
                  )}
                </p>
              </div>

              <div className="pt-4">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Membro desde</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
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
        <Card className="bg-white dark:bg-gray-800 transition-colors duration-200">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Configurações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <button
                onClick={() => setShowPasswordModal(true)}
                disabled={isUpdating}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 transition-colors duration-200"
              >
                {isUpdating ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    Processando...
                  </span>
                ) : (
                  'Alterar Senha'
                )}
              </button>

              <button
                onClick={() => setShowProfileModal(true)}
                disabled={isUpdating}
                className="w-full px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800 border border-blue-600 dark:border-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 transition-colors duration-200"
              >
                {isUpdating ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    Processando...
                  </span>
                ) : (
                  'Atualizar Perfil'
                )}
              </button>

              <button
                onClick={handleSignOut}
                disabled={isUpdating}
                className="w-full px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-gray-800 border border-red-600 dark:border-red-400 rounded-md hover:bg-red-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-red-400 disabled:opacity-50 transition-colors duration-200"
              >
                Sair
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Alteração de Senha */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl transition-colors duration-200">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Alterar Senha</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Senha Atual
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
                  placeholder="Digite sua senha atual"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nova Senha
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
                  placeholder="Digite a nova senha"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePasswordChange}
                  disabled={isUpdating || !currentPassword || !newPassword}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors duration-200"
                >
                  {isUpdating ? (
                    <span className="flex items-center">
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                      Alterando...
                    </span>
                  ) : (
                    'Confirmar'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Atualização de Perfil */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl transition-colors duration-200">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Atualizar Perfil</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  URL da Foto
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newPhotoURL}
                    onChange={(e) => setNewPhotoURL(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
                    placeholder="https://exemplo.com/foto.jpg"
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    className="hidden"
                    id="profile-photo-upload"
                    aria-label="Upload de foto de perfil"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-3 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 flex items-center transition-colors duration-200"
                    aria-label="Fazer upload de foto de perfil"
                  >
                    {isUploading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-1" />
                        Upload
                      </>
                    )}
                  </button>
                </div>
                {newPhotoURL && (
                  <div className="mt-2">
                    <img
                      src={newPhotoURL}
                      alt="Preview"
                      className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                    />
                  </div>
                )}
              </div>
              {newEmail !== user.email && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Senha Atual (necessária para alterar email)
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200"
                    placeholder="Digite sua senha atual"
                  />
                </div>
              )}
              <div className="flex justify-end space-x-2 pt-4">
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleProfileUpdate}
                  disabled={isUpdating || (!newDisplayName && !newPhotoURL && newEmail === user.email)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors duration-200"
                >
                  {isUpdating ? (
                    <span className="flex items-center">
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                      Atualizando...
                    </span>
                  ) : (
                    'Salvar'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 