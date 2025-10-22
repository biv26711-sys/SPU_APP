import { Checkbox } from "@/components/ui/checkbox";
import { Check, X } from 'lucide-react';
import { Infinity as InfinityIcon, TriangleAlert } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Edit } from 'lucide-react';
import { createTask } from '../types/index.js';
import TaskNameSuggest from './TaskNameSuggest';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";



const HOURS_PER_DAY = 6;

function computeDurationDays(laborHours, performers, hoursPerDay = HOURS_PER_DAY) {
  const perf = Math.max(1, parseInt(performers) || 1);
  const hours = Math.max(0, parseFloat(laborHours) || 0);
  const d = hours / (hoursPerDay * perf);
  return Math.max(0.1, Math.ceil(d * 10) / 10); 
}

const TaskInput = ({ tasks, onTasksChange, resourceLimit, onResourceLimitChange, isLimitExceeded, maxPerformers, lastNumericLimit, onLastNumericLimitChange  }) => {
 const [localResourceLimit, setLocalResourceLimit] = useState(resourceLimit);
  const [isConfirmModalOpen, setConfirmModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    duration: '',
    laborIntensity: '',
    numberOfPerformers: '1',
    predecessors: ''
  });
  useEffect(() => {
  setLocalResourceLimit(resourceLimit);
}, [resourceLimit]);

  const [editingTask, setEditingTask] = useState(null);

  const [missingReq, setMissingReq] = useState([]); 
  const [formError, setFormError] = useState(''); 

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

    if (field === 'id' || field === 'name') setMissingReq([]); 
    setFormError(''); 
  };

  const handleNameText = (text) => { 
    setFormData(f => ({ ...f, name: text })); 
    setMissingReq([]); 
    setFormError(''); 
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (
      !String(formData.id).trim() || 
      !String(formData.name).trim() || 
      !String(formData.duration).trim() || 
      !String(formData.numberOfPerformers).trim() 
    ) {
      setFormError('Пожалуйста, заполните все обязательные поля'); 
      return;
    }

    const predecessors = formData.predecessors
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);

    const newTask = createTask(
      formData.id,
      formData.name,
      parseFloat(formData.duration),
      (formData.laborIntensity !== '' ? parseFloat(formData.laborIntensity) : null),
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
        setFormError('Работа с таким ID уже существует');
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
    setFormError(''); 
  };

  const handleEdit = (task) => {
    setFormData({
      id: task.id,
      name: task.name,
      duration: String(task.duration),
      laborIntensity: String(task.laborIntensity ?? ''),
      numberOfPerformers: String(task.numberOfPerformers),
      predecessors: task.predecessors.join(', ')
    });
    setEditingTask(task);
    setMissingReq([]);
    setFormError(''); 
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
      numberOfPerformers: '1',
      predecessors: ''
    });
    setMissingReq([]);
    setFormError(''); 
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      <Card>
          <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Список работ ({tasks.length})</CardTitle>
          
          <div className="flex min-h-[28px] items-center gap-2 text-sm">
            <span className="text-muted-foreground">Пиковая загрузка:</span>

            {resourceLimit === Infinity ? (

             <div className="flex items-center gap-1.5 font-bold text-green-600">
            <span>{maxPerformers}</span>
            <span className="text-muted-foreground">/</span>
            <InfinityIcon className="h-4 w-4 stroke-[2.5]" title="Безлимитные ресурсы" />
          </div>
            ) : (

              <span className={`font-bold ${isLimitExceeded ? 'text-red-500' : 'text-green-600'}`}>
                {maxPerformers} / {resourceLimit}
              </span>
            )}

            {isLimitExceeded && resourceLimit !== Infinity && (
              <span title="Максимальное число исполнителей на одной из задач превышает лимит">
                  <TriangleAlert className="h-4 w-4 text-amber-500" />
              </span>
            )}
          </div>
        </div>
      </CardHeader>  
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Работы не добавлены. Используйте форму справа для добавления работ.
            </p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
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
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>Длительность: {task.duration} дн.</div>
                      <div>Трудоемкость: {task.laborIntensity} н-ч</div>
                      <div>Исполнители: {task.numberOfPerformers} чел.</div>
                      <div>Предшественники: {task.predecessors.length > 0 ? task.predecessors.join(', ') : 'нет'}</div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
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


      <Card>
         <CardHeader>
  <div className="flex items-center justify-between">
    <CardTitle className="flex items-center gap-2">
      <Plus className="h-5 w-5" />
      {editingTask ? 'Редактировать работу' : 'Добавить работу'}
    </CardTitle>
    
            <div className="flex items-center gap-4">
  <Label className="text-sm text-muted-foreground">
    Лимит исполнителей:
  </Label>

  <Button
    variant={resourceLimit === Infinity ? "secondary" : "outline"}
    size="sm"
    onClick={() => {
      if (resourceLimit === Infinity) {
        onResourceLimitChange(lastNumericLimit);
      } else {
        onLastNumericLimitChange(localResourceLimit);
        onResourceLimitChange(Infinity);
      }
    }}
    className="w-[110px] flex items-center gap-2"
  >
    <InfinityIcon className="h-4 w-4" />
    Безлимит
  </Button>

  <div className="w-[150px]">
    {resourceLimit !== Infinity && (
      <div className="flex items-center gap-2">
        <Input
          id="resourceLimit"
          type="number"
          value={localResourceLimit}
          onChange={(e) => setLocalResourceLimit(Number(e.target.value) > 0 ? Number(e.target.value) : 1)}
          className="h-8 w-16"
          min="1"
        />
        
        {localResourceLimit !== resourceLimit && (
          <div className="flex items-center">
            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:bg-accent" onClick={() => setConfirmModalOpen(true)} title="Применить">
              <Check className="h-5 w-5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-accent" onClick={() => setLocalResourceLimit(resourceLimit)} title="Отмена">
              <X className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    )}
  </div>
</div>
  </div>
</CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <TaskNameSuggest
                value={formData.name}
                
                onChange={handleNameText} 
                onInputChange={handleNameText} 
                onTextChange={handleNameText} 

                onSelect={({ template, required }) => {
                  const laborHours = typeof template?.base_duration_minutes === 'number'
                    ? Math.ceil((template.base_duration_minutes / 60) * 10) / 10
                    : null;

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

                  const norm = Array.isArray(required) 
                    ? required 
                        .map(x => (x && typeof x === 'object') ? x : { code: String(x) }) 
                        .filter(x => x.id != null || x.code || x.name) 
                    : [];
                  setMissingReq(norm); 
                  setFormError(''); 
                }}
              />
            </div>

    
            {formError && ( 
              <div className="rounded-md border border-red-300 bg-red-50 p-2 text-sm">
                {formError}
              </div>
            )}

            {missingReq.length > 0 && (
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
                      const list = missingReq
                        .map(x => x?.id ?? x?.code ?? x?.name) 
                        .filter(Boolean) 
                        .map(String); 
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

            <div className="flex gap-2">
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
      {isConfirmModalOpen && (
  <AlertDialog open onOpenChange={setConfirmModalOpen}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Подтвердите изменение</AlertDialogTitle>
        <AlertDialogDescription>
          Вы уверены, что хотите изменить лимит исполнителей с {resourceLimit} на {localResourceLimit}? 
          Это изменение повлияет на расчеты всего проекта.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={() => setLocalResourceLimit(resourceLimit)}>Отмена</AlertDialogCancel>
        <AlertDialogAction 
          onClick={() => {
            onResourceLimitChange(localResourceLimit);
            setConfirmModalOpen(false);
          }}
        >
          Да, изменить
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)}
    </div>
  );
};

export default TaskInput;