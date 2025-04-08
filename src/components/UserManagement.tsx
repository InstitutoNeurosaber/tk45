import React, { useState } from 'react';
import { UserPlus, Trash2, Lock, Unlock, Search, Shield, Edit, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import type { User } from '../types/user';
import { roleLabels } from '../types/user';

interface UserManagementProps {
  users: User[];
  onCreateUser: (data: { email: string; name: string; role: User['role']; password?: string }) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onToggleUserStatus: (userId: string, active: boolean) => Promise<void>;
  onUpdateUser: (userId: string, data: Partial<User>) => Promise<void>;
}

export function UserManagement({ users, onCreateUser, onDeleteUser, onToggleUserStatus, onUpdateUser }: UserManagementProps) {
  const { userData, sendPasswordReset } = useAuthStore();
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetStatus, setResetStatus] = useState<{ userId: string; status: 'idle' | 'loading' | 'success' | 'error'; message?: string }>({ userId: '', status: 'idle' });
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'user' as User['role'],
    password: '',
    createPassword: false
  });
  const [editFormData, setEditFormData] = useState<Partial<User>>({
    name: '',
    email: '',
    role: 'user'
  });

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userData = {
        email: formData.email,
        name: formData.name,
        role: formData.role,
        ...(formData.createPassword && formData.password ? { password: formData.password } : {})
      };
      await onCreateUser(userData);
      setFormData({ email: '', name: '', role: 'user', password: '', createPassword: false });
      setIsCreating(false);
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) return;
    
    try {
      await onUpdateUser(isEditing, editFormData);
      setIsEditing(null);
      setEditFormData({ name: '', email: '', role: 'user' });
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
    }
  };

  const startEditing = (user: User) => {
    setIsEditing(user.id);
    setEditFormData({
      name: user.name,
      email: user.email,
      role: user.role
    });
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password });
  };

  const handlePasswordReset = async (userId: string, email: string) => {
    try {
      setResetStatus({ userId, status: 'loading' });
      await sendPasswordReset(email);
      setResetStatus({ userId, status: 'success', message: 'Email de redefinição enviado' });
      
      // Limpar o status após 3 segundos
      setTimeout(() => {
        setResetStatus({ userId: '', status: 'idle' });
      }, 3000);
    } catch (error) {
      console.error('Erro ao enviar email de redefinição:', error);
      setResetStatus({ 
        userId, 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Erro ao enviar email de redefinição'
      });
      
      // Limpar o status de erro após 5 segundos
      setTimeout(() => {
        setResetStatus({ userId: '', status: 'idle' });
      }, 5000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Gerenciamento de Usuários</h2>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          <UserPlus className="h-5 w-5 mr-2" />
          Novo Usuário
        </button>
      </div>

      {isCreating && (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 animate-in fade-in slide-in">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Criar Novo Usuário</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                required
                aria-label="Nome do usuário"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                required
                aria-label="Email do usuário"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Função</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as User['role'] })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                aria-label="Função do usuário"
              >
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center mb-4">
              <input
                id="createPassword"
                type="checkbox"
                checked={formData.createPassword}
                onChange={(e) => setFormData({ ...formData, createPassword: e.target.checked })}
                className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="createPassword" className="ml-2 text-sm font-medium text-gray-700">
                Definir senha para o usuário
              </label>
            </div>

            {formData.createPassword && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Senha</label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-xs text-primary hover:text-primary/80"
                  >
                    Gerar senha aleatória
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 pr-10"
                    required={formData.createPassword}
                    minLength={6}
                    aria-label="Senha do usuário"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  A senha deve ter pelo menos 6 caracteres.
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setFormData({ email: '', name: '', role: 'user', password: '', createPassword: false });
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Criar Usuário
              </button>
            </div>
          </form>
        </div>
      )}

      {isEditing && (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 animate-in fade-in slide-in">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Editar Usuário</h3>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome</label>
              <input
                type="text"
                value={editFormData.name || ''}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                required
                aria-label="Nome do usuário"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={editFormData.email || ''}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                required
                aria-label="Email do usuário"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Função</label>
              <select
                value={editFormData.role || 'user'}
                onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as User['role'] })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                aria-label="Função do usuário"
              >
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(null);
                  setEditFormData({ name: '', email: '', role: 'user' });
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar usuários..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Função
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Último Acesso
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={`user-row-${user.id}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary text-sm font-medium">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Shield className="h-4 w-4 text-primary mr-1" />
                      <span className="text-sm text-gray-900">{roleLabels[user.role]}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.active ? 'Ativo' : 'Bloqueado'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleString('pt-BR') : 'Nunca'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {userData?.id !== user.id && (
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => startEditing(user)}
                          className="text-blue-400 hover:text-blue-500"
                          title="Editar usuário"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handlePasswordReset(user.id, user.email)}
                          disabled={resetStatus.userId === user.id && resetStatus.status === 'loading'}
                          className={`text-purple-400 hover:text-purple-500 ${resetStatus.userId === user.id && resetStatus.status === 'loading' ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Enviar email de redefinição de senha"
                        >
                          <RefreshCw className={`h-5 w-5 ${resetStatus.userId === user.id && resetStatus.status === 'loading' ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={() => onToggleUserStatus(user.id, !user.active)}
                          className={`text-gray-400 hover:text-gray-500`}
                          title={user.active ? 'Bloquear usuário' : 'Desbloquear usuário'}
                        >
                          {user.active ? (
                            <Lock className="h-5 w-5" />
                          ) : (
                            <Unlock className="h-5 w-5" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
                              onDeleteUser(user.id);
                            }
                          }}
                          className="text-red-400 hover:text-red-500"
                          title="Excluir usuário"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                    {resetStatus.userId === user.id && resetStatus.status !== 'idle' && (
                      <div className={`mt-2 text-xs ${
                        resetStatus.status === 'success' ? 'text-green-600' : 
                        resetStatus.status === 'error' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {resetStatus.message}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}