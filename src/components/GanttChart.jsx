import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  RotateCcw,
  Move,
  Hourglass
} from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

const GanttChart = forwardRef(({ results, project, resourceLimit, compactForExport = false }, ref) => {
  const [history, setHistory] = useState([]);
  const [showCriticalPath, setShowCriticalPath] = useState(true);
  const [showTimeScale, setShowTimeScale] = useState(true);
  const [showResources, setShowResources] = useState(true);
  const [showDummyTasks, setShowDummyTasks] = useState(true);
  const [showTimeReserves, setShowTimeReserves] = useState(true); 
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0 });
  // Локальная копия задач, которую мы сможем изменять
const [localTasks, setLocalTasks] = useState([]);
// Состояние перетаскивания: какую задачу тянем и откуда начали
const [dragInfo, setDragInfo] = useState({ taskId: null, startX: 0, originalStart: 0 });

// Постоянная высота графика ресурсов
const RESOURCE_CHART_HEIGHT = 300; 

// Синхронизируем локальные задачи с входящими данными при загрузке
useEffect(() => {
  
  if (results?.tasks) {
    setLocalTasks(JSON.parse(JSON.stringify(results.tasks)));
  }
}, [results]);
  
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const isDraggingRef = useRef(false); // Будет true только когда ЛКМ зажата над задачей
  const animationFrameRef = useRef(null);
  
 useImperativeHandle(ref, () => ({
  getAsBase64: () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("Диаграмма Ганта еще не отрисована.");
      return null;
    }

    try {
      drawGanttChart();
      const maxExportWidth = 2200;
      if (canvas.width <= maxExportWidth) {
        return canvas.toDataURL('image/png', 1.0);
      }

      const exportScale = maxExportWidth / canvas.width;
      const exportCanvas = document.createElement('canvas');
      const exportCtx = exportCanvas.getContext('2d');
      if (!exportCtx) {
        return canvas.toDataURL('image/png', 1.0);
      }

      exportCanvas.width = Math.max(1, Math.round(canvas.width * exportScale));
      exportCanvas.height = Math.max(1, Math.round(canvas.height * exportScale));
      exportCtx.imageSmoothingEnabled = true;
      exportCtx.imageSmoothingQuality = 'high';
      exportCtx.fillStyle = BACKGROUND_COLOR;
      exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      exportCtx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);

      return exportCanvas.toDataURL('image/png', 1.0);
    } catch (e) {
      console.error("Ошибка при создании base64 из диаграммы Ганта:", e);
      return null;
    }
  },
  getPaginatedBase64: () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("Диаграмма Ганта еще не отрисована.");
      return [];
    }

    try {
      drawGanttChart();

      const styleWidth = parseFloat(canvas.style.width) || canvas.clientWidth || 1;
      const pixelRatio = canvas.width / Math.max(1, styleWidth);
      const labelWidthPx = Math.max(1, Math.round(LABEL_WIDTH * pixelRatio));
      const totalTimelinePx = Math.max(0, canvas.width - labelWidthPx);
      const actualTimelineCssWidth = Math.max(1, (projectDuration + 1) * DAY_WIDTH * scale);
      const actualTimelinePx = Math.max(
        1,
        Math.min(totalTimelinePx, Math.round(actualTimelineCssWidth * pixelRatio))
      );
      const preferredSliceCssWidth = Math.max(600, 18 * DAY_WIDTH * scale);
      const preferredSlicePx = Math.max(1, Math.round(preferredSliceCssWidth * pixelRatio));
      const pageCount = Math.max(1, Math.ceil(actualTimelinePx / preferredSlicePx));
      const balancedSlicePx = Math.max(1, Math.ceil(actualTimelinePx / pageCount));

      const pages = [];

      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        const startPx = pageIndex * balancedSlicePx;
        const sliceWidthPx = Math.min(balancedSlicePx, actualTimelinePx - startPx);
        if (sliceWidthPx <= 0) {
          continue;
        }
        const pageCanvas = document.createElement('canvas');
        const pageCtx = pageCanvas.getContext('2d');
        if (!pageCtx) {
          return [canvas.toDataURL('image/png', 1.0)];
        }

        pageCanvas.width = labelWidthPx + sliceWidthPx;
        pageCanvas.height = canvas.height;

        pageCtx.fillStyle = BACKGROUND_COLOR;
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        pageCtx.drawImage(
          canvas,
          0,
          0,
          labelWidthPx,
          canvas.height,
          0,
          0,
          labelWidthPx,
          canvas.height
        );

        pageCtx.drawImage(
          canvas,
          labelWidthPx + startPx,
          0,
          sliceWidthPx,
          canvas.height,
          labelWidthPx,
          0,
          sliceWidthPx,
          canvas.height
        );

        pages.push(pageCanvas.toDataURL('image/png', 1.0));
      }

      return pages;
    } catch (e) {
      console.error("Ошибка при создании страниц диаграммы Ганта:", e);
      return [];
    }
  },
}));

  const tasks = results?.tasks || [];
  const projectDuration = results?.projectDuration || 0;
  const criticalPath = results?.criticalPath || [];


  const TASK_HEIGHT = 32;
  const TASK_MARGIN = 6;
  const ROW_HEIGHT = TASK_HEIGHT + TASK_MARGIN * 2;
  const HEADER_HEIGHT = 80;
  const LABEL_WIDTH = 320;
  const DAY_WIDTH = 50;
  const GRID_COLOR = '#f1f5f9';
  const BORDER_COLOR = '#e2e8f0';
  const CRITICAL_COLOR = '#ef4444';
  const NORMAL_COLOR = '#3b82f6';
  const BACKGROUND_COLOR = '#ffffff';
  const HEADER_COLOR = '#f8fafc';

  const formatChartNumber = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number) || Math.abs(number) < 0.005) {
      return '0.00';
    }
    return number.toFixed(2);
  };

  useEffect(() => {
    if (!compactForExport) return;

    const usableWidth = 1500 - LABEL_WIDTH;
    const timelineWidth = Math.max(1, projectDuration * DAY_WIDTH);
    const fittedScale = Math.min(1, Math.max(0.12, usableWidth / timelineWidth));

    setScale(fittedScale);
    setScrollOffset({ x: 0, y: 0 });
  }, [compactForExport, projectDuration]);

  
  const handleWheel = useCallback((e) => {
  if (e.ctrlKey) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.max(0.2, Math.min(prev * delta, 5)));
    return;
  }

  e.preventDefault();

  setScrollOffset(prev => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return prev;

    // --- РАЗМЕРЫ ЭКРАНА (ВИДИМАЯ ОБЛАСТЬ) ---
    const viewWidth = container.offsetWidth;
    const viewHeight = container.offsetHeight;

    // --- ПОЛНЫЕ РАЗМЕРЫ КОНТЕНТА ---
    // Ширина: Названия (320px) + Дни проекта * ширина дня * масштаб
    const fullContentWidth = LABEL_WIDTH + (projectDuration * DAY_WIDTH * scale);
    
    // Высота: Шапка (80px) + Задачи * 40px + График ресурсов (если есть)
    const tasksHeight = localTasks.length * ROW_HEIGHT;
    const resourcesHeight = showResources ? RESOURCE_CHART_HEIGHT : 0;
    const fullContentHeight = HEADER_HEIGHT + tasksHeight + resourcesHeight;

    // --- ЛИМИТЫ (Отрицательные значения) ---
    // Мы не можем скроллить влево/вниз больше чем разница между контентом и экраном
    // Если контент меньше экрана, лимит должен быть 0
    const minX = Math.min(0, viewWidth - fullContentWidth - 100); // 100px запас справа
    const minY = Math.min(0, viewHeight - fullContentHeight - 50);  // 50px запас снизу

    // --- СКОРОСТЬ И НАПРАВЛЕНИЕ ---
    const scrollSpeed = 0.8; 
    const dx = e.shiftKey ? e.deltaY * scrollSpeed : 0;
    const dy = e.shiftKey ? 0 : e.deltaY * scrollSpeed;

    // --- РЕЗУЛЬТАТ С ЗАЖИМОМ (CLAMP) ---
    return {
      x: Math.min(0, Math.max(prev.x - dx, minX)),
      y: Math.min(0, Math.max(prev.y - dy, minY))
    };
  });
}, [scale, projectDuration, localTasks.length, showResources, LABEL_WIDTH, HEADER_HEIGHT, ROW_HEIGHT, DAY_WIDTH]);

  const handleMouseDown = useCallback((e) => {
  const rect = canvasRef.current.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left - scrollOffset.x);
  const mouseY = (e.clientY - rect.top - scrollOffset.y);

  const clickedTaskIndex = localTasks.findIndex((task, index) => {
    const y = HEADER_HEIGHT + index * ROW_HEIGHT + TASK_MARGIN;
    const xStart = LABEL_WIDTH + (task.earlyStart || 0) * DAY_WIDTH * scale;
    const xEnd = xStart + task.duration * DAY_WIDTH * scale;
    return mouseY >= y && mouseY <= y + TASK_HEIGHT && mouseX >= xStart && mouseX <= xEnd;
  });

  if (clickedTaskIndex !== -1) {
    // ПЕРЕД тем как начать двигать, сохраняем текущее (еще старое) состояние в историю
    const currentState = JSON.stringify(localTasks);
    setHistory(prev => [...prev, currentState]);

    const task = localTasks[clickedTaskIndex];
    isDraggingRef.current = true;
    setDragInfo({
      taskId: task.id,
      startX: e.clientX,
      originalStart: task.earlyStart
    });
  } else {
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
  }
}, [localTasks, scrollOffset, scale]);

