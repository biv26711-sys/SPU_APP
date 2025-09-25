import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Palette, 
  Check, 
  Sun, 
  Moon, 
  Droplets,
  Leaf,
  Zap,
  Flame
} from 'lucide-react';
import { useTheme } from './ThemeProvider';

const ThemeSettings = () => {
  const { currentTheme, themes, changeTheme } = useTheme();

  const getThemeIcon = (themeName) => {
    switch (themeName) {
      case 'light': return <Sun className="h-4 w-4" />;
      case 'dark': return <Moon className="h-4 w-4" />;
      case 'blue': return <Droplets className="h-4 w-4" />;
      case 'green': return <Leaf className="h-4 w-4" />;
      case 'purple': return <Zap className="h-4 w-4" />;
      case 'orange': return <Flame className="h-4 w-4" />;
      case 'modern': return <Palette className="h-4 w-4" />;
      case 'vibrant': return <Palette className="h-4 w-4" />;
      default: return <Palette className="h-4 w-4" />;
    }
  };

  const getThemeDescription = (themeName) => {
    switch (themeName) {
  case 'light':
    return 'Классическая светлая тема для комфортной\nработы днем';
  case 'dark':
    return 'Темная тема для работы в условиях низкой\nосвещенности';
  case 'blue':
    return 'Профессиональная синяя тема для\nделовой среды';
  case 'green':
    return 'Успокаивающая зеленая тема для\nдлительной работы';
  case 'purple':
    return 'Креативная фиолетовая тема для\nвдохновения';
  case 'orange':
    return 'Энергичная оранжевая тема для\nактивной работы';
  case 'modern':
    return 'Современная тема с чистым и\nминималистичным дизайном';
  case 'vibrant':
    return 'Яркая и динамичная тема с\nнасыщенными цветами';
  default:
    return 'Стандартная тема оформления\n '; 
}
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <Palette className="h-5 w-5" />
            Настройки темы оформления
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <Palette className="h-4 w-4" />
            <AlertDescription style={{ color: 'var(--foreground)' }}>
              Выберите тему оформления, которая лучше всего подходит для вашей работы. 
              Настройки сохраняются автоматически.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(themes).map(([themeName, theme]) => (
              <Card 
                key={themeName}
                className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                  currentTheme === themeName ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => changeTheme(themeName)}
                style={{ 
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--card-foreground)'
                }}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between" style={{ color: 'var(--card-foreground)' }}>
                    <div className="flex items-center gap-2">
                      {getThemeIcon(themeName)}
                      {theme.name}
                    </div>
                    {currentTheme === themeName && (
                      <Badge variant="default" className="flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Активна
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-4 whitespace-pre-wrap h-12" style={{ color: 'var(--muted-foreground)' }}>
                    {getThemeDescription(themeName)}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded border"
                        style={{ 
                          backgroundColor: theme.colors.background, 
                          borderColor: theme.colors.border 
                        }}
                      />
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Фон</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded border"
                        style={{ 
                          backgroundColor: theme.colors.primary, 
                          borderColor: theme.colors.border 
                        }}
                      />
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Основной</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded border"
                        style={{ 
                          backgroundColor: theme.colors.secondary, 
                          borderColor: theme.colors.border 
                        }}
                      />
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Вторичный</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded border"
                        style={{ 
                          backgroundColor: theme.colors.accent, 
                          borderColor: theme.colors.border 
                        }}
                      />
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Акцент</span>
                    </div>
                  </div>

                  <Button 
                    className="w-full mt-4"
                    variant={currentTheme === themeName ? "default" : "outline"}
                    onClick={(e) => {
                      e.stopPropagation();
                      changeTheme(themeName);
                    }}
                  >
                    {currentTheme === themeName ? 'Текущая тема' : 'Применить тему'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 p-4 rounded-lg" style={{ backgroundColor: 'var(--muted)' }}>
            <h3 className="font-medium mb-2" style={{ color: 'var(--foreground)' }}>Предварительный просмотр</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-8 rounded border" 
                  style={{ 
                    backgroundColor: 'var(--card)', 
                    borderColor: 'var(--border)' 
                  }}
                ></div>
                <span className="text-sm" style={{ color: 'var(--foreground)' }}>Карточки и панели</span>
              </div>
              <div className="flex items-center gap-4">
                <Button size="sm">Основная кнопка</Button>
                <Button size="sm" variant="outline">Вторичная кнопка</Button>
              </div>
              <div className="flex items-center gap-2">
                <Badge>Обычный</Badge>
                <Badge variant="secondary">Вторичный</Badge>
                <Badge variant="outline">Контурный</Badge>
              </div>
            </div>
          </div>

          <Alert className="mt-6">
            <Palette className="h-4 w-4" />
            <AlertDescription style={{ color: 'var(--foreground)' }}>
              <strong>Совет:</strong> Для работы в темное время суток рекомендуется использовать темную тему. 
              Для длительной работы с документами подойдет зеленая или синяя тема.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default ThemeSettings;
