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

export const useViewStore = create<ViewState>()(
  persist(
    (set) => ({
      theme: 'light',
      viewMode: 'list',
      tourCompleted: false,
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
      setViewMode: (mode) => set({ viewMode: mode }),
      completeTour: () => set({ tourCompleted: true }),
      resetTour: () => set({ tourCompleted: false }),
    }),
    {
      name: 'user-view-preferences',
    }
  )
); 