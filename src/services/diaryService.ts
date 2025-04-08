import { 
  collection, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc, 
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  or
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { DiaryEntry } from '../types/diary';
import type { User } from '../types/user';

export const diaryService = {
  async createEntry(data: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<DiaryEntry> {
    try {
      const now = Timestamp.now();
      const entriesRef = collection(db, 'diary_entries');
      
      const docRef = await addDoc(entriesRef, {
        ...data,
        createdAt: now,
        updatedAt: now
      });

      return {
        id: docRef.id,
        ...data,
        createdAt: now.toDate(),
        updatedAt: now.toDate()
      };
    } catch (error) {
      console.error('Erro ao criar entrada:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao criar entrada no diário');
    }
  },

  async updateEntry(id: string, changes: Partial<DiaryEntry>): Promise<void> {
    try {
      const entryRef = doc(db, 'diary_entries', id);
      await updateDoc(entryRef, {
        ...changes,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Erro ao atualizar entrada:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao atualizar entrada no diário');
    }
  },

  async deleteEntry(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'diary_entries', id));
    } catch (error) {
      console.error('Erro ao excluir entrada:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao excluir entrada do diário');
    }
  },

  async getEntries(userId: string): Promise<DiaryEntry[]> {
    try {
      const entriesRef = collection(db, 'diary_entries');
      
      // Busca entradas do usuário e entradas compartilhadas com ele
      try {
        const q = query(
          entriesRef,
          or(
            where('userId', '==', userId),
            where('sharedWith', 'array-contains', userId)
          ),
          orderBy('updatedAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        console.log(`Encontradas ${snapshot.size} entradas (próprias + compartilhadas)`);
        
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
          updatedAt: doc.data().updatedAt.toDate()
        })) as DiaryEntry[];
      } catch (indexError) {
        // Se falhar por falta de índice, faz duas buscas separadas
        console.warn('Índice composto não encontrado, fazendo busca alternativa:', indexError);
        
        // Busca entradas do usuário
        const userEntriesQuery = query(
          entriesRef,
          where('userId', '==', userId)
        );
        
        // Busca entradas compartilhadas com o usuário
        const sharedEntriesQuery = query(
          entriesRef,
          where('sharedWith', 'array-contains', userId)
        );
        
        const [userSnapshot, sharedSnapshot] = await Promise.all([
          getDocs(userEntriesQuery),
          getDocs(sharedEntriesQuery)
        ]);
        
        console.log(`Encontradas ${userSnapshot.size} entradas próprias e ${sharedSnapshot.size} compartilhadas`);
        
        // Combina os resultados
        const userEntries = userSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
          updatedAt: doc.data().updatedAt.toDate()
        })) as DiaryEntry[];
        
        const sharedEntries = sharedSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
          updatedAt: doc.data().updatedAt.toDate()
        })) as DiaryEntry[];
        
        // Combina e ordena manualmente
        const allEntries = [...userEntries, ...sharedEntries];
        return allEntries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      }
    } catch (error) {
      console.error('Erro ao buscar entradas:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao buscar entradas do diário');
    }
  },

  async shareEntry(entryId: string, userIds: string[]): Promise<void> {
    try {
      const entryRef = doc(db, 'diary_entries', entryId);
      await updateDoc(entryRef, {
        sharedWith: userIds,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Erro ao compartilhar entrada:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao compartilhar entrada do diário');
    }
  },

  async getAdminUsers(): Promise<User[]> {
    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('role', '==', 'admin'),
        where('active', '==', true)
      );
      
      const snapshot = await getDocs(q);
      console.log(`Encontrados ${snapshot.size} usuários administradores`);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
        lastLogin: doc.data().lastLogin?.toDate() || null
      })) as User[];
    } catch (error) {
      console.error('Erro ao buscar administradores:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao buscar usuários administradores');
    }
  }
};