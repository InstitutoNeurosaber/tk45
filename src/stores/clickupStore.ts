import { create } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { 
  collection, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc, 
  getDocs,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ClickUpAPI } from '../lib/clickup';
import type { ClickUpConfig } from '../types/clickup';

// Interface para o estado persistido localmente
interface PersistedState {
  config: ClickUpConfig | null;
  selectedWorkspaceId: string | null;
  selectedSpaceId: string | null;
  selectedListId: string | null;
}

interface ClickUpState extends PersistedState {
  loading: boolean;
  error: string | null;
  fetchConfig: (userId: string) => Promise<void>;
  saveConfig: (config: Omit<ClickUpConfig, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateConfig: (id: string, data: Partial<ClickUpConfig>) => Promise<void>;
  deleteConfig: (id: string) => Promise<void>;
  setSelectedWorkspaceId: (id: string | null) => void;
  setSelectedSpaceId: (id: string | null) => void;
  setSelectedListId: (id: string | null) => void;
  reset: () => void;
}

const initialState: PersistedState = {
  config: null,
  selectedWorkspaceId: null,
  selectedSpaceId: null,
  selectedListId: null
};

// Definindo as opções de persistência para a store
type ClickUpPersist = PersistOptions<ClickUpState, PersistedState>;

const clickUpPersistOptions: ClickUpPersist = {
  name: 'clickup-storage',
  storage: {
    getItem: (name) => {
      try {
        const value = localStorage.getItem(name);
        console.log('[ClickUpStore] Carregando do localStorage:', name, value);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        console.error('[ClickUpStore] Erro ao ler do localStorage:', error);
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        const serialized = JSON.stringify(value);
        console.log('[ClickUpStore] Salvando no localStorage:', name, serialized);
        localStorage.setItem(name, serialized);
      } catch (error) {
        console.error('[ClickUpStore] Erro ao salvar no localStorage:', error);
      }
    },
    removeItem: (name) => {
      try {
        console.log('[ClickUpStore] Removendo do localStorage:', name);
        localStorage.removeItem(name);
      } catch (error) {
        console.error('[ClickUpStore] Erro ao remover do localStorage:', error);
      }
    }
  },
  partialize: (state) => {
    // Salvando apenas os campos que queremos persistir
    const stateToSave: PersistedState = {
      config: state.config,
      selectedWorkspaceId: state.selectedWorkspaceId,
      selectedSpaceId: state.selectedSpaceId,
      selectedListId: state.selectedListId
    };
    console.log('[ClickUpStore] Dados a serem salvos:', stateToSave);
    return stateToSave;
  },
  onRehydrateStorage: () => {
    console.log('[ClickUpStore] Iniciando rehydrate do storage');
    return (rehydratedState, error) => {
      if (error) {
        console.error('[ClickUpStore] Erro ao recuperar estado do armazenamento local:', error);
      } else {
        console.log('[ClickUpStore] Estado recuperado do armazenamento local:', rehydratedState);
        
        // Aplicar explicitamente os valores recuperados ao state atual
        if (rehydratedState?.config) {
          console.log('[ClickUpStore] Configuração recuperada:', rehydratedState.config);
          
          // Verificar se todos os campos necessários estão presentes na configuração recuperada
          if (!rehydratedState.config.workspaceId || !rehydratedState.config.spaceId || !rehydratedState.config.listId) {
            console.warn('[ClickUpStore] ATENÇÃO: Configuração recuperada incompleta!', {
              workspaceId: rehydratedState.config.workspaceId || 'AUSENTE',
              spaceId: rehydratedState.config.spaceId || 'AUSENTE',
              listId: rehydratedState.config.listId || 'AUSENTE'
            });
          }
          
          // Aplicar manualmente o estado para garantir que ele seja atualizado corretamente
          useClickUpStore.setState({
            config: rehydratedState.config,
            selectedWorkspaceId: rehydratedState.selectedWorkspaceId,
            selectedSpaceId: rehydratedState.selectedSpaceId,
            selectedListId: rehydratedState.selectedListId
          });
        } else {
          console.warn('[ClickUpStore] Nenhuma configuração encontrada no armazenamento local');
        }
      }
    };
  }
};

export const useClickUpStore = create<ClickUpState>()(
  persist(
    (set, get) => ({
      ...initialState,
      loading: false,
      error: null,

      setSelectedWorkspaceId: (id) => {
        set({ 
          selectedWorkspaceId: id,
          // Limpa as seleções dependentes
          selectedSpaceId: null,
          selectedListId: null
        });
      },

      setSelectedSpaceId: (id) => {
        set({ 
          selectedSpaceId: id,
          // Limpa a lista selecionada
          selectedListId: null
        });
      },

      setSelectedListId: (id) => set({ selectedListId: id }),

      reset: () => set({...initialState, loading: false, error: null}),

      fetchConfig: async (userId: string) => {
        try {
          console.log('[ClickUpStore] Buscando configuração para usuário:', userId);
          set({ loading: true, error: null });
          const configsRef = collection(db, 'clickup_configs');
          const q = query(configsRef, where('userId', '==', userId));
          const snapshot = await getDocs(q);
          
          if (!snapshot.empty) {
            const configDoc = snapshot.docs[0];
            const configData = configDoc.data();
            console.log('[ClickUpStore] Configuração encontrada:', configDoc.id, configData);
            
            const config = {
              id: configDoc.id,
              ...configData,
              createdAt: configData.createdAt.toDate(),
              updatedAt: configData.updatedAt.toDate()
            } as ClickUpConfig;
            
            console.log('[ClickUpStore] Configuração processada:', config);
            
            // Verificar se todos os campos necessários estão presentes
            if (!config.workspaceId || !config.spaceId || !config.listId) {
              console.warn('[ClickUpStore] ATENÇÃO: Configuração incompleta detectada!', {
                workspaceId: config.workspaceId || 'AUSENTE',
                spaceId: config.spaceId || 'AUSENTE',
                listId: config.listId || 'AUSENTE'
              });
            }
            
            set({ 
              config,
              selectedWorkspaceId: config.workspaceId,
              selectedSpaceId: config.spaceId,
              selectedListId: config.listId
            });
            
            // Salvando explicitamente no localStorage para redundância
            localStorage.setItem('clickup-config', JSON.stringify(config));
            
            // Verificar se o state foi atualizado corretamente
            setTimeout(() => {
              const currentState = get();
              console.log('[ClickUpStore] Estado após fetch:', {
                config: currentState.config,
                selectedWorkspaceId: currentState.selectedWorkspaceId,
                selectedSpaceId: currentState.selectedSpaceId,
                selectedListId: currentState.selectedListId
              });
            }, 100);
          } else {
            console.log('[ClickUpStore] Nenhuma configuração encontrada para o usuário:', userId);
          }
        } catch (error) {
          console.error('[ClickUpStore] Erro ao buscar configuração:', error);
          set({ error: error instanceof Error ? error.message : 'Erro ao buscar configuração do ClickUp' });
        } finally {
          set({ loading: false });
        }
      },

      saveConfig: async (configData) => {
        try {
          console.log('[ClickUpStore] Salvando configuração:', configData);
          set({ loading: true, error: null });
          
          const configsRef = collection(db, 'clickup_configs');
          const q = query(configsRef, where('userId', '==', configData.userId));
          const snapshot = await getDocs(q);
          
          const now = Timestamp.now();
          
          if (!snapshot.empty) {
            const existingConfig = snapshot.docs[0];
            console.log('[ClickUpStore] Atualizando configuração existente:', existingConfig.id);
            
            // Verificar se todos os campos necessários estão presentes
            if (!configData.workspaceId || !configData.spaceId || !configData.listId) {
              console.warn('[ClickUpStore] ATENÇÃO: Tentando salvar configuração incompleta!', {
                workspaceId: configData.workspaceId || 'AUSENTE',
                spaceId: configData.spaceId || 'AUSENTE',
                listId: configData.listId || 'AUSENTE'
              });
            }
            
            await updateDoc(doc(configsRef, existingConfig.id), {
              ...configData,
              updatedAt: now
            });

            const updatedConfig: ClickUpConfig = {
              id: existingConfig.id,
              ...configData,
              createdAt: existingConfig.data().createdAt.toDate(),
              updatedAt: now.toDate()
            };

            console.log('[ClickUpStore] Configuração atualizada:', updatedConfig);
            
            set({ 
              config: updatedConfig,
              selectedWorkspaceId: configData.workspaceId,
              selectedSpaceId: configData.spaceId,
              selectedListId: configData.listId
            });
            
            // Verificar se o state foi atualizado corretamente
            setTimeout(() => {
              const currentState = get();
              console.log('[ClickUpStore] Estado após atualização:', {
                config: currentState.config,
                selectedWorkspaceId: currentState.selectedWorkspaceId,
                selectedSpaceId: currentState.selectedSpaceId,
                selectedListId: currentState.selectedListId
              });
            }, 100);
          } else {
            console.log('[ClickUpStore] Criando nova configuração para usuário:', configData.userId);
            
            const docRef = await addDoc(configsRef, {
              ...configData,
              createdAt: now,
              updatedAt: now
            });

            const newConfig: ClickUpConfig = {
              id: docRef.id,
              ...configData,
              createdAt: now.toDate(),
              updatedAt: now.toDate()
            };

            console.log('[ClickUpStore] Nova configuração criada:', newConfig);
            
            set({ 
              config: newConfig,
              selectedWorkspaceId: configData.workspaceId,
              selectedSpaceId: configData.spaceId,
              selectedListId: configData.listId
            });
            
            // Verificar se o state foi atualizado corretamente
            setTimeout(() => {
              const currentState = get();
              console.log('[ClickUpStore] Estado após criação:', {
                config: currentState.config,
                selectedWorkspaceId: currentState.selectedWorkspaceId,
                selectedSpaceId: currentState.selectedSpaceId,
                selectedListId: currentState.selectedListId
              });
            }, 100);
          }
        } catch (error) {
          console.error('[ClickUpStore] Erro ao salvar configuração:', error);
          set({ error: error instanceof Error ? error.message : 'Erro ao salvar configuração do ClickUp' });
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      updateConfig: async (id: string, data: Partial<ClickUpConfig>) => {
        try {
          set({ loading: true, error: null });
          const configRef = doc(db, 'clickup_configs', id);
          
          await updateDoc(configRef, {
            ...data,
            updatedAt: Timestamp.now()
          });

          const { config } = get();
          if (config) {
            const updatedConfig = {
              ...config,
              ...data,
              updatedAt: new Date()
            };
            set({ 
              config: updatedConfig,
              selectedWorkspaceId: data.workspaceId || config.workspaceId,
              selectedSpaceId: data.spaceId || config.spaceId,
              selectedListId: data.listId || config.listId
            });
          }
        } catch (error) {
          console.error('Erro ao atualizar configuração:', error);
          set({ error: error instanceof Error ? error.message : 'Erro ao atualizar configuração do ClickUp' });
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      deleteConfig: async (id: string) => {
        try {
          set({ loading: true, error: null });
          await deleteDoc(doc(db, 'clickup_configs', id));
          set(initialState);
        } catch (error) {
          console.error('Erro ao deletar configuração:', error);
          set({ error: error instanceof Error ? error.message : 'Erro ao deletar configuração do ClickUp' });
          throw error;
        } finally {
          set({ loading: false });
        }
      }
    }),
    clickUpPersistOptions
  )
);