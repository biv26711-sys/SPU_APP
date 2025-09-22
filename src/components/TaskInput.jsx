import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Edit } from 'lucide-react';
import { createTask } from '../types/index.js';
import TaskNameSuggest from './TaskNameSuggest'; // новое

const HOURS_PER_DAY = 6; // новое
// новое
function computeDurationDays(laborHours, performers, hoursPerDay = HOURS_PER_DAY) {
  const perf = Math.max(1, parseInt(performers) || 1);
  const hours = Math.max(0, parseFloat(laborHours) || 0);
  return Math.max(1, Math.ceil(hours / (hoursPerDay * perf)));
}

const TaskInput = ({ tasks, onTasksChange }) => {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    duration: '',
    laborIntensity: '',
    numberOfPerformers: '1', // новое
    predecessors: ''
  });
  const [editingTask, setEditingTask] = useState(null);
  const [missingReq, setMissingReq] = useState([]); // новое

  // много нового
  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };

      if (field === 'numberOfPerformers' && next.laborIntensity) {
        const laborHours = parseFloat(next.laborIntensity) || 0;
        next.duration = String(computeDurationDays(laborHours, value));
      }

      if (field === 'laborIntensity') {
        const laborHours = parseFloat(value) || 0;
        next.duration = String(computeDurationDays(laborHours, next.numberOfPerformers));
      }

      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.id || !formData.name || !formData.duration || !formData.numberOfPerformers) {
      // Use a more user-friendly error display instead of alert
      setMissingReq([{ name: 'Пожалуйста, заполните все обязательные поля' }]);
      return;
    }

    const predecessors = formData.predecessors
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const newTask = createTask(
      formData.id,
      formData.name,
      parseFloat(formData.duration),
      parseFloat(formData.laborIntensity) || parseFloat(formData.duration),
      parseInt(formData.numberOfPerformers),
      predecessors
    );

    if (editingTask) {
      const updatedTasks = tasks.map(task =>
        task.id === editingTask.id ? newTask : task
      );
      onTasksChange(updatedTasks);
      setEditingTask(null);
    } else {
      if (tasks.some(task => task.id === formData.id)) {
        setMissingReq([{ name: 'Работа с таким ID уже существует' }]);
        return;
      }
      onTasksChange([...tasks, newTask]);
    }

    setFormData({
      id: '',
      name: '',
      duration: '',
      laborIntensity: '',
      numberOfPerformers: '1',
      predecessors: ''
    });
    setMissingReq([]);
  };

  const handleEdit = (task) => {
    setFormData({
      id: task.id,
      name: task.name,
      duration: task.duration.toString(),
      laborIntensity: task.laborIntensity.toString(),
      numberOfPerformers: task.numberOfPerformers.toString(),
      predecessors: task.predecessors.join(', ')
    });
    setEditingTask(task);
    setMissingReq([]); // новое
  };

  const handleDelete = (taskId) => {
    if (confirm('Вы уверены, что хотите удалить эту задачу?')) {
      const updatedTasks = tasks.filter(task => task.id !== taskId);
      onTasksChange(updatedTasks);
    }
  };

  const cancelEdit = () => {
    setEditingTask(null);
    setFormData({
      id: '',
      name: '',
      duration: '',
      laborIntensity: '',
      numberOfPerformers: '1', // новое
      predecessors: ''
    });
    setMissingReq([]); // новое
  };

  return (
    <div className="space-y-6">
      {/* Форма ввода */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {editingTask ? 'Редактировать работу' : 'Добавить работу'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="id">ID работы *</Label>
              <Input
                id="id"
                value={formData.id}
                onChange={(e) => handleInputChange('id', e.target.value)}
                placeholder="1-2"
                disabled={editingTask !== null}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Название *</Label>
              {/* новое - иаменили обычный Input на автодополнение из БД */}
              <TaskNameSuggest
                value={formData.name}
                onSelect={({ template, required }) => {
                  // новое 
                  const laborHours = typeof template?.base_duration_minutes === 'number'
                    ? Math.ceil(template.base_duration_minutes / 60)
                    : null;

                  // новое
                  const durationDays = laborHours != null
                    ? String(computeDurationDays(laborHours, formData.numberOfPerformers))
                    : formData.duration;

                  setFormData(f => ({
                    ...f,
                    id: String(template?.id ?? f.id),
                    name: template?.name ?? f.name,
                    laborIntensity: laborHours != null ? String(laborHours) : f.laborIntensity,
                    duration: durationDays,
                  }));

                  setMissingReq(required || []);
                }}
              />
            </div>

            {/* новое - предупреждение про обязательных предшественников */}
            {missingReq.length > 0 && (
              <div className="md:col-span-2 lg:col-span-3">
                <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm">
                  <div>
                    Для выбранной работы требуется добавить предшественников:&nbsp;
                    <b>{missingReq.map(x => x.name ?? x.code ?? String(x.id)).join(', ')}</b>
                  </div>

                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        // новое -  в поле подставляем именно ID предшественников
                        const list = missingReq.map(x => String(x.id));
                        setFormData(f => ({ ...f, predecessors: list.join(', ') }));
                      }}
                    >
                      Подставить в поле «Предшественники»
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setMissingReq([])}
                    >
                      Скрыть
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="duration">Продолжительность (дни) *</Label>
              <Input
                id="duration"
                type="number"
                step="0.1"
                min="0.1"
                value={formData.duration}
                onChange={(e) => handleInputChange('duration', e.target.value)}
                placeholder="10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="laborIntensity">Трудоемкость (н-ч)</Label>
              <Input
                id="laborIntensity"
                type="number"
                step="0.1"
                min="0"
                value={formData.laborIntensity}
                onChange={(e) => handleInputChange('laborIntensity', e.target.value)}
                placeholder="80"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numberOfPerformers">Количество исполнителей *</Label>
              <Input
                id="numberOfPerformers"
                type="number"
                min="1"
                value={formData.numberOfPerformers}
                onChange={(e) => handleInputChange('numberOfPerformers', e.target.value)}
                placeholder="2"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="predecessors">Предшественники</Label>
              <Input
                id="predecessors"
                value={formData.predecessors}
                onChange={(e) => handleInputChange('predecessors', e.target.value)}
                placeholder="1-2, 1-3"
              />
            </div>

            <div className="flex gap-2 md:col-span-2 lg:col-span-3">
              <Button type="submit" className="flex-1">
                {editingTask ? 'Сохранить изменения' : 'Добавить работу'}
              </Button>
              {editingTask && (
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  Отмена
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Список задач */}
      <Card>
        <CardHeader>
          <CardTitle>Список работ ({tasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Работы не добавлены. Используйте форму выше для добавления работ.
            </p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{task.id}</Badge>
                      <h3 className="font-medium">{task.name}</h3>
                      {task.isCritical && (
                        <Badge variant="destructive">Критический путь</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-2">
                      <span>Длительность: {task.duration} дн.</span>
                      <span>Трудоемкость: {task.laborIntensity} н-ч</span>
                      <span>Исполнители: {task.numberOfPerformers} чел.</span>
                      <span>Предшественники: {task.predecessors.length > 0 ? task.predecessors.join(', ') : 'нет'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(task)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(task.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TaskInput;