// Вспомогательная функция: кто должен закончиться до начала текущей задачи
const getTaskPredecessors = (currentTask, allTasks) => {
  const [startNode] = currentTask.id.split('-').map(Number);
  return allTasks.filter(t => {
    const [_, endNode] = t.id.split('-').map(Number);
    return endNode === startNode;
  });
};

// Вспомогательная функция: кто должен начаться после конца текущей задачи
const getTaskSuccessors = (currentTask, allTasks) => {
  const [_, endNode] = currentTask.id.split('-').map(Number);
  return allTasks.filter(t => {
    const [childStartNode] = t.id.split('-').map(Number);
    return childStartNode === endNode;
  });
};

// Основная функция каскадного обновления
const updateCascade = (allTasks, movedTaskId, direction, originalResults) => {
  const task = allTasks.find(t => t.id === movedTaskId);
  if (!task) return;

  if (direction === 'forward') {
    // ТОЛКАЕМ ВПРАВО (Потомки)
    const taskEnd = task.earlyStart + task.duration;
    const successors = getTaskSuccessors(task, allTasks);

    successors.forEach(child => {
      if (child.earlyStart < taskEnd) {
        child.earlyStart = taskEnd;
        updateCascade(allTasks, child.id, 'forward', originalResults);
      }
    });
  } else if (direction === 'backward') {
    // ТЯНЕМ ВЛЕВО (Предки)
    const taskStart = task.earlyStart;
    const predecessors = getTaskPredecessors(task, allTasks);

    predecessors.forEach(pred => {
      // Идеальный финиш для предка - это начало текущей задачи
      const targetFinish = taskStart;
      const predOriginal = originalResults.find(t => t.id === pred.id);
      
      // Предка можно двигать назад только до его "законного" раннего старта
      // Чтобы не сдвинуть критический путь или начало проекта
      const minStart = predOriginal.earlyStart;
      
      if (pred.earlyStart + pred.duration > targetFinish) {
        let newStart = targetFinish - pred.duration;
        
        // Ограничиваем, чтобы не уйти левее дозволенного
        if (newStart < minStart) newStart = minStart;
        
        if (pred.earlyStart !== newStart) {
          pred.earlyStart = newStart;
          // Рекурсивно тянем предков этого предка
          updateCascade(allTasks, pred.id, 'backward', originalResults);
        }
      }
    });
  }
};

  const handleMouseMove = useCallback((e) => {
  if (!isDraggingRef.current || !dragInfo.taskId) {
    if (isPanning) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      setScrollOffset(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      setPanStart({ x: e.clientX, y: e.clientY });
    }
    return;
  }

  const deltaX = e.clientX - dragInfo.startX;
  const daysDelta = Math.round((deltaX / (DAY_WIDTH * scale)) * 10) / 10;
  
  setLocalTasks(prev => {
    const newTasks = JSON.parse(JSON.stringify(prev));
    const task = newTasks.find(t => t.id === dragInfo.taskId);
    const originalTask = results.tasks.find(t => t.id === dragInfo.taskId);
    
    let newStart = dragInfo.originalStart + daysDelta;

    // ОГРАНИЧЕНИЕ: Самое раннее — это оригинальный Early Start задачи
    // (потому что предки не могут уйти левее своих оригинальных позиций)
    if (newStart < originalTask.earlyStart) {
      newStart = originalTask.earlyStart;
    }

    // ОГРАНИЧЕНИЕ: Самое позднее — это Early Start + Резерв (Late Start)
    const maxAllowedStart = originalTask.earlyStart + (originalTask.totalFloat || 0);
    if (newStart > maxAllowedStart) {
      newStart = maxAllowedStart;
    }

    if (task.earlyStart === newStart) return prev;

    const direction = newStart > task.earlyStart ? 'forward' : 'backward';
    task.earlyStart = newStart;

    // Запускаем каскад в зависимости от направления движения
    updateCascade(newTasks, task.id, direction, results.tasks);

    
    newTasks.forEach(t => {
      const orig = results.tasks.find(ot => ot.id === t.id);
      const currentFinish = t.earlyStart + t.duration;
      t.totalFloat = Math.max(0, Math.round((orig.lateFinish - currentFinish) * 10) / 10);
    });

    return newTasks;
  });
}, [dragInfo, isPanning, panStart, scale, results.tasks]);

  const handleMouseUp = useCallback(() => {
  // Если мы закончили тащить, но ничего не изменилось (просто кликнули)
  // можно было бы удалить последний шаг из истории, но для простоты 
  // оставим так — это не критично.
  
  isDraggingRef.current = false;
  setDragInfo({ taskId: null, startX: 0, originalStart: 0 });
  setIsPanning(false);
}, []); // Зависимости теперь не нужны
  useEffect(() => {
    const canvas = canvasRef.current;
    
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      canvas.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        canvas.removeEventListener('wheel', handleWheel);
        canvas.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [handleWheel, handleMouseDown, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    if (tasks.length > 0) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(drawGanttChart);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [localTasks, showCriticalPath, showTimeScale, showResources, showTimeReserves,showDummyTasks, scale, scrollOffset]);

const drawResourceChart = (ctx, chartWidth, totalHeight) => {
  const limit = resourceLimit || 10;
  
  // Увеличиваем отступы, чтобы график не жался к краям
  const TOP_PADDING = 60;    // Место для заголовка "Ресурсная гистограмма"
  const BOTTOM_PADDING = 50; // Место для подписей дней и оси X
  const LEFT_AXIS_SPACE = 60; // Место для вертикальной подписи оси Y
  
  const startY = totalHeight - RESOURCE_CHART_HEIGHT + TOP_PADDING;
  const startX = LABEL_WIDTH;
  const dayWidth = DAY_WIDTH * scale;
  const chartAreaHeight = RESOURCE_CHART_HEIGHT - TOP_PADDING - BOTTOM_PADDING;

  // 1. Логика расчета (без изменений)
  const resourceUsage = new Array(Math.ceil(projectDuration) + 1).fill(0);
  localTasks.forEach(task => {
    const taskStart = task.earlyStart;
    const taskEnd = task.earlyStart + task.duration;
    const performers = task.numberOfPerformers || 0;
    for (let i = 0; i < resourceUsage.length; i++) {
      const overlapStart = Math.max(taskStart, i);
      const overlapEnd = Math.min(taskEnd, i + 1);
      if (overlapEnd - overlapStart > 0.001) {
        resourceUsage[i] += performers;
      }
    }
  });

  const maxPeople = Math.max(...resourceUsage, limit);

  // --- 2. ЗАГОЛОВОК-РАЗДЕЛИТЕЛЬ ---
  // Рисуем заголовок посередине, перекрывая пунктирные линии сетки
  const titleText = "Ресурсная гистограмма";
  ctx.font = 'bold 16px sans-serif';
  const titleWidth = ctx.measureText(titleText).width;
  const centerX = startX + (chartWidth - startX) / 2;
  const titleY = startY - 30;

  // "Прерываем" линию: рисуем белый прямоугольник под текстом
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(centerX - (titleWidth / 2) - 10, titleY - 15, titleWidth + 20, 25);
  
  ctx.fillStyle = '#1e293b';
  ctx.textAlign = 'center';
  ctx.fillText(titleText, centerX, titleY);

  // --- 3. ПОДПИСИ ОСЕЙ ---
  ctx.save();
  // Ось Y (вертикально слева)
  ctx.translate(startX - 45, startY + chartAreaHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#64748b';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Кол-во занятых исполнителей, чел.', 0, 0);
  ctx.restore();

  // Ось X (внизу справа)
  ctx.fillStyle = '#64748b';
  ctx.font = 'italic 12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Время, дни', chartWidth - 10, startY + chartAreaHeight + 40);

  // --- 4. ОТРИСОВКА СТОЛБИКОВ ---
  resourceUsage.forEach((count, day) => {
    const displayCount = Math.round(count * 10) / 10;
    const barHeight = (displayCount / maxPeople) * chartAreaHeight;
    const x = startX + day * dayWidth;
    const y = startY + chartAreaHeight - barHeight;

    // Вертикальная сетка дней (пунктир или тонкая линия)
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, startY + chartAreaHeight);
    ctx.stroke();

    if (displayCount > 0) {
      // Градиент столбика (как в старой версии)
      const gradient = ctx.createLinearGradient(x, y, x, startY + chartAreaHeight);
      if (displayCount > limit) {
        gradient.addColorStop(0, '#f87171'); // Красный верх
        gradient.addColorStop(1, '#dc2626'); // Темно-красный низ
      } else {
        gradient.addColorStop(0, '#60a5fa'); // Голубой верх
        gradient.addColorStop(1, '#2563eb'); // Синий низ
      }
   
      ctx.fillStyle = gradient;
      ctx.fillRect(x + 2, y, dayWidth - 4, barHeight);

      // Число людей сверху столбика
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(displayCount, x + dayWidth / 2, y - 5);
    }

    // Нумерация КАЖДОГО дня (жирным каждый 5-й)
    if (dayWidth > 15) {
      ctx.textAlign = 'center';
      ctx.fillStyle = day % 5 === 0 ? '#1f2937' : '#6b7280';
      ctx.font = day % 5 === 0 ? 'bold 12px sans-serif' : '11px sans-serif';
      ctx.fillText(day, x, startY + chartAreaHeight + 25);
    }
  });

  // --- 5. ЛИНИИ ОСЕЙ И ЛИМИТ ---
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  
  // Основная горизонтальная ось
  ctx.beginPath();
  ctx.moveTo(startX, startY + chartAreaHeight);
  ctx.lineTo(chartWidth, startY + chartAreaHeight);
  ctx.stroke();

  // Линия лимита (если она выше 0)
  const limitY = startY + chartAreaHeight - (limit / maxPeople) * chartAreaHeight;
  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(startX, limitY);
  ctx.lineTo(chartWidth, limitY);
  ctx.stroke();
  ctx.restore();
};
  



  const drawGanttChart = () => {
    const visibleTasks = localTasks.filter(task => {
      if (!showDummyTasks) {
      const isDummy = task.duration === 0 || task.name.toLowerCase().includes('фиктивная');
      return !isDummy;
    }
    return true;
    });
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || tasks.length === 0) return;

    const ctx = canvas.getContext('2d');
    
    
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    const chartWidth = Math.max(containerWidth, LABEL_WIDTH + projectDuration * DAY_WIDTH * scale);
    const chartHeight = showResources ? Math.max(containerHeight, HEADER_HEIGHT + visibleTasks.length * ROW_HEIGHT + RESOURCE_CHART_HEIGHT) : Math.max(containerHeight, HEADER_HEIGHT + visibleTasks.length * ROW_HEIGHT);

   
    const dpr = window.devicePixelRatio || 1;
    canvas.width = chartWidth * dpr;
    canvas.height = chartHeight * dpr;
    canvas.style.width = `${chartWidth}px`;
    canvas.style.height = `${chartHeight}px`;
    
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

   
    ctx.save();
    ctx.translate(scrollOffset.x, scrollOffset.y);

    
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(-scrollOffset.x, -scrollOffset.y, chartWidth, chartHeight);

    
    if (showTimeScale) {
      drawTimeScale(ctx, chartWidth);
    }

  
    
    
    
    visibleTasks.forEach((task, index) => {
      drawTask(ctx, task, index, chartWidth);
    });
    
   
    
    
    drawGrid(ctx, chartWidth, chartHeight);

    drawBorders(ctx, chartWidth, chartHeight);

    if(showResources){
      drawResourceChart(ctx, chartWidth, chartHeight);
    }

    ctx.restore();
  };

  const drawTimeScale = (ctx, chartWidth) => {
    const timeScaleY = 0;
    const timeScaleHeight = HEADER_HEIGHT;
    console.log("Весь объект results:", results);
    
    ctx.fillStyle = HEADER_COLOR;
    ctx.fillRect(-scrollOffset.x, timeScaleY, chartWidth + Math.abs(scrollOffset.x), timeScaleHeight);

    
    const gradient = ctx.createLinearGradient(0, timeScaleY, 0, timeScaleHeight);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#f8fafc');
    ctx.fillStyle = gradient;
    ctx.fillRect(-scrollOffset.x, timeScaleY, chartWidth + Math.abs(scrollOffset.x), timeScaleHeight);

    
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-scrollOffset.x, timeScaleHeight);
    ctx.lineTo(chartWidth + Math.abs(scrollOffset.x), timeScaleHeight);
    ctx.stroke();

  
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const startX = LABEL_WIDTH;
    const dayWidth = DAY_WIDTH * scale;

  
    for (let day = 0; day <= projectDuration + 1; day++) {
      const x = startX + day * dayWidth;
      
      if (x > chartWidth + Math.abs(scrollOffset.x)) break;
      if (x < -Math.abs(scrollOffset.x) - dayWidth) continue;

      
      ctx.strokeStyle = day % 5 === 0 ? '#cbd5e1' : '#e2e8f0';
      ctx.lineWidth = day % 5 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, timeScaleHeight);
      ctx.stroke();

      
      if (dayWidth > 25) {
        ctx.fillStyle = day % 5 === 0 ? '#1f2937' : '#6b7280';
        ctx.font = day % 5 === 0 ? 'bold 12px sans-serif' : '11px sans-serif';
        ctx.fillText(`${day}`, x, timeScaleHeight - 20);
      }
    }

    
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Время (дни)', startX + (projectDuration * dayWidth) / 2, 25);

    ctx.textAlign = 'left';
    ctx.fillText('Задачи', 15, 25);

   
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(LABEL_WIDTH, 0);
    ctx.lineTo(LABEL_WIDTH, timeScaleHeight);
    ctx.stroke();
  };

  const drawTask = (ctx, task, index, chartWidth) => {
    const y = HEADER_HEIGHT + index * ROW_HEIGHT;
    const taskY = y + TASK_MARGIN;

  
    ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#fafbfc';
    ctx.fillRect(-scrollOffset.x, y, chartWidth + Math.abs(scrollOffset.x), ROW_HEIGHT);

    
    ctx.fillStyle = '#1f2937';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    const taskLabel = `${task.id}. ${task.name || 'Без названия'}`;
    const maxLabelWidth = LABEL_WIDTH - 30;
    const truncatedLabel = truncateText(ctx, taskLabel, maxLabelWidth);
    
    ctx.fillText(truncatedLabel, 15, taskY + TASK_HEIGHT / 2);

    if (showResources && task.numberOfPerformers) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px sans-serif';
      ctx.fillText(`👥 ${task.numberOfPerformers} исп.`, 15, taskY + TASK_HEIGHT / 2 + 16);
    }

    const startX = LABEL_WIDTH + (task.earlyStart || 0) * DAY_WIDTH * scale;
    const taskWidth = task.duration * DAY_WIDTH * scale;
    
    if (startX < chartWidth + Math.abs(scrollOffset.x) && startX + taskWidth > -Math.abs(scrollOffset.x)) {
      const isCritical = criticalPath.includes(task.id) || task.isCritical;
      
     
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(startX + 2, taskY + 2, Math.min(taskWidth, chartWidth - startX), TASK_HEIGHT);
      
     
      const gradient = ctx.createLinearGradient(startX, taskY, startX, taskY + TASK_HEIGHT);
      if (isCritical) {
        gradient.addColorStop(0, '#f87171');
        gradient.addColorStop(1, '#dc2626');
      } else {
        gradient.addColorStop(0, '#60a5fa');
        gradient.addColorStop(1, '#2563eb');
      }
      
      ctx.fillStyle = gradient;
      ctx.fillRect(startX, taskY, Math.min(taskWidth, chartWidth - startX), TASK_HEIGHT);
      
    
      ctx.strokeStyle = isCritical ? '#b91c1c' : '#1d4ed8';
      ctx.lineWidth = 1;
      ctx.strokeRect(startX, taskY, Math.min(taskWidth, chartWidth - startX), TASK_HEIGHT);
      
    
      if (taskWidth > 60) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const textX = startX + Math.min(taskWidth, chartWidth - startX) / 2;
        const durationText = `${task.duration}д`;
        
        if (textX < chartWidth + Math.abs(scrollOffset.x)) {
          // Тень для текста
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.fillText(durationText, textX + 1, taskY + TASK_HEIGHT / 2 + 1);
          
          ctx.fillStyle = '#ffffff';
          ctx.fillText(durationText, textX, taskY + TASK_HEIGHT / 2);
        }
      }
      
   
      if (isCritical && showCriticalPath) {
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(startX - 10, taskY + TASK_HEIGHT / 2, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
       
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', startX - 10, taskY + TASK_HEIGHT / 2);
      }

      
      if (showTimeReserves && task.totalFloat !== undefined && task.totalFloat > 0.005) {
        const floatStartX = startX + taskWidth;
        const floatWidth = task.totalFloat * DAY_WIDTH * scale;

        if (floatStartX < chartWidth + Math.abs(scrollOffset.x) && floatStartX + floatWidth > -Math.abs(scrollOffset.x)) {
          ctx.fillStyle = 'rgba(147, 197, 253, 0.6)'; 
          ctx.fillRect(floatStartX, taskY, floatWidth, TASK_HEIGHT);
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 1;
          ctx.strokeRect(floatStartX, taskY, floatWidth, TASK_HEIGHT);

          if (floatWidth > 20) { 
            ctx.fillStyle = '#1e40af';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`Резерв: ${formatChartNumber(task.totalFloat)}д`, floatStartX + floatWidth / 2, taskY + TASK_HEIGHT / 2);
          }
        }
      }
    }

  
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-scrollOffset.x, y + ROW_HEIGHT);
    ctx.lineTo(chartWidth + Math.abs(scrollOffset.x), y + ROW_HEIGHT);
    ctx.stroke();
  };

  const drawGrid = (ctx, chartWidth, chartHeight) => {
  const startX = LABEL_WIDTH;
  const dayWidth = DAY_WIDTH * scale;
  
  for (let day = 0; day <= projectDuration + 1; day++) {
    const x = startX + day * dayWidth;
    if (x > chartWidth + Math.abs(scrollOffset.x)) break;
    if (x < -Math.abs(scrollOffset.x)) continue;
    
    // Определяем стиль линии (каждые 5 дней линия чуть темнее)
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = day % 5 === 0 ? 1 : 0.5;

    ctx.beginPath();
    
    // --- НОВАЯ ЛОГИКА ПУНКТИРА ---
    // Устанавливаем пунктир: 5px штрих, 5px пустота
    ctx.setLineDash([5, 5]); 
    
    ctx.moveTo(x, HEADER_HEIGHT);
    ctx.lineTo(x, chartHeight);
    ctx.stroke();
    
    // СБРОС: Важно сбросить пунктир в [] сразу после stroke, 
    // чтобы прямоугольники работ не стали пунктирными!
    ctx.setLineDash([]); 
    // -----------------------------
  }
};

  const drawBorders = (ctx, chartWidth, chartHeight) => {
    
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(LABEL_WIDTH, 0);
    ctx.lineTo(LABEL_WIDTH, chartHeight);
    ctx.stroke();

  
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(-scrollOffset.x, -scrollOffset.y, chartWidth + Math.abs(scrollOffset.x), chartHeight + Math.abs(scrollOffset.y));
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
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  };

  const exportToSVG = () => {
    const containerWidth = containerRef.current?.offsetWidth || 800;
    const chartWidth = Math.max(containerWidth, LABEL_WIDTH + (projectDuration + 1) * DAY_WIDTH * scale);
    const chartHeight = HEADER_HEIGHT + tasks.length * ROW_HEIGHT;

    let svg = `<svg width="${chartWidth}" height="${chartHeight}" xmlns="http://www.w3.org/2000/svg">`;
    
  
    svg += `<rect width="${chartWidth}" height="${chartHeight}" fill="${BACKGROUND_COLOR}"/>`;
    
    
    const headerGradient = `<defs><linearGradient id="headerGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" /><stop offset="100%" style="stop-color:#f8fafc;stop-opacity:1" /></linearGradient></defs>`;
    svg += headerGradient;
    svg += `<rect width="${chartWidth}" height="${HEADER_HEIGHT}" fill="url(#headerGrad)"/>`;
    svg += `<text x="15" y="25" font-family="Arial" font-size="16" font-weight="bold" fill="#1f2937">Задачи</text>`;
    svg += `<text x="${LABEL_WIDTH + (projectDuration * DAY_WIDTH * scale) / 2}" y="25" font-family="Arial" font-size="16" font-weight="bold" fill="#1f2937" text-anchor="middle">Время (дни)</text>`;
    
   
    for (let day = 0; day <= projectDuration; day++) {
      const x = LABEL_WIDTH + day * DAY_WIDTH * scale;
      if (x > chartWidth) break;
      
      svg += `<line x1="${x}" y1="0" x2="${x}" y2="${HEADER_HEIGHT}" stroke="${day % 5 === 0 ? '#cbd5e1' : '#e2e8f0'}" stroke-width="${day % 5 === 0 ? 2 : 1}"/>`;
      if (DAY_WIDTH * scale > 25) {
        svg += `<text x="${x}" y="${HEADER_HEIGHT - 20}" font-family="Arial" font-size="${day % 5 === 0 ? 12 : 11}" font-weight="${day % 5 === 0 ? 'bold' : 'normal'}" fill="${day % 5 === 0 ? '#1f2937' : '#6b7280'}" text-anchor="middle">${day}</text>`;
      }
    }
    
   
    tasks.forEach((task, index) => {
      const y = HEADER_HEIGHT + index * ROW_HEIGHT;
      const taskY = y + TASK_MARGIN;
      
     
      svg += `<rect x="0" y="${y}" width="${chartWidth}" height="${ROW_HEIGHT}" fill="${index % 2 === 0 ? '#ffffff' : '#fafbfc'}"/>`;
      
      
      const taskLabel = `${task.id}. ${task.name || 'Без названия'}`;
      svg += `<text x="15" y="${taskY + TASK_HEIGHT / 2}" font-family="Arial" font-size="13" fill="#1f2937" dominant-baseline="middle">${taskLabel}</text>`;
      
    
      const startX = LABEL_WIDTH + (task.earlyStart || 0) * DAY_WIDTH * scale;
      const taskWidth = task.duration * DAY_WIDTH * scale;
      const isCritical = criticalPath.includes(task.id) || task.isCritical;
      
      if (startX < chartWidth) {
        const gradientId = `taskGrad${index}`;
        svg += `<defs><linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">`;
        if (isCritical) {
          svg += `<stop offset="0%" style="stop-color:#f87171;stop-opacity:1" /><stop offset="100%" style="stop-color:#dc2626;stop-opacity:1" />`;
        } else {
          svg += `<stop offset="0%" style="stop-color:#60a5fa;stop-opacity:1" /><stop offset="100%" style="stop-color:#2563eb;stop-opacity:1" />`;
        }
        svg += `</linearGradient></defs>`;
        
        svg += `<rect x="${startX}" y="${taskY}" width="${taskWidth}" height="${TASK_HEIGHT}" fill="url(#${gradientId})" stroke="${isCritical ? '#b91c1c' : '#1d4ed8'}" stroke-width="1"/>`;
        
        if (taskWidth > 60) {
          const textX = startX + taskWidth / 2;
          svg += `<text x="${textX}" y="${taskY + TASK_HEIGHT / 2}" font-family="Arial" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${task.duration}д</text>`;
        }

       
        if (isCritical && showCriticalPath) {
          svg += `<circle cx="${startX - 10}" cy="${taskY + TASK_HEIGHT / 2}" r="5" fill="#fbbf24" stroke="#f59e0b" stroke-width="2"/>`;
          svg += `<text x="${startX - 10}" y="${taskY + TASK_HEIGHT / 2}" font-family="Arial" font-size="8" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">!</text>`;
        }

    
        if (showTimeReserves && task.totalFloat !== undefined && task.totalFloat > 0) {
          const floatStartX = startX + taskWidth;
          const floatWidth = task.totalFloat * DAY_WIDTH * scale;
          svg += `<rect x="${floatStartX}" y="${taskY}" width="${floatWidth}" height="${TASK_HEIGHT}" fill="rgba(147, 197, 253, 0.6)" stroke="#60a5fa" stroke-width="1"/>`;
          if (floatWidth > 20) {
            svg += `<text x="${floatStartX + floatWidth / 2}" y="${taskY + TASK_HEIGHT / 2}" font-family="Arial" font-size="10" fill="#1e40af" text-anchor="middle" dominant-baseline="middle">Резерв: ${task.totalFloat}д</text>`;
          }
        }
      }
      
     
      svg += `<line x1="0" y1="${y + ROW_HEIGHT}" x2="${chartWidth}" y2="${y + ROW_HEIGHT}" stroke="#e5e7eb" stroke-width="1"/>`;
    });

    svg += `</svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `gantt_chart_${format(new Date(), 'yyyy-MM-dd')}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    if (!tasks || tasks.length === 0) {
      alert('Нет данных для экспорта в CSV.');
      return;
    }

    const headers = [
      'ID',
      'Название',
      'Длительность',
      'Трудоемкость',
      'Исполнители',
      'Предшественники',
      'Раннее начало',
      'Раннее окончание',
      'Позднее начало',
      'Позднее окончание',
      'Общий резерв',
      'Свободный резерв',
      'Критический путь'
    ];

    const csvRows = [
      headers.join(';')
    ];

    tasks.forEach(task => {
      const row = [
        task.id,
        task.name,
        task.duration,
        task.laborIntensity,
        task.numberOfPerformers,
        task.predecessors.join(', '),
        task.earlyStart,
        task.earlyFinish,
        task.lateStart,
        task.lateFinish,
        task.totalFloat,
        task.freeFloat,
        task.isCritical ? 'Да' : 'Нет'
      ];
      csvRows.push(row.join(';'));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gantt_chart_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const zoomIn = () => {
    setScale(prev => Math.min(prev * 1.1, 5));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev * 0.9, 0.2));
  };

  const resetZoom = () => {
    setScale(1);
    setScrollOffset({ x: 0, y: 0 });
  };

  // Функция "Шаг назад"
const handleUndo = useCallback(() => {
  if (history.length === 0) return;

  // Берем последний "снимок" (это состояние ДО последнего движения)
  const previousStateRaw = history[history.length - 1];
  
  // Применяем его
  setLocalTasks(JSON.parse(previousStateRaw));
  
  // Удаляем этот снимок из истории, так как мы его уже использовали
  setHistory(prev => prev.slice(0, -1));
}, [history]);
useEffect(() => {
  const handleKeyDown = (e) => {
    // Проверяем Ctrl + Z или Cmd + Z (для Mac)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      // Предотвращаем стандартное действие браузера (если оно есть)
      e.preventDefault();
      
      // Вызываем отмену, только если есть что отменять
      if (history.length > 0) {
        handleUndo();
      }
    }
  };

  // Вешаем слушатель на весь документ
  document.addEventListener('keydown', handleKeyDown);

  // Обязательно убираем слушатель при размонтировании компонента, 
  // чтобы не было утечек памяти и лишних срабатываний
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
}, [handleUndo, history.length]); // Перезапускаем, если изменилась функция или длина истории
// Функция "Сброс всех изменений"
const handleReset = useCallback(() => {
  if (window.confirm("Вы уверены, что хотите сбросить все ручные изменения к исходному расчету?")) {
    // Возвращаем данные из исходного пропса results
    setLocalTasks(JSON.parse(JSON.stringify(results.tasks)));
    setHistory([]);
  }
}, [results.tasks]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-3 bg-slate-50 border-b border-slate-200">
      
      
      {/* Здесь можно оставить ваши старые кнопки масштаба, если они были */}
      <div className="text-xs text-slate-500 ml-auto">
        Перетаскивайте синие полоски в пределах резерва
      </div>
    </div>
      <div className="flex justify-between items-center">
        <CardTitle>Диаграмма Ганта</CardTitle>
        <div className="flex items-center space-x-2">
          <Button onClick={resetZoom} size="sm" variant="outline" className="hover:bg-gray-50">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button onClick={zoomIn} size="sm" variant="outline" className="hover:bg-gray-50">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button onClick={zoomOut} size="sm" variant="outline" className="hover:bg-gray-50">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Move className="h-4 w-4" />
              <span>Масштаб: {(scale * 100).toFixed(0)}%</span>
              {isPanning && <Badge variant="secondary">Перемещение</Badge>}
          </div>
          <div className="border-l border-gray-200 mx-2"></div>
          <Button onClick={exportToPNG} size="sm" variant="outline" className="hover:bg-blue-50">
            <Download className="h-4 w-4 mr-2" />
            PNG
          </Button>
          <Button onClick={exportToSVG} size="sm" variant="outline" className="hover:bg-blue-50">
            <Download className="h-4 w-4 mr-2" />
            SVG
          </Button>
          <Button onClick={exportToCSV} size="sm" variant="outline" className="hover:bg-green-50">
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
        </div>
      </div>
     
      <Card className="border-gray-200">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-3">
    <Button
      size="sm"
      variant={showCriticalPath ? "default" : "outline"}
      onClick={() => setShowCriticalPath(!showCriticalPath)}
      className="transition-all duration-200"
    >
      {showCriticalPath ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
      Критический путь
    </Button>
    
    <Button
      size="sm"
      variant={showTimeScale ? "default" : "outline"}
      onClick={() => setShowTimeScale(!showTimeScale)}
      className="transition-all duration-200"
    >
      {showTimeScale ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
      Временная шкала
    </Button>
    
    <Button
      size="sm"
      variant={showResources ? "default" : "outline"}
      onClick={() => setShowResources(!showResources)}
      className="transition-all duration-200"
    >
      {showResources ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
      Ресурсы
    </Button>
    <Button
      size="sm"
      variant={showDummyTasks ? "default" : "outline"}
      onClick={() => setShowDummyTasks(!showDummyTasks)}
      className="transition-all duration-200"
    >
      {showDummyTasks ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
      Фиктивные работы
    </Button>

    <Button 
      size="sm"
      variant={showTimeReserves ? "default" : "outline"}
      onClick={() => setShowTimeReserves(!showTimeReserves)}
      className="transition-all duration-200"
    >
      {showTimeReserves ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
      Резервы времени
    </Button>
  </div>

  {/* Этот элемент создаст пустое пространство и сдвинет следующие кнопки вправо */}
  <div className="flex-grow" />

  {/* Правая группа кнопок управления историей */}
  <div className="flex items-center gap-3">
    <Button
      size="sm"
      variant="outline"
      onClick={handleUndo}
      disabled={history.length === 0}
      className="transition-all duration-200"
    >
      <RotateCcw className="h-4 w-4 mr-2" />
      Шаг назад
      {history.length > 0 && (
        <Badge variant="secondary" className="ml-2 px-1 py-0 h-4 text-[10px]">
          {history.length}
        </Badge>
      )}
    </Button>

    <Button
      size="sm"
      variant="destructive"
      onClick={handleReset}
      className="transition-all duration-200"
    >
      <RotateCcw className="h-4 w-4 mr-2" /> {/* Или иконка Trash2 из lucide */}
      Сбросить изменения
    </Button>
  </div>
            
            
          </div>
        </CardContent>
      </Card>
     
      {results && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <div className="flex flex-wrap gap-6">
              <div>
                <strong>Длительность проекта:</strong> {projectDuration?.toFixed(1)} дней
              </div>
              {criticalPath.length > 0 && (
                <div>
                  <strong>Критический путь:</strong> {criticalPath.join(' → ')}
                </div>
              )}
              <div>
                <strong>Количество задач:</strong> {tasks.length}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      <Card className="w-full border-gray-200 shadow-lg">
        <CardContent className="p-0">
          <div 
            ref={containerRef}
            className="w-full overflow-hidden border rounded-lg"
            style={{ 
              height: '600px',
              cursor: isPanning ? 'grabbing' : 'grab'
            }}
          >
            <canvas
              ref={canvasRef}
              className="block"
              style={{ 
                minWidth: '100%',
                minHeight: '100%'
              }}
            />
          </div>
          <div className="p-3 bg-gray-50 border-t text-xs text-gray-600 flex justify-between items-center">
            <div>
              💡 Используйте Ctrl + колесико мыши для масштабирования, левую кнопку мыши для перемещения
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-blue-500 rounded"></div>
                <span>Обычные работы</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-red-500 rounded"></div>
                <span>Критический путь</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-0.5 h-3 bg-blue-500"></div>
                <span>Фиктивные работы</span>
              </div>
              <div className="flex items-center gap-2"> 
                <div className="w-4 h-3 bg-blue-300 rounded"></div>
                <span>Резервы времени</span>
              </div>

            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
export default GanttChart;
