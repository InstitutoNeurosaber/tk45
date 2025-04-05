import React, { ReactNode } from 'react';

interface BadgeProps {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success';
  className?: string;
  children: ReactNode;
}

export function Badge({ 
  children, 
  variant = 'default', 
  className = '' 
}: BadgeProps) {
  // Classes base para todos os badges
  const baseClasses = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';
  
  // Classes específicas para cada variante
  const variantClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/80',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/80',
    outline: 'text-foreground border border-input hover:bg-accent hover:text-accent-foreground',
    success: 'bg-green-100 text-green-800 hover:bg-green-200'
  };
  
  // Combinação das classes
  const badgeClasses = `${baseClasses} ${variantClasses[variant]} ${className}`;
  
  return (
    <span className={badgeClasses}>
      {children}
    </span>
  );
} 