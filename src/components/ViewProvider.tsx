import React, { useEffect } from 'react';
import { useViewStore } from '../stores/viewStore';

interface ViewProviderProps {
  children: React.ReactNode;
}

export function ViewProvider({ children }: ViewProviderProps) {
  const { theme } = useViewStore();

  // Aplica o tema quando o componente é montado
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  return <>{children}</>;
} 