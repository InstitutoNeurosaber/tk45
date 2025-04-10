import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useViewStore } from '../stores/viewStore';

export function ThemeToggle() {
  const { theme, toggleTheme } = useViewStore();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all duration-200 ease-in-out transform hover:scale-105"
      aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5 transition-transform duration-200 rotate-0 hover:rotate-90" />
      ) : (
        <Moon className="h-5 w-5 transition-transform duration-200" />
      )}
    </button>
  );
}