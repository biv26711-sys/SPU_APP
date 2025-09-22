import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BarChart3, 
  Download, 
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

const GanttChart = ({ results, project }) => {
  const [showCriticalPath, setShowCriticalPath] = useState(true);
  const [showTimeScale, setShowTimeScale] = useState(true);
  const [showResources, setShowResources] = useState(true);
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const tasks = results?.tasks || [];
  const projectDuration = results?.projectDuration || 0;
  const criticalPath = results?.criticalPath || [];

  // Настройки диаграммы
  const TASK_HEIGHT = 30;
  const TASK_MARGIN = 5;
  const ROW_HEIGHT = TASK_HEIGHT + TASK_MARGIN * 2;
  const HEADER_HEIGHT = 60;
  const LABEL_WIDTH = 300;
  const DAY_WIDTH = 40;

  useEffect(() => {
    if (tasks.length > 0) {
      drawGanttChart();
    }
  }, [tasks, showCriticalPath, showTimeScale, showResources, scale]);

  const drawGanttChart = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || tasks.length === 0) return;

    const ctx = canvas.getContext('2d');
    
    // Получаем полную ширину контейнера
    const containerWidth = container.offsetWidth;
    const chartWidth = Math.max(containerWidth, LABEL_WIDTH + projectDuration * DAY_WIDTH * scale);
    const chartHeight = HEADER_HEIGHT + tasks.length * ROW_HEIGHT;

    // Устанавливаем размеры canvas
    canvas.width = chartWidth;
    canvas.height = chartHeight;
    canvas.style.width = `${chartWidth}px`;
    canvas.style.height = `${chartHeight}px`;

    // Очищаем canvas
    ctx.clearRect(0, 0, chartWidth, chartHeight);

    // Рисуем фон
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, chartWidth, chartHeight);

    // Рисуем заголовок временной шкалы
    if (showTimeScale) {
      drawTimeScale(ctx, chartWidth);
    }

    // Рисуем задачи
    tasks.forEach((task, index) => {
      drawTask(ctx, task, index, chartWidth);
    });

    // Рисуем сетку
    drawGrid(ctx, chartWidth, chartHeight);
  };

  const drawTimeScale = (ctx, chartWidth) => {
    const timeScaleY = 0;
    const timeScaleHeight = HEADER_HEIGHT;

    // Фон заголовка
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, timeScaleY, chartWidth, timeScaleHeight);

    // Граница заголовка
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, timeScaleHeight);
    ctx.lineTo(chartWidth, timeScaleHeight);
    ctx.stroke();

    // Подписи дней
    ctx.fillStyle = '#374151';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const startX = LABEL_WIDTH;
    const dayWidth = DAY_WIDTH * scale;

    for (let day = 0; day <= projectDuration; day++) {
      const x = startX + day * dayWidth;
      
      if (x > chartWidth) break;

      // Вертикальная линия
      ctx.strokeStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, timeScaleHeight);
      ctx.stroke();

      // Подпись дня
      if (dayWidth > 20) { // Показываем подписи только если есть место
        ctx.fillStyle = '#374151';
        ctx.fillText(`${day}`, x, timeScaleHeight / 2);
      }
    }

    // Заголовок "Время (дни)"
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Время (дни)', startX + (projectDuration * dayWidth) / 2, 20);

    // Заголовок "Работы"
    ctx.textAlign = 'left';
    ctx.fillText('Работы', 10, 20);
  };

  const drawTask = (ctx, task, index, chartWidth) => {
    const y = HEADER_HEIGHT + index * ROW_HEIGHT;
    const taskY = y + TASK_MARGIN;

    // Фон строки (чередующиеся цвета)
    ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f9fafb';
    ctx.fillRect(0, y, chartWidth, ROW_HEIGHT);

    // Подпись задачи
    ctx.fillStyle = '#1f2937';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    const taskLabel = `${task.id} - ${task.name || 'Без названия'}`;
    const maxLabelWidth = LABEL_WIDTH - 20;
    const truncatedLabel = truncateText(ctx, taskLabel, maxLabelWidth);
    
    ctx.fillText(truncatedLabel, 10, taskY + TASK_HEIGHT / 2);

    // Ресурсы
    if (showResources && task.numberOfPerformers) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px Arial';
      ctx.fillText(`${task.numberOfPerformers} исп.`, 10, taskY + TASK_HEIGHT / 2 + 15);
    }

    // Полоса задачи
    const startX = LABEL_WIDTH + (task.earlyStart || 0) * DAY_WIDTH * scale;
    const taskWidth = task.duration * DAY_WIDTH * scale;
    
    if (startX < chartWidth) {
      const isCritical = criticalPath.includes(task.id) || task.isCritical;
      
      // Тень
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(startX + 2, taskY + 2, Math.min(taskWidth, chartWidth - startX), TASK_HEIGHT);
      
      // Основная полоса
      ctx.fillStyle = isCritical ? '#ef4444' : '#3b82f6';
      ctx.fillRect(startX, taskY, Math.min(taskWidth, chartWidth - startX), TASK_HEIGHT);
      
      // Граница полосы
      ctx.strokeStyle = isCritical ? '#dc2626' : '#2563eb';
      ctx.lineWidth = 1;
      ctx.strokeRect(startX, taskY, Math.min(taskWidth, chartWidth - startX), TASK_HEIGHT);
      
      // Текст на полосе (если помещается)
      if (taskWidth > 50) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const textX = startX + Math.min(taskWidth, chartWidth - startX) / 2;
        const durationText = `${task.duration}д`;
        
        if (textX < chartWidth) {
          ctx.fillText(durationText, textX, taskY + TASK_HEIGHT / 2);
        }
      }
      
      // Индикатор критического пути
      if (isCritical && showCriticalPath) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(startX - 8, taskY + TASK_HEIGHT / 2, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // Граница строки
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + ROW_HEIGHT);
    ctx.lineTo(chartWidth, y + ROW_HEIGHT);
    ctx.stroke();
  };

  const drawGrid = (ctx, chartWidth, chartHeight) => {
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 1;

    // Вертикальные линии (дни)
    const startX = LABEL_WIDTH;
    const dayWidth = DAY_WIDTH * scale;
    
    for (let day = 0; day <= projectDuration; day++) {
      const x = startX + day * dayWidth;
      if (x > chartWidth) break;
      
      ctx.beginPath();
      ctx.moveTo(x, HEADER_HEIGHT);
      ctx.lineTo(x, chartHeight);
      ctx.stroke();
    }

    // Граница между подписями и диаграммой
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(LABEL_WIDTH, 0);
    ctx.lineTo(LABEL_WIDTH, chartHeight);
    ctx.stroke();
  };

  const truncateText = (ctx, text, maxWidth) => {
    if (ctx.measureText(text).width <= maxWidth) {
      return text;
    }
    
    let truncated = text;
    while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    
    return truncated + '...';
  };

  const exportToPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `gantt_chart_${format(new Date(), 'yyyy-MM-dd')}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const exportToSVG = () => {
    // Создаем SVG версию диаграммы
    const containerWidth = containerRef.current?.offsetWidth || 800;
    const chartWidth = Math.max(containerWidth, LABEL_WIDTH + projectDuration * DAY_WIDTH * scale);
    const chartHeight = HEADER_HEIGHT + tasks.length * ROW_HEIGHT;

    let svg = `<svg width="${chartWidth}" height="${chartHeight}" xmlns="http://www.w3.org/2000/svg">`;
    
    // Фон
    svg += `<rect width="${chartWidth}" height="${chartHeight}" fill="#ffffff"/>`;
    
    // Заголовок
    svg += `<rect width="${chartWidth}" height="${HEADER_HEIGHT}" fill="#f8fafc"/>`;
    svg += `<text x="10" y="20" font-family="Arial" font-size="14" font-weight="bold" fill="#1f2937">Работы</text>`;
    svg += `<text x="${LABEL_WIDTH + (projectDuration * DAY_WIDTH * scale) / 2}" y="20" font-family="Arial" font-size="14" font-weight="bold" fill="#1f2937" text-anchor="middle">Время (дни)</text>`;
    
    // Временная шкала
    for (let day = 0; day <= projectDuration; day++) {
      const x = LABEL_WIDTH + day * DAY_WIDTH * scale;
      if (x > chartWidth) break;
      
      svg += `<line x1="${x}" y1="0" x2="${x}" y2="${HEADER_HEIGHT}" stroke="#e2e8f0"/>`;
      if (DAY_WIDTH * scale > 20) {
        svg += `<text x="${x}" y="${HEADER_HEIGHT / 2}" font-family="Arial" font-size="12" fill="#374151" text-anchor="middle">${day}</text>`;
      }
    }
    
    // Задачи
    tasks.forEach((task, index) => {
      const y = HEADER_HEIGHT + index * ROW_HEIGHT;
      const taskY = y + TASK_MARGIN;
      
      // Фон строки
      svg += `<rect x="0" y="${y}" width="${chartWidth}" height="${ROW_HEIGHT}" fill="${index % 2 === 0 ? '#ffffff' : '#f9fafb'}"/>`;
      
      // Подпись задачи
      const taskLabel = `${task.id} - ${task.name || 'Без названия'}`;
      svg += `<text x="10" y="${taskY + TASK_HEIGHT / 2}" font-family="Arial" font-size="12" fill="#1f2937" dominant-baseline="middle">${taskLabel}</text>`;
      
      // Полоса задачи
      const startX = LABEL_WIDTH + (task.earlyStart || 0) * DAY_WIDTH * scale;
      const taskWidth = task.duration * DAY_WIDTH * scale;
      const isCritical = criticalPath.includes(task.id) || task.isCritical;
      
      if (startX < chartWidth) {
        svg += `<rect x="${startX}" y="${taskY}" width="${Math.min(taskWidth, chartWidth - startX)}" height="${TASK_HEIGHT}" fill="${isCritical ? '#ef4444' : '#3b82f6'}" stroke="${isCritical ? '#dc2626' : '#2563eb'}"/>`;
        
        if (taskWidth > 50) {
          const textX = startX + Math.min(taskWidth, chartWidth - startX) / 2;
          svg += `<text x="${textX}" y="${taskY + TASK_HEIGHT / 2}" font-family="Arial" font-size="10" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${task.duration}д</text>`;
        }
      }
      
      // Граница строки
      svg += `<line x1="0" y1="${y + ROW_HEIGHT}" x2="${chartWidth}" y2="${y + ROW_HEIGHT}" stroke="#e5e7eb"/>`;
    });
    
    // Вертикальные линии сетки
    for (let day = 0; day <= projectDuration; day++) {
      const x = LABEL_WIDTH + day * DAY_WIDTH * scale;
      if (x > chartWidth) break;
      svg += `<line x1="${x}" y1="${HEADER_HEIGHT}" x2="${x}" y2="${chartHeight}" stroke="#f3f4f6"/>`;
    }
    
    // Граница между подписями и диаграммой
    svg += `<line x1="${LABEL_WIDTH}" y1="0" x2="${LABEL_WIDTH}" y2="${chartHeight}" stroke="#d1d5db" stroke-width="2"/>`;
    
    svg += '</svg>';

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.download = `gantt_chart_${format(new Date(), 'yyyy-MM-dd')}.svg`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const exportToCSV = () => {
    const csvData = [
      ['ID', 'Название', 'Длительность', 'Раннее начало', 'Раннее окончание', 'Позднее начало', 'Позднее окончание', 'Резерв времени', 'Критическая', 'Исполнители'].join(',')
    ];

    tasks.forEach(task => {
      const row = [
        task.id,
        `"${task.name || 'Без названия'}"`,
        task.duration,
        task.earlyStart || 0,
        task.earlyFinish || 0,
        task.lateStart || 0,
        task.lateFinish || 0,
        task.totalFloat || 0,
        criticalPath.includes(task.id) || task.isCritical ? 'Да' : 'Нет',
        task.numberOfPerformers || 1
      ].join(',');
      csvData.push(row);
    });

    const csvContent = csvData.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.download = `gantt_data_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const zoomIn = () => setScale(prev => Math.min(prev * 1.2, 3));
  const zoomOut = () => setScale(prev => Math.max(prev / 1.2, 0.3));
  const resetZoom = () => setScale(1);

  if (!tasks || tasks.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">
            Выполните расчет параметров для построения диаграммы Ганта
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 w-full">
      {/* Заголовок и управление */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Диаграмма Ганта
          </h3>
          <p className="text-sm text-muted-foreground">
            Календарное планирование работ проекта
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={zoomOut} size="sm" variant="outline">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button onClick={resetZoom} size="sm" variant="outline">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button onClick={zoomIn} size="sm" variant="outline">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button onClick={exportToPNG} size="sm" variant="outline">
            Скачать PNG
          </Button>
          <Button onClick={exportToSVG} size="sm" variant="outline">
            Скачать SVG
          </Button>
          <Button onClick={exportToCSV} size="sm" variant="outline">
            Экспорт CSV
          </Button>
        </div>
      </div>

      {/* Настройки отображения */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={showCriticalPath ? "default" : "outline"}
                onClick={() => setShowCriticalPath(!showCriticalPath)}
              >
                {showCriticalPath ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                Критический путь
              </Button>
              
              <Button
                size="sm"
                variant={showTimeScale ? "default" : "outline"}
                onClick={() => setShowTimeScale(!showTimeScale)}
              >
                {showTimeScale ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                Временная шкала в днях
              </Button>
              
              <Button
                size="sm"
                variant={showResources ? "default" : "outline"}
                onClick={() => setShowResources(!showResources)}
              >
                {showResources ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                Ресурсы
              </Button>
            </div>
            
            <div className="text-sm text-muted-foreground">
              Масштаб: {(scale * 100).toFixed(0)}%
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Информация о проекте */}
      {results && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Длительность проекта:</strong> {projectDuration?.toFixed(1)} дней
            {criticalPath.length > 0 && (
              <>
                <br />
                <strong>Критический путь:</strong> {criticalPath.join(' → ')}
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Диаграмма Ганта */}
      <Card className="w-full">
        <CardContent className="p-0">
          <div 
            ref={containerRef}
            className="w-full overflow-x-auto overflow-y-auto"
            style={{ maxHeight: '600px' }}
          >
            <canvas
              ref={canvasRef}
              className="block"
              style={{ minWidth: '100%' }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Обозначения */}
      <Card>
        <CardContent className="p-4">
          <h4 className="font-semibold mb-3">Обозначения:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span>Критические работы</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span>Обычные работы</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
              <span>Индикатор критического пути</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-600" />
              <span>Количество исполнителей</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {tasks.length}
            </div>
            <div className="text-sm text-muted-foreground">Всего работ</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {tasks.filter(t => criticalPath.includes(t.id) || t.isCritical).length}
            </div>
            <div className="text-sm text-muted-foreground">Критических работ</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {projectDuration?.toFixed(1) || 0}
            </div>
            <div className="text-sm text-muted-foreground">Дней проекта</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {tasks.reduce((sum, task) => sum + (task.numberOfPerformers || 1), 0)}
            </div>
            <div className="text-sm text-muted-foreground">Всего исполнителей</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GanttChart;

