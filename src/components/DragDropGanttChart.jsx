import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  BarChart3, 
  Save,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Edit,
  Calendar
} from 'lucide-react';

const DragDropGanttChart = ({ results, onUpdateTasks }) => {
  const canvasRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedTask, setSelectedTask] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [dragMode, setDragMode] = useState('move'); 
  const [editingTask, setEditingTask] = useState(null);

  const TASK_HEIGHT = 30;
  const TASK_MARGIN = 10;
  const HEADER_HEIGHT = 60;
  const LABEL_WIDTH = 200;
  const DAY_WIDTH = 20;

  useEffect(() => {
    if (results && results.tasks) {
      const initialTasks = results.tasks.map((task, index) => ({
        ...task,
        y: HEADER_HEIGHT + index * (TASK_HEIGHT + TASK_MARGIN),
        originalStart: task.earlyStart || 0,
        originalDuration: task.duration,
        currentStart: task.earlyStart || 0,
        currentDuration: task.duration,
        slack: (task.lateStart || 0) - (task.earlyStart || 0)
      }));
      setTasks(initialTasks);
    }
  }, [results]);

  const drawGanttChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(offset.x, offset.y);

    const maxTime = Math.max(...tasks.map(t => (t.currentStart + t.currentDuration) || 0));
    const totalWidth = LABEL_WIDTH + maxTime * DAY_WIDTH;

    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(LABEL_WIDTH, 0, totalWidth - LABEL_WIDTH, HEADER_HEIGHT);
    ctx.strokeStyle = '#d1d5db';
    ctx.strokeRect(LABEL_WIDTH, 0, totalWidth - LABEL_WIDTH, HEADER_HEIGHT);

    ctx.fillStyle = '#374151';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    for (let day = 0; day <= maxTime; day += 5) {
      const x = LABEL_WIDTH + day * DAY_WIDTH;
      ctx.fillText(`${day}`, x, 20);
      
      ctx.beginPath();
      ctx.strokeStyle = '#e5e7eb';
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEADER_HEIGHT + tasks.length * (TASK_HEIGHT + TASK_MARGIN));
      ctx.stroke();
    }

    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, LABEL_WIDTH, HEADER_HEIGHT);
    ctx.strokeStyle = '#d1d5db';
    ctx.strokeRect(0, 0, LABEL_WIDTH, HEADER_HEIGHT);
    
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Задачи', LABEL_WIDTH / 2, 30);

    tasks.forEach((task, index) => {
      const y = task.y;
      
      ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f9fafb';
      ctx.fillRect(0, y, totalWidth, TASK_HEIGHT);
      
      ctx.strokeStyle = '#e5e7eb';
      ctx.strokeRect(0, y, totalWidth, TASK_HEIGHT);

      ctx.fillStyle = '#374151';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      const taskName = task.name.length > 20 ? task.name.substring(0, 20) + '...' : task.name;
      ctx.fillText(`${task.id}: ${taskName}`, 5, y + 20);

      if (task.slack > 0) {
        const slackX = LABEL_WIDTH + task.currentStart * DAY_WIDTH;
        const slackWidth = (task.currentDuration + task.slack) * DAY_WIDTH;
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(slackX, y + 5, slackWidth, TASK_HEIGHT - 10);
      }

      const taskX = LABEL_WIDTH + task.currentStart * DAY_WIDTH;
      const taskWidth = task.currentDuration * DAY_WIDTH;
      
      if (task.isCritical) {
        ctx.fillStyle = '#dc2626';
      } else {
        ctx.fillStyle = '#3b82f6';
      }
      
      if (selectedTask && selectedTask.id === task.id) {
        ctx.fillStyle = '#059669';
      }
      
      ctx.fillRect(taskX, y + 5, taskWidth, TASK_HEIGHT - 10);
      
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(taskX, y + 5, taskWidth, TASK_HEIGHT - 10);

      if (taskWidth > 40) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${task.currentDuration}д`, taskX + taskWidth / 2, y + 20);
      }

      if (selectedTask && selectedTask.id === task.id) {
        ctx.fillStyle = '#059669';
        ctx.fillRect(taskX - 3, y + 2, 6, TASK_HEIGHT - 4);
        
        ctx.fillRect(taskX + taskWidth - 3, y + 2, 6, TASK_HEIGHT - 4);
      }
    });

    const legendY = HEADER_HEIGHT + tasks.length * (TASK_HEIGHT + TASK_MARGIN) + 20;
    ctx.fillStyle = '#374151';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Легенда:', 10, legendY);
    
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(10, legendY + 10, 20, 15);
    ctx.fillStyle = '#374151';
    ctx.fillText('Критические работы', 40, legendY + 22);
    
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(10, legendY + 35, 20, 15);
    ctx.fillStyle = '#374151';
    ctx.fillText('Обычные работы', 40, legendY + 47);
    
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(200, legendY + 10, 20, 15);
    ctx.strokeStyle = '#d1d5db';
    ctx.strokeRect(200, legendY + 10, 20, 15);
    ctx.fillStyle = '#374151';
    ctx.fillText('Резерв времени', 230, legendY + 22);

    ctx.restore();
  }, [tasks, scale, offset, selectedTask]);

  useEffect(() => {
    drawGanttChart();
  }, [drawGanttChart]);

  const getDragMode = (x, y, task) => {
    const taskX = LABEL_WIDTH + task.currentStart * DAY_WIDTH;
    const taskWidth = task.currentDuration * DAY_WIDTH;
    const taskY = task.y;

    if (y >= taskY + 5 && y <= taskY + TASK_HEIGHT - 5) {
      if (x >= taskX - 5 && x <= taskX + 5) {
        return 'resize-start';
      } else if (x >= taskX + taskWidth - 5 && x <= taskX + taskWidth + 5) {
        return 'resize-end';
      } else if (x >= taskX && x <= taskX + taskWidth) {
        return 'move';
      }
    }
    return null;
  };

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x * scale) / scale;
    const y = (e.clientY - rect.top - offset.y * scale) / scale;

    const clickedTask = tasks.find(task => {
      const taskX = LABEL_WIDTH + task.currentStart * DAY_WIDTH;
      const taskWidth = task.currentDuration * DAY_WIDTH;
      const taskY = task.y;
      
      return x >= taskX && x <= taskX + taskWidth &&
             y >= taskY + 5 && y <= taskY + TASK_HEIGHT - 5;
    });

    if (clickedTask) {
      setSelectedTask(clickedTask);
      const mode = getDragMode(x, y, clickedTask);
      if (mode) {
        setDragMode(mode);
        setIsDragging(true);
        setDragStart({ 
          x: x - (mode === 'move' ? clickedTask.currentStart * DAY_WIDTH : 0), 
          y: y - clickedTask.y 
        });
      }
    } else {
      setSelectedTask(null);
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !selectedTask) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x * scale) / scale;
    const y = (e.clientY - rect.top - offset.y * scale) / scale;

    const updatedTasks = tasks.map(task => {
      if (task.id === selectedTask.id) {
        if (dragMode === 'move') {
          const newStart = Math.max(0, (x - LABEL_WIDTH - dragStart.x) / DAY_WIDTH);
          const maxStart = selectedTask.originalStart + selectedTask.slack;
          return { 
            ...task, 
            currentStart: Math.min(newStart, maxStart)
          };
        } else if (dragMode === 'resize-start') {
          const newStart = Math.max(0, (x - LABEL_WIDTH) / DAY_WIDTH);
          const maxStart = task.currentStart + task.currentDuration - 1;
          const clampedStart = Math.min(newStart, maxStart);
          const newDuration = task.currentDuration + (task.currentStart - clampedStart);
          return { 
            ...task, 
            currentStart: clampedStart,
            currentDuration: Math.max(1, newDuration)
          };
        } else if (dragMode === 'resize-end') {
          const newEnd = Math.max(task.currentStart + 1, (x - LABEL_WIDTH) / DAY_WIDTH);
          return { 
            ...task, 
            currentDuration: newEnd - task.currentStart
          };
        }
      }
      return task;
    });
    
    setTasks(updatedTasks);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragMode('move');
  };

  const handleZoomIn = () => setScale(prev => Math.min(prev * 1.2, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev / 1.2, 0.3));
  const handleReset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    const resetTasks = tasks.map(task => ({
      ...task,
      currentStart: task.originalStart,
      currentDuration: task.originalDuration
    }));
    setTasks(resetTasks);
  };

  const handleSave = () => {
    if (onUpdateTasks) {
      const updatedTasks = tasks.map(task => ({
        ...task,
        earlyStart: task.currentStart,
        duration: task.currentDuration
      }));
      onUpdateTasks(updatedTasks);
    }
  };

  const handleEditTask = () => {
    if (selectedTask) {
      setEditingTask({ ...selectedTask });
    }
  };

  const handleSaveEdit = () => {
    if (editingTask) {
      const updatedTasks = tasks.map(task =>
        task.id === editingTask.id 
          ? { ...task, currentDuration: parseFloat(editingTask.currentDuration) || 1 }
          : task
      );
      setTasks(updatedTasks);
      setEditingTask(null);
    }
  };

  if (!results || !results.tasks || results.tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Интерактивная диаграмма Ганта
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">
            Выполните расчет параметров для создания интерактивной диаграммы Ганта
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Интерактивная диаграмма Ганта
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Панель инструментов */}
          <div className="flex flex-wrap gap-2 mb-4 p-2 bg-gray-50 rounded-lg">
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Сброс
            </Button>
            
            <div className="border-l mx-2"></div>
            
            {selectedTask && (
              <Button variant="outline" size="sm" onClick={handleEditTask}>
                <Edit className="h-4 w-4 mr-1" />
                Редактировать
              </Button>
            )}
            
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-1" />
              Сохранить
            </Button>
          </div>

          {/* Статус */}
          <div className="flex items-center gap-4 mb-4 text-sm">
            <span>Масштаб: {Math.round(scale * 100)}%</span>
            {selectedTask && (
              <span>Выбрана: <Badge variant="outline">{selectedTask.id}</Badge></span>
            )}
            {isDragging && (
              <span className="text-blue-600">
                Режим: {dragMode === 'move' ? 'Перемещение' : 
                       dragMode === 'resize-start' ? 'Изменение начала' : 
                       'Изменение окончания'}
              </span>
            )}
          </div>

          {/* Холст */}
          <div className="border rounded-lg overflow-auto">
            <canvas
              ref={canvasRef}
              width={1000}
              height={Math.max(400, HEADER_HEIGHT + tasks.length * (TASK_HEIGHT + TASK_MARGIN) + 100)}
              className="cursor-pointer"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>

          {/* Инструкции */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Управление:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div>• <strong>Перемещение:</strong> Перетащите полосу задачи в пределах резерва</div>
              <div>• <strong>Изменение длительности:</strong> Потяните за края полосы</div>
              <div>• <strong>Выбор:</strong> Кликните на полосу задачи</div>
              <div>• <strong>Масштаб:</strong> Используйте кнопки + и -</div>
            </div>
          </div>

          {/* Информация о выбранной задаче */}
          {selectedTask && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg">Свойства задачи</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div><strong>ID:</strong> {selectedTask.id}</div>
                <div><strong>Название:</strong> {selectedTask.name}</div>
                <div><strong>Оригинальная длительность:</strong> {selectedTask.originalDuration} дн.</div>
                <div><strong>Текущая длительность:</strong> {selectedTask.currentDuration.toFixed(1)} дн.</div>
                <div><strong>Оригинальное начало:</strong> {selectedTask.originalStart.toFixed(1)} дн.</div>
                <div><strong>Текущее начало:</strong> {selectedTask.currentStart.toFixed(1)} дн.</div>
                <div><strong>Резерв времени:</strong> {selectedTask.slack.toFixed(1)} дн.</div>
                <div><strong>Критический путь:</strong> {selectedTask.isCritical ? 'Да' : 'Нет'}</div>
              </CardContent>
            </Card>
          )}

          {/* Диалог редактирования */}
          {editingTask && (
            <Card className="mt-4 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg">Редактирование задачи {editingTask.id}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="edit-duration">Длительность (дни)</Label>
                  <Input
                    id="edit-duration"
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={editingTask.currentDuration}
                    onChange={(e) => setEditingTask({
                      ...editingTask,
                      currentDuration: e.target.value
                    })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveEdit}>Сохранить</Button>
                  <Button variant="outline" onClick={() => setEditingTask(null)}>
                    Отмена
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DragDropGanttChart;

