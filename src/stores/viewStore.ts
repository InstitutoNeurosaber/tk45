import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';
type ViewMode = 'list' | 'kanban';

interface ViewState {
  theme: Theme;
  viewMode: ViewMode;
  tourCompleted: boolean;
  toggleTheme: () => void;
  setViewMode: (mode: ViewMode) => void;
  completeTour: () => void;
  resetTour: () => void;
}

// Função para aplicar o tema no documento
const applyTheme = (theme: Theme) => {
  const root = window.document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

// Detecta a preferência inicial do sistema
const getInitialTheme = (): Theme => {
  // Verifica se há um tema salvo
  const savedTheme = localStorage.getItem('user-view-preferences');
  if (savedTheme) {
    const parsed = JSON.parse(savedTheme);
    if (parsed.state?.theme) {
      return parsed.state.theme;
    }
  }
  
  // Se não houver tema salvo, usa a preferência do sistema
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Aplica o tema inicial
const initialTheme = getInitialTheme();
applyTheme(initialTheme);

export const useViewStore = create<ViewState>()(
  persist(
    (set) => ({
      theme: initialTheme,
      viewMode: 'list',
      tourCompleted: false,
      toggleTheme: () =>
        set((state) => {
          const newTheme = state.theme === 'light' ? 'dark' : 'light';
          applyTheme(newTheme);
          return { theme: newTheme };
        }),
      setViewMode: (mode) => set({ viewMode: mode }),
      completeTour: () => set({ tourCompleted: true }),
      resetTour: () => set({ tourCompleted: false }),
    }),
    {
      name: 'user-view-preferences',
    }
  )
); 