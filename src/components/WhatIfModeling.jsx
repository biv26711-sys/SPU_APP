import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle,
  BarChart3,
  Clock,
  Users,
  Target,
  Zap,
  RefreshCw,
  Trash2,
  Plus,
  Save,
  Copy,
  Send,
  Edit,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import { SPUCalculation } from '../utils/spuCalculations';

const WhatIfModeling = ({ originalProject, originalResults }) => {
  const [scenarios, setScenarios] = useState(() => {
    try {
      const savedScenarios = localStorage.getItem("whatIfScenarios");
      return savedScenarios ? JSON.parse(savedScenarios) : [];
    } catch (error) {
      console.error("Failed to load scenarios from localStorage", error);
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("whatIfScenarios", JSON.stringify(scenarios));
    } catch (error) {
      console.error("Failed to save scenarios to localStorage", error);
    }
  }, [scenarios]);

  const [currentScenario, setCurrentScenario] = useState({
    name: 'Новый сценарий',
    changes: {},
    results: null
  });
  const [selectedTask, setSelectedTask] = useState('');
  const [changeType, setChangeType] = useState('duration');
  const [changeValue, setChangeValue] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [activeTab, setActiveTab] = useState('modeling');

  const baseProject = originalProject || { 
    tasks: [
      { id: 'T1', name: 'Планирование проекта', duration: 5, numberOfPerformers: 2, workload: 40 },
      { id: 'T2', name: 'Анализ требований', duration: 8, numberOfPerformers: 3, workload: 72 },
      { id: 'T3', name: 'Проектирование', duration: 12, numberOfPerformers: 4, workload: 192 },
      { id: 'T4', name: 'Разработка', duration: 20, numberOfPerformers: 6, workload: 480 },
      { id: 'T5', name: 'Тестирование', duration: 10, numberOfPerformers: 3, workload: 120 },
      { id: 'T6', name: 'Внедрение', duration: 5, numberOfPerformers: 2, workload: 40 }
    ]
  };
  
  const baseResults = originalResults || { 
    projectDuration: 45, 
    criticalPath: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'],
    totalWorkload: 944
  };

  const applyChanges = (project, changes) => {
    const modifiedProject = { ...project };
    modifiedProject.tasks = project.tasks.map(task => {
      const taskChanges = changes[task.id];
      if (!taskChanges) return task;

      const modifiedTask = { ...task };
      Object.keys(taskChanges).forEach(key => {
        modifiedTask[key] = taskChanges[key];
      });
      return modifiedTask;
    });
    return modifiedProject;
  };

  const calculateScenario = async (changes) => {
    setIsCalculating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800)); 
      
      const modifiedProject = applyChanges(baseProject, changes);
      
    
      let totalDuration = 0;
      let totalWorkload = 0;
      const criticalPath = [];
      
      modifiedProject.tasks.forEach(task => {
        totalDuration += task.duration;
        totalWorkload += task.workload || (task.duration * task.numberOfPerformers * 4);
        criticalPath.push(task.id);
      });
      
      
      const efficiency = Math.random() * 0.2 + 0.9; 
      totalDuration *= efficiency;
      
      return {
        projectDuration: totalDuration,
        criticalPath: criticalPath,
        totalWorkload: totalWorkload,
        efficiency: efficiency
      };
    } catch (error) {
      console.error('Ошибка расчета сценария:', error);
      return null;
    } finally {
      setIsCalculating(false);
    }
  };

  const addChange = async () => {
    if (!selectedTask || changeValue === 0) {
      alert("Пожалуйста, выберите задачу и введите значение изменения");
      return;
    }

    const newChanges = { ...currentScenario.changes };
    if (!newChanges[selectedTask]) {
      newChanges[selectedTask] = {};
    }
    
    newChanges[selectedTask][changeType] = changeValue;
    
    const results = await calculateScenario(newChanges);
   
    const updatedScenario = {
      ...currentScenario,
      changes: newChanges,
      results
    };
    
    setCurrentScenario(updatedScenario);
    

    setSelectedTask('');
    setChangeValue(0);
  };

  const forceSaveToScenarios = async () => {
    if (!currentScenario.results) {
      alert("Сначала добавьте изменения и дождитесь расчета результатов");
      return;
    }

    const scenario = {
      ...currentScenario,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      name: currentScenario.name || `Сценарий ${scenarios.length + 1}`
    };

    setScenarios(prev => {
      const existingIndex = prev.findIndex(s => 
        JSON.stringify(s.changes) === JSON.stringify(scenario.changes)
      );
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = scenario;
        return updated;
      } else {
        return [...prev, scenario];
      }
    });
    
  
    setActiveTab('scenarios');
    
  
    setCurrentScenario({
      name: 'Новый сценарий',
      changes: {},
      results: null
    });
  };

  const saveScenario = () => {
    if (!currentScenario.results) {
      alert("Сначала добавьте изменения и дождитесь расчета результатов");
      return;
    }

    const scenario = {
      ...currentScenario,
      id: Date.now(),
      createdAt: new Date().toISOString()
    };

    setScenarios(prev => [...prev, scenario]);
    
    setCurrentScenario({
      name: 'Новый сценарий',
      changes: {},
      results: null
    });
  };

  const removeChange = async (taskId, changeType) => {
    const newChanges = { ...currentScenario.changes };
    if (newChanges[taskId]) {
      delete newChanges[taskId][changeType];
      if (Object.keys(newChanges[taskId]).length === 0) {
        delete newChanges[taskId];
      }
    }

    const results = Object.keys(newChanges).length > 0 ? await calculateScenario(newChanges) : null;
    
    setCurrentScenario({
      ...currentScenario,
      changes: newChanges,
      results
    });
  };

  const removeScenario = (scenarioId) => {
    setScenarios(prev => prev.filter(s => s.id !== scenarioId));
  };

  const duplicateScenario = async (scenario) => {
    const duplicatedScenario = {
      ...scenario,
      id: Date.now(),
      name: `${scenario.name} (копия)`,
      createdAt: new Date().toISOString()
    };
    
    const results = await calculateScenario(scenario.changes);
    duplicatedScenario.results = results;
    
    setScenarios(prev => [...prev, duplicatedScenario]);
  };

  const loadScenarioToEditor = async (scenario) => {
    const results = await calculateScenario(scenario.changes);
    
    setCurrentScenario({
      name: `${scenario.name} (редактирование)`,
      changes: { ...scenario.changes },
      results
    });
    
    setActiveTab('modeling');
  };

  const getImpactAnalysis = (scenario) => {
    if (!scenario.results || !baseResults) return null;

    const durationChange = scenario.results.projectDuration - baseResults.projectDuration;
    const criticalPathChanged = JSON.stringify(scenario.results.criticalPath) !== JSON.stringify(baseResults.criticalPath);
    
    return {
      durationChange,
      criticalPathChanged,
      impact: Math.abs(durationChange) > 5 ? 'high' : Math.abs(durationChange) > 2 ? 'medium' : 'low'
    };
  };

  const getTaskOptions = () => {
    return baseProject.tasks.map(task => ({
      value: task.id,
      label: `${task.id} - ${task.name || 'Без названия'}`
    }));
  };

  const createExampleScenario = async () => {
    if (!baseProject.tasks || baseProject.tasks.length === 0) {
      alert("Нет данных проекта для создания примера сценария.");
      return;
    }

    const exampleChanges = {};
    
    // Создаем более интересный пример
    const firstTask = baseProject.tasks[0];
    const secondTask = baseProject.tasks[1];
    
    if (firstTask) {
      exampleChanges[firstTask.id] = { duration: firstTask.duration + 3 };
    }
    if (secondTask) {
      exampleChanges[secondTask.id] = { numberOfPerformers: secondTask.numberOfPerformers + 1 };
    }

    const results = await calculateScenario(exampleChanges);

    const exampleScenario = {
      id: Date.now(),
      name: `Оптимистичный сценарий`,
      changes: exampleChanges,
      results: results,
      createdAt: new Date().toISOString()
    };
    setScenarios(prev => [...prev, exampleScenario]);
  };

  const resetCurrentScenario = () => {
    setCurrentScenario({
      name: 'Новый сценарий',
      changes: {},
      results: null
    });
    setSelectedTask('');
    setChangeValue(0);
  };

  const getChangeTypeLabel = (type) => {
    switch (type) {
      case 'duration': return 'Длительность';
      case 'numberOfPerformers': return 'Исполнители';
      case 'workload': return 'Трудоемкость';
      default: return type;
    }
  };

  const getChangeTypeUnit = (type) => {
    switch (type) {
      case 'duration': return 'дней';
      case 'numberOfPerformers': return 'чел.';
      case 'workload': return 'н-ч';
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 border-blue-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            Анализ "Что-если"
            <Badge variant="secondary" className="ml-auto">
              {scenarios.length} сценариев
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="modeling" className="flex items-center gap-2">
                <Edit className="h-4 w-4" />
                Моделирование
              </TabsTrigger>
              <TabsTrigger value="scenarios" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Сценарии ({scenarios.length})
              </TabsTrigger>
              <TabsTrigger value="comparison" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Сравнение
              </TabsTrigger>
            </TabsList>

            <TabsContent value="modeling" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border border-green-200">
                  <CardHeader className="bg-green-50">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Plus className="h-5 w-5 text-green-600" />
                      Создание сценария
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-6">
                    <div>
                      <Label htmlFor="scenario-name" className="text-sm font-medium">Название сценария</Label>
                      <Input
                        id="scenario-name"
                        value={currentScenario.name}
                        onChange={(e) => setCurrentScenario({
                          ...currentScenario,
                          name: e.target.value
                        })}
                        placeholder="Введите название сценария"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="task-select" className="text-sm font-medium">Выберите задачу</Label>
                      <select
                        id="task-select"
                        className="w-full p-3 border border-gray-300 rounded-md mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={selectedTask}
                        onChange={(e) => setSelectedTask(e.target.value)}
                      >
                        <option value="">Выберите задачу для изменения</option>
                        {getTaskOptions().map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="change-type" className="text-sm font-medium">Тип изменения</Label>
                      <select
                        id="change-type"
                        className="w-full p-3 border border-gray-300 rounded-md mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={changeType}
                        onChange={(e) => setChangeType(e.target.value)}
                      >
                        <option value="duration">Длительность (дни)</option>
                        <option value="numberOfPerformers">Количество исполнителей</option>
                        <option value="workload">Трудоемкость (н-ч)</option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="change-value" className="text-sm font-medium">
                        Новое значение ({getChangeTypeUnit(changeType)})
                      </Label>
                      <Input
                        id="change-value"
                        type="number"
                        value={changeValue}
                        onChange={(e) => setChangeValue(Number(e.target.value))}
                        placeholder="Введите новое значение"
                        min="0"
                        step="0.1"
                        className="mt-1"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        onClick={addChange} 
                        disabled={!selectedTask || changeValue === 0 || isCalculating}
                        className="flex-1"
                      >
                        {isCalculating ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Расчет...
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4 mr-2" />
                            Добавить изменение
                          </>
                        )}
                      </Button>
                      <Button 
                        onClick={resetCurrentScenario}
                        variant="outline"
                        title="Сбросить текущий сценарий"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-blue-200">
                  <CardHeader className="bg-blue-50">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="h-5 w-5 text-blue-600" />
                      Текущие изменения
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {Object.keys(currentScenario.changes).length === 0 ? (
                      <div className="text-center py-8">
                        <AlertTriangle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-500 font-medium">Изменения не добавлены</p>
                        <p className="text-sm text-gray-400 mt-2">
                          Выберите задачу и добавьте изменение для начала моделирования
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {Object.entries(currentScenario.changes).map(([taskId, changes]) => {
                          const task = baseProject.tasks.find(t => t.id === taskId);
                          return (
                            <div key={taskId} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                              <h4 className="font-medium mb-3 text-gray-800">
                                {task?.name || `Задача ${taskId}`}
                              </h4>
                              {Object.entries(changes).map(([changeType, value]) => (
                                <div key={changeType} className="flex items-center justify-between mb-2 p-2 bg-white rounded border">
                                  <span className="text-sm">
                                    <strong>{getChangeTypeLabel(changeType)}:</strong> {value} {getChangeTypeUnit(changeType)}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => removeChange(taskId, changeType)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {currentScenario.results && (
                      <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          Результаты моделирования:
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                          <div className="bg-white p-3 rounded border">
                            <span className="text-gray-600 block">Длительность проекта:</span>
                            <span className="text-lg font-bold text-blue-600">
                              {currentScenario.results.projectDuration.toFixed(1)} дней
                            </span>
                          </div>
                          <div className="bg-white p-3 rounded border">
                            <span className="text-gray-600 block">Изменение:</span>
                            <span className={`text-lg font-bold ${
                              currentScenario.results.projectDuration > baseResults.projectDuration ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {currentScenario.results.projectDuration - baseResults.projectDuration > 0 ? '+' : ''}
                              {(currentScenario.results.projectDuration - baseResults.projectDuration).toFixed(1)} дней
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 mb-4 bg-white p-3 rounded border">
                          <strong>Критический путь:</strong> {currentScenario.results.criticalPath?.join(' → ') || 'Не определен'}
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={saveScenario} className="flex-1">
                            <Save className="h-4 w-4 mr-2" />
                            Сохранить сценарий
                          </Button>
                          <Button 
                            onClick={forceSaveToScenarios} 
                            variant="outline"
                            className="flex-1 border-blue-300 text-blue-600 hover:bg-blue-50"
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Отправить в сценарии
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="scenarios" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Сохраненные сценарии ({scenarios.length})</h3>
                <div className="flex gap-2">
                  <Button 
                    onClick={createExampleScenario}
                    variant="outline"
                    disabled={isCalculating}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Создать пример
                  </Button>
                </div>
              </div>
              
              {scenarios.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <AlertTriangle className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Нет сохраненных сценариев</h3>
                    <p className="text-gray-500 mb-4">
                      Создайте свой первый сценарий на вкладке "Моделирование"
                    </p>
                    <Button onClick={() => setActiveTab('modeling')} variant="outline">
                      <Edit className="h-4 w-4 mr-2" />
                      Перейти к моделированию
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {scenarios.map((scenario) => {
                    const impact = getImpactAnalysis(scenario);
                    return (
                      <Card key={scenario.id} className="border border-gray-200 hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-base font-medium truncate">
                              {scenario.name}
                            </CardTitle>
                            <Badge variant={
                              impact?.impact === 'high' ? 'destructive' :
                              impact?.impact === 'medium' ? 'default' : 'secondary'
                            } size="sm">
                              {impact?.impact === 'high' ? 'Высокое' :
                               impact?.impact === 'medium' ? 'Среднее' : 'Низкое'}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500">
                            {new Date(scenario.createdAt).toLocaleDateString('ru-RU')}
                          </p>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Длительность:</span>
                              <span className="font-medium">{scenario.results?.projectDuration?.toFixed(1) || baseResults.projectDuration} дней</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Изменение:</span>
                              <span className={`font-medium ${
                                impact?.durationChange > 0 ? 'text-red-600' : 'text-green-600'
                              }`}>
                                {impact?.durationChange > 0 ? '+' : ''}{impact?.durationChange?.toFixed(1) || 0} дней
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Изменений:</span>
                              <span className="font-medium">{Object.keys(scenario.changes).length}</span>
                            </div>
                            {impact?.criticalPathChanged && (
                              <Badge variant="outline" className="w-full justify-center">
                                Критический путь изменен
                              </Badge>
                            )}
                            <div className="pt-3 flex gap-1">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => loadScenarioToEditor(scenario)}
                                className="flex-1 text-xs"
                                title="Загрузить в редактор"
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Редактировать
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => duplicateScenario(scenario)}
                                title="Создать копию"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => removeScenario(scenario.id)}
                                className="text-red-600 hover:text-red-700"
                                title="Удалить сценарий"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="comparison" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Сравнение сценариев
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {scenarios.length === 0 ? (
                    <div className="text-center py-12">
                      <BarChart3 className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Нет сценариев для сравнения
                      </h3>
                      <p className="text-gray-500 mb-4">
                        Создайте несколько сценариев для их сравнения
                      </p>
                      <Button onClick={() => setActiveTab('modeling')} variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Создать сценарий
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300 rounded-lg overflow-hidden">
                        <thead>
                          <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                            <th className="border border-gray-300 p-4 text-left font-medium">Сценарий</th>
                            <th className="border border-gray-300 p-4 text-center font-medium">Длительность</th>
                            <th className="border border-gray-300 p-4 text-center font-medium">Изменение</th>
                            <th className="border border-gray-300 p-4 text-center font-medium">Влияние</th>
                            <th className="border border-gray-300 p-4 text-center font-medium">Критический путь</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-blue-50 font-medium">
                            <td className="border border-gray-300 p-3">
                              <div className="flex items-center gap-2">
                                <Target className="h-4 w-4 text-blue-600" />
                                Базовый проект
                              </div>
                            </td>
                            <td className="border border-gray-300 p-3 text-center">{baseResults.projectDuration?.toFixed(1)} дней</td>
                            <td className="border border-gray-300 p-3 text-center">-</td>
                            <td className="border border-gray-300 p-3 text-center">-</td>
                            <td className="border border-gray-300 p-3 text-center text-sm">{baseResults.criticalPath?.join(' → ') || 'Не определен'}</td>
                          </tr>
                          {scenarios.map((scenario) => {
                            const impact = getImpactAnalysis(scenario);
                            return (
                              <tr key={scenario.id} className="hover:bg-gray-50">
                                <td className="border border-gray-300 p-3">{scenario.name}</td>
                                <td className="border border-gray-300 p-3 text-center font-medium">{scenario.results?.projectDuration?.toFixed(1)} дней</td>
                                <td className={`border border-gray-300 p-3 text-center font-medium ${
                                  impact?.durationChange > 0 ? 'text-red-600' : 'text-green-600'
                                }`}>
                                  {impact?.durationChange > 0 ? '+' : ''}{impact?.durationChange?.toFixed(1)} дней
                                </td>
                                <td className="border border-gray-300 p-3 text-center">
                                  <Badge variant={
                                    impact?.impact === 'high' ? 'destructive' :
                                    impact?.impact === 'medium' ? 'default' : 'secondary'
                                  } size="sm">
                                    {impact?.impact === 'high' ? 'Высокое' :
                                     impact?.impact === 'medium' ? 'Среднее' : 'Низкое'}
                                  </Badge>
                                </td>
                                <td className="border border-gray-300 p-3 text-center text-sm">
                                  {scenario.results?.criticalPath?.join(' → ') || 'Не определен'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatIfModeling;