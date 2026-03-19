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
import { calcDurationDays, calcLaborHours } from '../utils/time.js';
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

const EDGE_ID_PATTERN = /^\d+-\d+$/;
const NUMERIC_ID_PATTERN = /^\d+$/;

const parseEdgeNodes = (edgeId) => {
  const value = String(edgeId ?? '').trim();
  const match = value.match(/^(\d+)-(\d+)$/);
  if (!match) return null;
  return { from: match[1], to: match[2] };
};



const TaskInput = ({
  tasks,
  onTasksChange,
  projectMode = 'auto_aoa',
  autoModeUnlocked = false,
  onProjectModeChange,
  resourceLimit,
  onResourceLimitChange,
  isLimitExceeded,
  maxPerformers,
  lastNumericLimit,
  onLastNumericLimitChange,
  hoursPerDay,
  onHoursPerDayChange,
  calculatedEdgeIdByTaskId = {},
  showCalculatedEdgeIds = false,
}) => {
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
  const formPerformersRaw = parseInt(formData.numberOfPerformers, 10);
  const isDummyFormMode = Number.isFinite(formPerformersRaw) && formPerformersRaw === 0;
  const [predecessorSelections, setPredecessorSelections] = useState(['']);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  useEffect(() => {
    setLocalResourceLimit(resourceLimit);
  }, [resourceLimit]);

  useEffect(() => {
    if (isDummyFormMode) return;
    if (!String(formData.laborIntensity ?? '').trim()) return;
    const laborHours = parseFloat(formData.laborIntensity) || 0;
    const duration = calcDurationDays(laborHours, formData.numberOfPerformers, hoursPerDay);
    if (Number.isFinite(duration)) {
      setFormData(prev => ({ ...prev, duration: String(duration) }));
    }
  }, [hoursPerDay, formData.laborIntensity, formData.numberOfPerformers, isDummyFormMode]);

  const [editingTask, setEditingTask] = useState(null);

  const [missingReq, setMissingReq] = useState([]); 
  const [formError, setFormError] = useState(''); 
  const existingTaskIds = new Set(
    (Array.isArray(tasks) ? tasks : [])
      .map(task => String(task?.id ?? '').trim())
      .filter(Boolean)
  );

  const detectTaskIdKind = (value) => {
    const id = String(value ?? '').trim();
    if (!id) return 'empty';
    if (EDGE_ID_PATTERN.test(id)) return 'edge';
    if (NUMERIC_ID_PATTERN.test(id)) return 'numeric';
    return 'invalid';
  };

  const getTaskListIdMode = (tasksList) => {
    let hasEdge = false;
    let hasNumeric = false;
    const invalidIds = [];

    (Array.isArray(tasksList) ? tasksList : []).forEach((task) => {
      const id = String(task?.id ?? '').trim();
      const kind = detectTaskIdKind(id);
      if (kind === 'edge') hasEdge = true;
      else if (kind === 'numeric') hasNumeric = true;
      else if (kind === 'invalid') invalidIds.push(id);
    });

    if (invalidIds.length > 0) {
      return { mode: 'invalid', invalidIds: Array.from(new Set(invalidIds)) };
    }
    if (hasEdge && hasNumeric) return { mode: 'mixed', invalidIds: [] };
    if (hasEdge) return { mode: 'edge', invalidIds: [] };
    if (hasNumeric) return { mode: 'numeric', invalidIds: [] };
    return { mode: 'empty', invalidIds: [] };
  };

  const taskListIdModeInfo = getTaskListIdMode(tasks);
  const isPostCalculationMode = Boolean(showCalculatedEdgeIds);
  const isAutoMode = projectMode === 'auto_aoa';
  const isManualMode = projectMode === 'manual_aoa';
  const isModeSelectionLocked = Array.isArray(tasks) && tasks.length > 0;
  const hasStoredNumericTasks = (Array.isArray(tasks) ? tasks : []).some(task => detectTaskIdKind(task?.id) === 'numeric');
  const hasStoredEdgeTasks = (Array.isArray(tasks) ? tasks : []).some(task => detectTaskIdKind(task?.id) === 'edge');
  const isAutoGraphBindingLocked = isAutoMode && autoModeUnlocked && hasStoredNumericTasks && hasStoredEdgeTasks;
  const currentTaskId = String(formData.id || '').trim();
  const isEditingLockedNumericTask = Boolean(editingTask) && isAutoGraphBindingLocked && detectTaskIdKind(editingTask?.id) === 'numeric';
  const editingTaskIndex = editingTask
    ? tasks.findIndex(task => String(task?.id) === String(editingTask.id))
    : -1;
  const availablePredecessorOptions = tasks
    .map((task, index) => ({
      id: String(task?.id ?? '').trim(),
      name: String(task?.name ?? ''),
      index
    }))
    .filter(task => {
      if (!task.id) return false;
      if (task.id === currentTaskId) return false;
      if (editingTaskIndex >= 0) {
        return task.index < editingTaskIndex;
      }
      return true;
    });
  const availablePredecessorIdSet = new Set(availablePredecessorOptions.map(task => task.id));
  const MAX_PREDECESSORS = 4;
  const isTaskIdentityReady = Boolean(String(formData.id || '').trim() && String(formData.name || '').trim());
  const sliderProgress = Math.max(0, Math.min(100, ((Number(hoursPerDay) - 1) / 23) * 100));
  const selectedPredecessors = predecessorSelections
    .map(value => String(value || '').trim())
    .filter(Boolean);
  const hasEmptyPredecessorSelection = predecessorSelections.some(value => !String(value || '').trim());
  const canAddPredecessorRow = !hasEmptyPredecessorSelection &&
    predecessorSelections.length < MAX_PREDECESSORS &&
    selectedPredecessors.length < MAX_PREDECESSORS &&
    availablePredecessorOptions.some(task => !selectedPredecessors.includes(task.id));
  const getVisiblePredecessors = (task) => {
    const taskId = String(task?.id ?? '').trim();
    const preds = Array.isArray(task?.predecessors) ? task.predecessors : [];
    return Array.from(
      new Set(
        preds
          .map(pred => String(pred ?? '').trim())
          .filter(predId => predId && predId !== taskId && existingTaskIds.has(predId))
      )
    );
  };

  const handleHoursPerDayChange = (value) => {
    const num = parseFloat(value);
    if (!Number.isFinite(num)) return;
    const next = Math.min(24, Math.max(1, num));
    onHoursPerDayChange(next);
  };

  const toNaturalInt = (value) => {
    const text = String(value ?? '').trim();
    if (!/^\d+$/.test(text)) return null;
    const n = Number(text);
    if (!Number.isInteger(n) || n <= 0) return null;
    return n;
  };

  const normalizeTaskPredecessors = (task) => {
    if (Array.isArray(task?.predecessors)) {
      return task.predecessors.map(p => String(p ?? '').trim()).filter(Boolean);
    }
    if (typeof task?.predecessors === 'string' && task.predecessors.trim()) {
      return task.predecessors
        .split(',')
        .map(p => String(p ?? '').trim())
        .filter(Boolean);
    }
    return [];
  };

  const areSamePredecessorSets = (left, right) => {
    const leftNorm = Array.from(new Set((Array.isArray(left) ? left : []).map(value => String(value ?? '').trim()).filter(Boolean))).sort();
    const rightNorm = Array.from(new Set((Array.isArray(right) ? right : []).map(value => String(value ?? '').trim()).filter(Boolean))).sort();
    if (leftNorm.length !== rightNorm.length) return false;
    return leftNorm.every((value, index) => value === rightNorm[index]);
  };

  const shiftTaskIdsForInsertion = (tasksList, insertId) => {
    return (Array.isArray(tasksList) ? tasksList : []).map(task => {
      const currentIdText = String(task?.id ?? '').trim();
      const currentIdNum = toNaturalInt(currentIdText);
      const nextId = Number.isInteger(currentIdNum) && currentIdNum >= insertId
        ? String(currentIdNum + 1)
        : currentIdText;

      const nextPreds = normalizeTaskPredecessors(task).map(predId => {
        const predNum = toNaturalInt(predId);
        if (!Number.isInteger(predNum) || predNum < insertId) return predId;
        return String(predNum + 1);
      });

      return {
        ...task,
        id: nextId,
        predecessors: nextPreds,
        predecessorBindingMode: 'manual',
      };
    });
  };

  const shiftTaskIdsForDeletion = (tasksList, deletedId) => {
    return (Array.isArray(tasksList) ? tasksList : []).map(task => {
      const currentIdText = String(task?.id ?? '').trim();
      const currentIdNum = toNaturalInt(currentIdText);
      const nextId = Number.isInteger(currentIdNum) && currentIdNum > deletedId
        ? String(currentIdNum - 1)
        : currentIdText;

      const nextPreds = Array.from(
        new Set(
          normalizeTaskPredecessors(task)
            .map(predId => {
              const predNum = toNaturalInt(predId);
              if (!Number.isInteger(predNum)) return predId;
              if (predNum === deletedId) return null;
              if (predNum > deletedId) return String(predNum - 1);
              return predId;
            })
            .filter(Boolean)
        )
      );

      return {
        ...task,
        id: nextId,
        predecessors: nextPreds,
        predecessorBindingMode: 'manual',
      };
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      const parsedPerformers = parseInt(next.numberOfPerformers, 10);
      const isDummyByPerformers = Number.isFinite(parsedPerformers) && parsedPerformers === 0;

      if (field === 'numberOfPerformers') {
        if (isDummyByPerformers) {
          next.laborIntensity = '0';
        } else if (String(next.laborIntensity ?? '').trim()) {
          const laborHours = parseFloat(next.laborIntensity) || 0;
          next.duration = String(calcDurationDays(laborHours, next.numberOfPerformers, hoursPerDay));
        } else if (String(next.duration ?? '').trim()) {
          const durationDays = parseFloat(next.duration) || 0;
          const laborHours = calcLaborHours(durationDays, next.numberOfPerformers, hoursPerDay);
          next.laborIntensity = String(laborHours);
        }
      }

      if (field === 'laborIntensity') {
        if (isDummyByPerformers) {
          next.laborIntensity = '0';
        } else {
          const laborHours = parseFloat(value) || 0;
          next.duration = String(calcDurationDays(laborHours, next.numberOfPerformers, hoursPerDay));
        }
      }

      if (field === 'duration') {
        if (isDummyByPerformers) {
          next.laborIntensity = '0';
        } else {
          const durationDays = parseFloat(value) || 0;
          const laborHours = calcLaborHours(durationDays, next.numberOfPerformers, hoursPerDay);
          next.laborIntensity = String(laborHours);
        }
      }

      return next;
    });

    if (field === 'id' || field === 'name') setMissingReq([]); 
    if (field === 'id') {
      const nextId = String(value || '').trim();
      if (nextId !== String(selectedTemplateId || '').trim()) {
        setSelectedTemplateId('');
      }
    }
    setFormError(''); 
  };

  const handleNameText = (text) => { 
    setFormData(f => ({ ...f, name: text })); 
    setSelectedTemplateId('');
    setMissingReq([]); 
    setFormError(''); 
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (
      !String(formData.id).trim() || 
      !String(formData.name).trim() || 
      !String(formData.numberOfPerformers).trim() 
    ) {
      setFormError('Пожалуйста, заполните обязательные поля: ID, название и количество исполнителей.'); 
      return;
    }

    const enteredTaskId = editingTask
      ? String(editingTask?.id ?? '').trim()
      : String(formData.id ?? '').trim();
    const enteredTaskIdKind = detectTaskIdKind(enteredTaskId);
    if (enteredTaskIdKind === 'invalid') {
      setFormError('ID работы должен быть в формате "N" или "N-M" (например, "3" или "1-2").');
      return;
    }
    if (!editingTask && taskListIdModeInfo.mode === 'invalid') {
      setFormError(`Обнаружены некорректные ID: ${taskListIdModeInfo.invalidIds.join(', ')}`);
      return;
    }
    if (!editingTask && isManualMode && enteredTaskIdKind !== 'edge') {
      setFormError('В ручном режиме доступны только ID вида "N-M", например "1-2".');
      return;
    }
    if (!editingTask && isAutoMode && !autoModeUnlocked && enteredTaskIdKind !== 'numeric') {
      setFormError('В авто-режиме до первого расчета доступны только ID вида "N", например "3".');
      return;
    }
    if (!editingTask && isAutoGraphBindingLocked && enteredTaskIdKind === 'numeric') {
      setFormError('В авто-режиме после добавления ручных дуг N-M нельзя добавлять новые числовые работы. Сначала удалите ручные дуги N-M, если хотите перестроить основу графа.');
      return;
    }

    const performersRaw = parseInt(formData.numberOfPerformers, 10);
    if (!Number.isFinite(performersRaw) || performersRaw < 0) {
      setFormError('Количество исполнителей должно быть целым числом не меньше 0.');
      return;
    }
    const performers = performersRaw;
    const isDummyTask = performers === 0;

    const laborText = String(formData.laborIntensity ?? '').trim();
    const durationText = String(formData.duration ?? '').trim();
    const laborHours = isDummyTask
      ? 0
      : parseFloat(formData.laborIntensity);

    if (isDummyTask) {
      if (!durationText.length) {
        setFormError('Для фиктивной работы укажите продолжительность: 0 или больше.');
        return;
      }
    } else if (!laborText.length) {
      setFormError('Для обычной работы укажите трудоемкость.');
      return;
    }

    if (!isDummyTask && (!Number.isFinite(laborHours) || laborHours <= 0)) {
      setFormError('Для обычной работы трудоемкость должна быть больше 0.');
      return;
    }

    const manualDuration = parseFloat(formData.duration);
    if (isDummyTask) {
      if (!Number.isFinite(manualDuration) || manualDuration < 0) {
        setFormError('Для фиктивной работы продолжительность должна быть числом не меньше 0.');
        return;
      }
    }

    const calculatedDuration = isDummyTask
      ? manualDuration
      : calcDurationDays(laborHours, performers, hoursPerDay);

    if (!isDummyTask && (!Number.isFinite(calculatedDuration) || calculatedDuration <= 0)) {
      setFormError('Не удалось рассчитать продолжительность. Проверьте исходные данные.');
      return;
    }

    const normalizedTemplateId = String(selectedTemplateId || '').trim();

    const predecessors = Array.from(
      new Set(
        predecessorSelections
          .map(p => String(p || '').trim())
          .map(p => p.trim())
          .filter(Boolean)
      )
    );
    const invalidPredecessors = predecessors.filter(predId => !availablePredecessorIdSet.has(predId));
    if (invalidPredecessors.length > 0) {
      setFormError(`Недопустимые предшественники: ${invalidPredecessors.join(', ')}`);
      return;
    }
    if (predecessors.length > MAX_PREDECESSORS) {
      setFormError(`Можно указать не более ${MAX_PREDECESSORS} предшественников.`);
      return;
    }
    if (editingTask && isAutoGraphBindingLocked && enteredTaskIdKind === 'numeric') {
      const existingPreds = normalizeTaskPredecessors(editingTask);
      if (!areSamePredecessorSets(existingPreds, predecessors)) {
        setFormError('После добавления ручных дуг N-M в авто-режиме нельзя менять предшественников числовых работ. Иначе изменится нумерация событий.');
        return;
      }
    }

    if (enteredTaskIdKind === 'edge' && predecessors.length > 0) {
      const currentEdgeNodes = parseEdgeNodes(enteredTaskId);
      if (!currentEdgeNodes) {
        setFormError('Некорректный формат ID дуги.');
        return;
      }

      const unresolvedPreds = [];
      const inconsistentPreds = [];

      predecessors.forEach((predId) => {
        const predKind = detectTaskIdKind(predId);
        const predEdgeId = predKind === 'edge'
          ? predId
          : String(calculatedEdgeIdByTaskId?.[predId] ?? '').trim();
        const predEdgeNodes = parseEdgeNodes(predEdgeId);

        if (!predEdgeNodes) {
          unresolvedPreds.push(predId);
          return;
        }
        if (predEdgeNodes.to !== currentEdgeNodes.from) {
          inconsistentPreds.push(`${predId} (${predEdgeId})`);
        }
      });

      if (unresolvedPreds.length > 0) {
        setFormError(
          `Для дуги ${enteredTaskId} не удалось сопоставить предшественники с форматом N-M: ${unresolvedPreds.join(', ')}. ` +
          'Используйте предшественники в формате N-M или сначала выполните расчет.'
        );
        return;
      }

      if (inconsistentPreds.length > 0) {
        setFormError(
          `Для дуги ${enteredTaskId} каждый предшественник должен оканчиваться в узле ${currentEdgeNodes.from}. ` +
          `Некорректно: ${inconsistentPreds.join(', ')}`
        );
        return;
      }
    }

    const newTask = {
      ...createTask(
      enteredTaskId,
      formData.name,
      calculatedDuration,
      isDummyTask ? 0 : laborHours,
      performers,
      predecessors
      ),
      isDummy: isDummyTask,
      templateId: normalizedTemplateId || null,
    };

    if (editingTask) {
      const updatedTasks = tasks.map(task =>
        String(task?.id ?? '').trim() === enteredTaskId ? newTask : task
      );
      onTasksChange(updatedTasks);
      setEditingTask(null);
    } else {
      const newTaskIdNum = toNaturalInt(enteredTaskId);

      if (Number.isInteger(newTaskIdNum)) {
        const shiftedTasks = shiftTaskIdsForInsertion(tasks, newTaskIdNum);
        const insertIndex = shiftedTasks.findIndex(task => {
          const idNum = toNaturalInt(task?.id);
          return Number.isInteger(idNum) && idNum >= newTaskIdNum;
        });
        const nextTasks = [...shiftedTasks];
        if (insertIndex === -1) {
          nextTasks.push(newTask);
        } else {
          nextTasks.splice(insertIndex, 0, newTask);
        }
        onTasksChange(nextTasks);
      } else {
        if (tasks.some(task => String(task?.id ?? '').trim() === enteredTaskId)) {
          setFormError('Работа с таким ID уже существует');
          return;
        }
        onTasksChange([...tasks, newTask]);
      }
    }

    setFormData({
      id: '',
      name: '',
      duration: '',
      laborIntensity: '',
      numberOfPerformers: '1',
      predecessors: ''
    });
    setPredecessorSelections(['']);
    setSelectedTemplateId('');
    setMissingReq([]);
    setFormError(''); 
  };

  const handleEdit = (task) => {
    const existingPreds = Array.from(
      new Set(
        (Array.isArray(task.predecessors) ? task.predecessors : [])
          .map(p => String(p || '').trim())
          .filter(Boolean)
      )
    );
    setFormData({
      id: task.id,
      name: task.name,
      duration: String(task.duration),
      laborIntensity: String(task.laborIntensity ?? ''),
      numberOfPerformers: String(task.numberOfPerformers),
      predecessors: existingPreds.join(', ')
    });
    setPredecessorSelections(existingPreds.length > 0 ? existingPreds : ['']);
    setSelectedTemplateId(String(task?.templateId ?? ''));
    setEditingTask(task);
    setMissingReq([]);
    setFormError(''); 
  };

  const handleDelete = (taskId) => {
    const deletedTaskId = String(taskId ?? '').trim();
    const deletedTaskNum = toNaturalInt(deletedTaskId);

    if (isAutoGraphBindingLocked && Number.isInteger(deletedTaskNum)) {
      alert('В авто-режиме после добавления ручных дуг N-M нельзя удалять числовые работы. Сначала удалите ручные дуги N-M, если хотите перестроить основу графа.');
      return;
    }

    if (confirm('Вы уверены, что хотите удалить эту задачу?')) {
      const remainingTasks = tasks.filter(task => String(task?.id ?? '').trim() !== deletedTaskId);

      if (Number.isInteger(deletedTaskNum)) {
        onTasksChange(shiftTaskIdsForDeletion(remainingTasks, deletedTaskNum));
      } else {
        onTasksChange(remainingTasks);
      }
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
    setPredecessorSelections(['']);
    setSelectedTemplateId('');
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
            <span className="text-muted-foreground">Макс. исполнителей на одну работу:</span>

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
              {tasks.map((task) => {
                const visiblePredecessors = getVisiblePredecessors(task);
                const taskId = String(task?.id ?? '').trim();
                const calculatedEdgeId = String(calculatedEdgeIdByTaskId?.[taskId] ?? '').trim();
                const shouldShowCalculatedEdgeId = showCalculatedEdgeIds &&
                  calculatedEdgeId &&
                  calculatedEdgeId !== taskId;
                return (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{task.id}</Badge>
                      {shouldShowCalculatedEdgeId && (
                        <Badge variant="secondary" className="bg-sky-50 text-sky-700 border-sky-200">
                          {calculatedEdgeId}
                        </Badge>
                      )}
                      <h3 className="font-medium">{task.name}</h3>
                      {task.isCritical && (
                        <Badge variant="destructive">Критический путь</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>Длительность: {task.duration} (дн.)</div>
                      <div>Трудоемкость: {task.laborIntensity} (н-ч)</div>
                      <div>Исполнители: {task.numberOfPerformers} чел.</div>
                      <div>Предшественники: {visiblePredecessors.length > 0 ? visiblePredecessors.join(', ') : 'нет'}</div>
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
              )})}
            </div>
          )}
        </CardContent>
      </Card>


      <Card>
         <CardHeader>
  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
    <CardTitle className="flex items-center gap-2">
      <Plus className="h-5 w-5" />
      {editingTask ? 'Редактировать работу' : 'Добавить работу'}
    </CardTitle>
    
            <div className="flex items-center gap-3 flex-nowrap">
  <Label className="text-sm text-muted-foreground whitespace-nowrap">
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

  <div className="w-[150px] shrink-0">
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
              <Label htmlFor="hoursPerDay">Рабочий день (часы, глобально для проекта)</Label>
              <div className="flex items-center gap-3">
                <input
                  id="hoursPerDay"
                  type="range"
                  min="1"
                  max="24"
                  step="0.5"
                  value={hoursPerDay}
                  onChange={(e) => handleHoursPerDayChange(e.target.value)}
                  className="w-full hours-per-day-slider"
                  style={{ '--slider-progress': `${sliderProgress}%` }}
                />
                <Input
                  type="number"
                  min="1"
                  max="24"
                  step="0.5"
                  value={hoursPerDay}
                  onChange={(e) => handleHoursPerDayChange(e.target.value)}
                  className="h-8 w-20"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Влияет на расчет всех работ проекта, а не на одну выбранную задачу.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Режим построения графа</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={isAutoMode ? 'default' : 'outline'}
                  onClick={() => onProjectModeChange?.('auto_aoa')}
                  disabled={isModeSelectionLocked}
                >
                  Авто-режим AOA
                </Button>
                <Button
                  type="button"
                  variant={isManualMode ? 'default' : 'outline'}
                  onClick={() => onProjectModeChange?.('manual_aoa')}
                  disabled={isModeSelectionLocked}
                >
                  Ручной режим AOA
                </Button>
                {isAutoMode && autoModeUnlocked && (
                  <Badge variant="secondary">N-M разблокирован</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {isAutoMode
                  ? 'Авто-режим: до первого расчета вводятся работы с ID вида "N". После первого успешного расчета можно добавлять и ID вида "N-M".'
                  : 'Ручной режим: пользователь задает дуги сам, поэтому ввод разрешен только в формате "N-M".'}
              </p>
              {isModeSelectionLocked && (
                <p className="text-xs text-muted-foreground">
                  Режим фиксируется после добавления первой работы. Чтобы изменить режим, очистите список работ.
                </p>
              )}
              {isAutoGraphBindingLocked && (
                <p className="text-xs text-amber-700">
                  К текущему авто-графу уже привязаны ручные дуги N-M. Пока они существуют, нельзя добавлять, удалять или перепривязывать числовые работы, иначе изменится нумерация событий.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="id">ID работы *</Label>
              <Input
                id="id"
                value={formData.id}
                onChange={(e) => handleInputChange('id', e.target.value)}
                placeholder={isManualMode ? '1-2' : autoModeUnlocked ? '3 или 1-2' : '3'}
                disabled={editingTask !== null}
              />
              <p className="text-xs text-muted-foreground">
                {isManualMode
                  ? 'В ручном режиме доступен только формат "N-M", например "1-2".'
                  : autoModeUnlocked
                    ? 'В авто-режиме после первого расчета можно использовать оба формата: "N" и "N-M".'
                    : 'В авто-режиме до первого расчета используйте только формат "N", например "3".'}
              </p>
              {editingTask !== null && (
                <p className="text-xs text-muted-foreground">
                  При редактировании формат и значение ID не меняются.
                </p>
              )}
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

                  const durationDays = isDummyFormMode
                    ? formData.duration
                    : laborHours != null
                      ? String(calcDurationDays(laborHours, formData.numberOfPerformers, hoursPerDay))
                      : formData.duration;

                  setFormData(f => ({
                    ...f,
                    id: isAutoMode ? String(template?.id ?? f.id) : f.id,
                    name: template?.name ?? f.name,
                    laborIntensity: isDummyFormMode ? '0' : (laborHours != null ? String(laborHours) : f.laborIntensity),
                    duration: durationDays,
                  }));
                  setSelectedTemplateId(String(template?.id ?? ''));

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
                      const list = Array.from(new Set(
                        missingReq
                          .map(x => x?.id ?? x?.code ?? x?.name)
                          .filter(Boolean)
                          .map(String)
                          .map(x => x.trim())
                          .filter(Boolean)
                      ));
                      const filtered = list.filter(id => availablePredecessorIdSet.has(id));
                      const limited = filtered.slice(0, MAX_PREDECESSORS);
                      setPredecessorSelections(limited.length > 0 ? limited : ['']);
                      setFormData(f => ({ ...f, predecessors: limited.join(', ') }));
                      if (filtered.length > MAX_PREDECESSORS) {
                        setFormError(`Можно указать не более ${MAX_PREDECESSORS} предшественников.`);
                      } else {
                        setFormError('');
                      }
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
              <Label htmlFor="duration">Продолжительность (дн.)</Label>
              <Input
                id="duration"
                type="number"
                step="0.1"
                min="0"
                value={formData.duration}
                placeholder={isDummyFormMode ? '0 или 5' : '10'}
                readOnly={!isDummyFormMode}
                disabled={!isTaskIdentityReady || !isDummyFormMode}
                tabIndex={isDummyFormMode ? 0 : -1}
                className={isDummyFormMode ? '' : 'pointer-events-none'}
                title={isDummyFormMode ? 'Для фиктивной работы продолжительность вводится вручную' : 'Рассчитывается автоматически из трудоемкости, исполнителей и длительности рабочего дня'}
                onChange={(e) => handleInputChange('duration', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="laborIntensity">Трудоемкость (н-ч) *</Label>
              <Input
                id="laborIntensity"
                type="number"
                step="0.1"
                min="0"
                value={isDummyFormMode ? '0' : formData.laborIntensity}
                onChange={(e) => handleInputChange('laborIntensity', e.target.value)}
                placeholder={isDummyFormMode ? '0' : '80'}
                disabled={!isTaskIdentityReady || isDummyFormMode}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numberOfPerformers">Количество исполнителей *</Label>
              <Input
                id="numberOfPerformers"
                type="number"
                min="0"
                value={formData.numberOfPerformers}
                onChange={(e) => handleInputChange('numberOfPerformers', e.target.value)}
                placeholder="2"
                disabled={!isTaskIdentityReady}
              />
              <p className="text-xs text-muted-foreground">
                Если исполнителей 0, работа считается фиктивной: трудоемкость фиксируется в 0, а продолжительность задается вручную.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="predecessors">Предшественники</Label>
              <div id="predecessors" className="space-y-2">
                {isEditingLockedNumericTask && (
                  <p className="text-xs text-amber-700">
                    Для этой числовой работы предшественники заблокированы, потому что к текущему графу уже привязаны ручные дуги N-M.
                  </p>
                )}
                {predecessorSelections.map((selectedValue, rowIndex) => {
                  const selectedInOtherRows = new Set(
                    predecessorSelections
                      .map((value, index) => index === rowIndex ? '' : String(value || '').trim())
                      .filter(Boolean)
                  );
                  const optionsForRow = availablePredecessorOptions
                    .filter(task => task.id === selectedValue || !selectedInOtherRows.has(task.id));
                  const hasLegacyValue = selectedValue && !optionsForRow.some(task => task.id === selectedValue);
                  return (
                    <div key={`pred-row-${rowIndex}`} className="flex items-center gap-2">
                      <select
                        value={selectedValue}
                        onChange={(e) => {
                          const nextValue = String(e.target.value || '').trim();
                          const duplicateInOtherRows = predecessorSelections
                            .some((value, index) => index !== rowIndex && String(value || '').trim() === nextValue);
                          if (duplicateInOtherRows) {
                            setFormError('Нельзя выбрать одного и того же предшественника несколько раз.');
                            return;
                          }
                          const next = [...predecessorSelections];
                          next[rowIndex] = nextValue;
                          const normalized = next.map(value => String(value || '').trim());
                          setPredecessorSelections(normalized);
                          setFormData(prev => ({
                            ...prev,
                            predecessors: normalized.filter(Boolean).join(', ')
                          }));
                          setFormError('');
                        }}
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        disabled={!isTaskIdentityReady || isEditingLockedNumericTask}
                      >
                        <option value="">Без предшественника</option>
                        {hasLegacyValue && (
                          <option value={selectedValue}>
                            {selectedValue} (недоступно)
                          </option>
                        )}
                        {optionsForRow.map(task => (
                          <option key={`pred-opt-${rowIndex}-${task.id}`} value={task.id}>
                            {task.id} - {task.name}
                          </option>
                        ))}
                      </select>
                      {predecessorSelections.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                        onClick={() => {
                          const next = predecessorSelections.filter((_, i) => i !== rowIndex);
                          const normalized = (next.length > 0 ? next : ['']).map(value => String(value || '').trim());
                          setPredecessorSelections(normalized);
                          setFormData(prev => ({
                            ...prev,
                            predecessors: normalized.filter(Boolean).join(', ')
                          }));
                          setFormError('');
                        }}
                        disabled={!isTaskIdentityReady || isEditingLockedNumericTask}
                      >
                        -
                      </Button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPredecessorSelections(prev => [...prev, '']);
                    setFormError('');
                  }}
                  disabled={!isTaskIdentityReady || !canAddPredecessorRow || isEditingLockedNumericTask}
                >
                  + Добавить предшественника
                </Button>
                {hasEmptyPredecessorSelection && (
                  <span className="text-xs text-muted-foreground">
                    Сначала выберите значение в текущем поле.
                  </span>
                )}
                {!hasEmptyPredecessorSelection && selectedPredecessors.length >= MAX_PREDECESSORS && (
                  <span className="text-xs text-muted-foreground">
                    Достигнут лимит: не более {MAX_PREDECESSORS} предшественников.
                  </span>
                )}
              </div>
              {editingTaskIndex >= 0 && (
                <p className="text-xs text-muted-foreground">
                  Для редактирования доступны только задачи, расположенные выше в списке.
                </p>
              )}
              {!isTaskIdentityReady && (
                <p className="text-xs text-muted-foreground">
                  Сначала выберите задачу из подсказок или введите вручную ID и название.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={!isTaskIdentityReady}>
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
