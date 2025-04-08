import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useViewStore } from '../stores/viewStore';

export function ThemeToggle() {
  const { theme, toggleTheme } = useViewStore();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-md hover:bg-accent transition-colors"
      aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}