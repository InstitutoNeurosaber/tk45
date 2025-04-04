import { create } from 'zustand';
import { 
  collection, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc, 
  getDocs,
  query,
  orderBy,
  Timestamp,
  where,
  setDoc
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { userService } from '../services/userService';
import type { User } from '../types/user';

interface UserState {
  users: User[];
  loading: boolean;
  error: string | null;
  fetchUsers: () => Promise<void>;
  createUser: (data: { email: string; name: string; role: User['role']; password?: string }) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  toggleUserStatus: (userId: string, active: boolean) => Promise<void>;
  updateUserPassword: (userId: string, newPassword: string) => Promise<void>;
  updateUser: (userId: string, data: Partial<User>) => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  users: [],
  loading: false,
  error: null,

  fetchUsers: async () => {
    try {
      set({ loading: true, error: null });
      console.log('Buscando usuários...');
      
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      console.log('Total de usuários encontrados:', snapshot.size);
      
      const users = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Dados do usuário:', doc.id, data);
        
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate() || null
        } as User;
      });
      
      console.log('Usuários processados:', users);
      set({ users, loading: false });
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      set({ error: error instanceof Error ? error.message : 'Erro ao buscar usuários', loading: false });
    }
  },

  createUser: async (userData) => {
    try {
      set({ loading: true, error: null });
      console.log('Iniciando criação de usuário:', userData);
      
      // Verificar se o email já existe
      const emailQuery = query(collection(db, 'users'), where('email', '==', userData.email));
      const emailSnapshot = await getDocs(emailQuery);
      
      if (!emailSnapshot.empty) {
        throw new Error('Este email já está em uso');
      }

      // Criar usuário no Authentication
      const password = userData.password || Math.random().toString(36).slice(-8);
      console.log('Criando usuário no Authentication...');
      const userCredential = await createUserWithEmailAndPassword(auth, userData.email, password);
      console.log('Usuário criado no Authentication, uid:', userCredential.user.uid);
      
      const now = Timestamp.now();
      const newUser = {
        id: userCredential.user.uid,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        active: true,
        createdAt: now,
        updatedAt: now,
        lastLogin: now
      };

      // Criar documento do usuário usando o mesmo ID do Authentication
      console.log('Criando documento no Firestore...');
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        ...newUser,
        createdAt: now,
        updatedAt: now,
        lastLogin: now
      });
      console.log('Documento criado no Firestore');
      
      // Atualizar lista de usuários
      console.log('Atualizando lista de usuários...');
      await get().fetchUsers();
      console.log('Lista de usuários atualizada');

      set({ loading: false });
      // Não retornar a senha, já que o tipo espera void
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      set({ error: error instanceof Error ? error.message : 'Erro ao criar usuário' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  deleteUser: async (userId: string) => {
    try {
      set({ loading: true, error: null });
      await userService.deleteUserAccount(userId);
      await get().fetchUsers();
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      set({ error: error instanceof Error ? error.message : 'Erro ao deletar usuário' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  toggleUserStatus: async (userId: string, active: boolean) => {
    try {
      set({ loading: true, error: null });
      await userService.updateUserData(userId, { active });
      await get().fetchUsers();
    } catch (error) {
      console.error('Erro ao atualizar status do usuário:', error);
      set({ error: error instanceof Error ? error.message : 'Erro ao atualizar status do usuário' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  updateUserPassword: async (userId: string, newPassword: string) => {
    try {
      set({ loading: true, error: null });
      await userService.updateUserPassword(userId, newPassword);
    } catch (error) {
      console.error('Erro ao atualizar senha:', error);
      set({ error: error instanceof Error ? error.message : 'Erro ao atualizar senha' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  updateUser: async (userId: string, data: Partial<User>) => {
    try {
      set({ loading: true, error: null });
      await userService.updateUserData(userId, data);
      await get().fetchUsers();
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      set({ error: error instanceof Error ? error.message : 'Erro ao atualizar usuário' });
      throw error;
    } finally {
      set({ loading: false });
    }
  }
}));