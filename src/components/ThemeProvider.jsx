import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const themes = {
  light: {
    name: 'Светлая',
    colors: {
      background: '#f8fafc',
      foreground: '#1e293b',
      card: '#ffffff',
      cardForeground: '#1e293b',
      popover: '#ffffff',
      popoverForeground: '#1e293b',
      primary: '#3b82f6',
      primaryForeground: '#ffffff',
      secondary: '#e0f2fe',
      secondaryForeground: '#1e293b',
      muted: '#e2e8f0',
      mutedForeground: '#64748b',
      accent: '#bfdbfe',
      accentForeground: '#1e293b',
      destructive: '#ef4444',
      destructiveForeground: '#f8fafc',
      border: '#d1d5db',
      input: '#e5e7eb',
      ring: '#3b82f6',
    }
  },
     dark: {
    name: 'Темная',
    colors: {
      background: 'oklch(0.145 0 0)',
      foreground: 'oklch(0.985 0 0)', // <-- Главный цвет текста теперь светлый
      card: 'oklch(0.205 0 0)',
      cardForeground: 'oklch(0.485 0 0)',
      popover: 'oklch(0.205 0 0)',
      popoverForeground: 'oklch(0.985 0 0)',
      primary: 'oklch(0.922 0 0)',
      primaryForeground: 'oklch(0.205 0 0)',
      secondary: 'oklch(0.269 0 0)',
      secondaryForeground: 'oklch(0.985 0 0)',
      muted: 'oklch(0.269 0 0)',
      mutedForeground: 'oklch(0.708 0 0)',
      accent: 'oklch(0.269 0 0)',
      accentForeground: 'oklch(0.985 0 0)',
      destructive: 'oklch(0.704 0.191 22.216)',
      border: 'oklch(1 0 0 / 10%)',
      input: 'oklch(1 0 0 / 15%)',
      ring: 'oklch(0.556 0 0)',
    }
  },




  blue: {
    name: 'Синяя',
    colors: {
      background: '#e0f7fa',
      foreground: '#006064',
      card: '#ffffff',
      cardForeground: '#006064',
      popover: '#ffffff',
      popoverForeground: '#006064',
      primary: '#00bcd4',
      primaryForeground: '#ffffff',
      secondary: '#b2ebf2',
      secondaryForeground: '#006064',
      muted: '#e0f7fa',
      mutedForeground: '#00838f',
      accent: '#80deea',
      accentForeground: '#006064',
      destructive: '#ef4444',
      destructiveForeground: '#f8fafc',
      border: '#80deea',
      input: '#b2ebf2',
      ring: '#00bcd4',
    }
  },
  green: {
    name: 'Зеленая',
    colors: {
      background: '#f0fdf4',
      foreground: '#14532d',
      card: '#ffffff',
      cardForeground: '#14532d',
      popover: '#ffffff',
      popoverForeground: '#14532d',
      primary: '#16a34a',
      primaryForeground: '#f0fdf4',
      secondary: '#dcfce7',
      secondaryForeground: '#14532d',
      muted: '#dcfce7',
      mutedForeground: '#15803d',
      accent: '#bbf7d0',
      accentForeground: '#14532d',
      destructive: '#ef4444',
      destructiveForeground: '#f8fafc',
      border: '#bbf7d0',
      input: '#dcfce7',
      ring: '#16a34a',
    }
  },
  purple: {
    name: 'Фиолетовая',
    colors: {
      background: '#f3e8ff',
      foreground: '#581c87',
      card: '#ffffff',
      cardForeground: '#581c87',
      popover: '#ffffff',
      popoverForeground: '#581c87',
      primary: '#9333ea',
      primaryForeground: '#f3e8ff',
      secondary: '#e9d5ff',
      secondaryForeground: '#581c87',
      muted: '#e9d5ff',
      mutedForeground: '#7c3aed',
      accent: '#d8b4fe',
      accentForeground: '#581c87',
      destructive: '#ef4444',
      destructiveForeground: '#f8fafc',
      border: '#d8b4fe',
      input: '#e9d5ff',
      ring: '#9333ea',
    }
  },
  orange: {
    name: 'Оранжевая',
    colors: {
      background: '#fff7ed',
      foreground: '#9a3412',
      card: '#ffffff',
      cardForeground: '#9a3412',
      popover: '#ffffff',
      popoverForeground: '#9a3412',
      primary: '#f97316',
      primaryForeground: '#fff7ed',
      secondary: '#ffedd5',
      secondaryForeground: '#9a3412',
      muted: '#ffedd5',
      mutedForeground: '#ea580c',
      accent: '#fed7aa',
      accentForeground: '#9a3412',
      destructive: '#ef4444',
      destructiveForeground: '#f8fafc',
      border: '#fed7aa',
      input: '#ffedd5',
      ring: '#f97316',
    }
  }
};

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('spu-theme');
    if (savedTheme && themes[savedTheme]) {
      setCurrentTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    const theme = themes[currentTheme];
    const root = document.documentElement;
    
    
    Object.entries(theme.colors).forEach(([key, value]) => {
      const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVar, value);
    });

   
    root.className = `theme-${currentTheme}`;
    
    
    if (currentTheme === 'dark') {
      root.style.setProperty('--text-primary', '#f1f5f9');
      root.style.setProperty('--text-secondary', '#cbd5e1');
      root.style.setProperty('--text-muted', '#94a3b8');
    } else {
      root.style.setProperty('--text-primary', '#1e293b');
      root.style.setProperty('--text-secondary', '#475569');
      root.style.setProperty('--text-muted', '#64748b');
    }
    
    localStorage.setItem('spu-theme', currentTheme);
  }, [currentTheme]);
  

  const changeTheme = (themeName) => {
    if (themes[themeName]) {
      setCurrentTheme(themeName);
    }
  };

  const value = {
    currentTheme,
    themes,
    changeTheme,
    theme: themes[currentTheme]
  };

  return (
    <ThemeContext.Provider value={value}>
      <div className={`theme-${currentTheme}`} style={{ minHeight: '100vh' }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};