import { 
  collection,
  doc, 
  deleteDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  setDoc,
  arrayUnion
} from 'firebase/firestore';
import {
  updateProfile,
  updateEmail,
  updatePassword,
  deleteUser as firebaseDeleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  getAuth,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, auth } from '../lib/firebase';
import type { User, UserData } from '../types/user';

interface UserHistory {
  action: 'created' | 'updated' | 'deleted' | 'status_changed' | 'role_changed';
  timestamp: Date;
  performedBy: string;
  details?: Record<string, any>;
}

interface UserProfile {
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  department?: string;
  position?: string;
}

export const userService = {
  // Criar novo usuário
  async createUser(data: {
    email: string;
    name: string;
    role: User['role'];
    profile?: UserProfile;
  }): Promise<User> {
    try {
      // Verificar se email já existe
      const emailQuery = query(collection(db, 'users'), where('email', '==', data.email.toLowerCase()));
      const emailSnapshot = await getDocs(emailQuery);
      
      if (!emailSnapshot.empty) {
        throw new Error('Este email já está em uso');
      }

      // Criar usuário com uma senha temporária
      const tempPassword = Math.random().toString(36).slice(-12);

      // Criar usuário usando uma instância separada do Auth
      const secondaryAuth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, data.email, tempPassword);
      
      // Atualizar displayName
      await updateProfile(userCredential.user, {
        displayName: data.name
      });

      const now = Timestamp.now();
      const userData: UserData = {
        id: userCredential.user.uid,
        email: data.email.toLowerCase(),
        name: data.name,
        role: data.role,
        active: true,
        createdAt: now.toDate(),
        updatedAt: now.toDate(),
        profile: data.profile
      };

      // Criar documento do usuário
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        ...userData,
        createdAt: now,
        updatedAt: now,
        history: [{
          action: 'created',
          timestamp: now,
          performedBy: auth.currentUser?.uid || 'system'
        }]
      });

      // Deslogar o usuário recém-criado da instância secundária
      await secondaryAuth.signOut();

      return userData;
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao criar usuário');
    }
  },

  async deleteUser(userId: string): Promise<void> {
    try {
      // Verificar se o usuário existe no Firestore
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        throw new Error('Usuário não encontrado');
      }

      // Marcar o usuário como inativo ao invés de deletar
      await updateDoc(doc(db, 'users', userId), {
        active: false,
        updatedAt: Timestamp.now(),
        deletedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao deletar usuário');
    }
  },

  async deleteUserAccount(userId: string): Promise<void> {
    try {
      console.log('Iniciando processo de deleção para userId:', userId);
      
      // Verificar se o ID é válido
      if (!userId) {
        throw new Error('ID do usuário é obrigatório');
      }

      // Buscar dados do usuário atual
      const currentUser = auth.currentUser;
      console.log('Usuário atual:', currentUser?.uid);

      if (!currentUser) {
        throw new Error('Usuário não autenticado');
      }

      // Buscar dados do usuário a ser deletado
      console.log('Buscando documento do usuário no Firestore...');
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        console.error('Documento não encontrado para userId:', userId);
        throw new Error('Usuário não encontrado');
      }

      const userData = userDoc.data();
      console.log('Dados do usuário encontrados:', { ...userData, id: userId });

      // Verificar se é o próprio usuário ou um admin
      console.log('Verificando permissões...');
      const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
      
      if (!currentUserDoc.exists()) {
        console.error('Documento do usuário atual não encontrado');
        throw new Error('Dados do usuário atual não encontrados');
      }

      const currentUserData = currentUserDoc.data();
      const isAdmin = currentUserData.role === 'admin';
      const isSelfDelete = currentUser.uid === userId;

      console.log('Verificações:', {
        isAdmin,
        isSelfDelete,
        currentUserRole: currentUserData.role
      });

      if (!isAdmin && !isSelfDelete) {
        throw new Error('Você só pode deletar sua própria conta ou ser um administrador para deletar outras contas');
      }

      // Não permitir deletar o admin
      if (userData.email === 'thiagomateus.ti@neurosaber.com.br') {
        throw new Error('Não é possível deletar o usuário administrador');
      }

      // Deletar documento do usuário no Firestore
      console.log('Deletando documento do usuário no Firestore...');
      await deleteDoc(doc(db, 'users', userId));

      // Tentar deletar o usuário no Authentication
      console.log('Tentando deletar usuário no Authentication...');
      try {
        const functions = getFunctions();
        const deleteUserFunction = httpsCallable(functions, 'deleteUser');
        await deleteUserFunction({ userId });
        console.log('Usuário deletado no Authentication com sucesso');
      } catch (authError) {
        console.error('Erro ao deletar usuário no Authentication:', authError);
        // Não propagar erro do Authentication, já que o documento foi deletado
      }

      console.log('Usuário deletado com sucesso');
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      throw error instanceof Error ? error : new Error('Erro ao deletar usuário');
    }
  },

  async updateUserData(userId: string, data: Partial<UserData>): Promise<void> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        throw new Error('Usuário não encontrado');
      }

      await updateDoc(doc(db, 'users', userId), {
        ...data,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Erro ao atualizar dados do usuário:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao atualizar dados do usuário');
    }
  },

  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    try {
      // Verificar se o usuário existe
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        throw new Error('Usuário não encontrado');
      }

      // Atualizar senha no Authentication
      const functions = getFunctions();
      const updatePasswordFunction = httpsCallable(functions, 'updateUserPassword');
      await updatePasswordFunction({ userId, newPassword });

      // Atualizar timestamp no Firestore
      await updateDoc(doc(db, 'users', userId), {
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Erro ao atualizar senha:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao atualizar senha');
    }
  },

  async syncAuthUsers(): Promise<void> {
    try {
      console.log('Iniciando sincronização de usuários...');
      
      // Buscar usuários do Authentication via Cloud Function
      const functions = getFunctions();
      const listAuthUsers = httpsCallable(functions, 'listAuthUsers');
      const result = await listAuthUsers();
      const authUsers = result.data as any[];
      
      console.log('Usuários do Authentication:', authUsers);

      // Para cada usuário do Authentication
      for (const authUser of authUsers) {
        // Verificar se já existe no Firestore
        const userDoc = await getDoc(doc(db, 'users', authUser.uid));
        
        if (!userDoc.exists()) {
          console.log('Criando documento para usuário:', authUser.email);
          
          // Criar documento no Firestore
          const now = Timestamp.now();
          const userData = {
            id: authUser.uid,
            email: authUser.email,
            name: authUser.displayName || authUser.email.split('@')[0],
            role: 'user', // Por padrão, novos usuários são 'user'
            active: true,
            createdAt: now,
            updatedAt: now,
            lastLogin: null
          };
          
          await setDoc(doc(db, 'users', authUser.uid), userData);
          console.log('Documento criado com sucesso para:', authUser.email);
        }
      }
      
      console.log('Sincronização concluída');
    } catch (error) {
      console.error('Erro na sincronização:', error);
      throw new Error('Erro ao sincronizar usuários');
    }
  }
};