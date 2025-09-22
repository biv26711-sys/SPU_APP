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
  Copy
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

  // Автоматическое сохранение сценариев при изменении
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

  const baseProject = originalProject || { tasks: [] };
  const baseResults = originalResults || { projectDuration: 0, criticalPath: [] };

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
      const modifiedProject = applyChanges(baseProject, changes);
      const calculator = new SPUCalculation(modifiedProject.tasks);
      const results = calculator.calculate();
      return results;
    } catch (error) {
      console.error('Ошибка расчета сценария:', error);
      return null;
    } finally {
      setIsCalculating(false);
    }
  };

  // Автоматическое применение изменений при добавлении
  const addChange = async () => {
    if (!selectedTask || changeValue === 0) return;

    const newChanges = { ...currentScenario.changes };
    if (!newChanges[selectedTask]) {
      newChanges[selectedTask] = {};
    }
    
    newChanges[selectedTask][changeType] = changeValue;
    
    // Немедленно пересчитываем результаты
    const results = await calculateScenario(newChanges);
    
    // Обновляем текущий сценарий с новыми результатами
    const updatedScenario = {
      ...currentScenario,
      changes: newChanges,
      results
    };
    
    setCurrentScenario(updatedScenario);
    
    // Сбрасываем форму
    setSelectedTask('');
    setChangeValue(0);
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

    // Добавляем сценарий в список и сразу обновляем состояние
    setScenarios(prev => {
      const newScenarios = [...prev, scenario];
      return newScenarios;
    });
    
    // Сбрасываем текущий сценарий
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

    // Пересчитываем результаты если есть изменения, иначе обнуляем
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
    
    // Пересчитываем результаты для копии
    const results = await calculateScenario(scenario.changes);
    duplicatedScenario.results = results;
    
    setScenarios(prev => [...prev, duplicatedScenario]);
  };

  const loadScenarioToEditor = async (scenario) => {
    // Пересчитываем результаты для загруженного сценария
    const results = await calculateScenario(scenario.changes);
    
    setCurrentScenario({
      name: `${scenario.name} (редактирование)`,
      changes: { ...scenario.changes },
      results
    });
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
    // Берем первую задачу и изменяем её длительность как пример
    const firstTask = baseProject.tasks[0];
    if (firstTask) {
      exampleChanges[firstTask.id] = { duration: firstTask.duration + 5 };
    }

    const results = await calculateScenario(exampleChanges);

    const exampleScenario = {
      id: Date.now(),
      name: `Пример сценария ${scenarios.length + 1}`,
      changes: exampleChanges,
      results: results,
      createdAt: new Date().toISOString()
    };
    setScenarios(prev => [...prev, exampleScenario]);
  };

  const getChangeTypeLabel = (type) => {
    switch (type) {
      case 'duration': return 'Длительность';
      case 'numberOfPerformers': return 'Исполнители';
      case 'workload': return 'Трудоемкость';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Анализ "Что-если"
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="modeling" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="modeling">Моделирование</TabsTrigger>
              <TabsTrigger value="scenarios">Сценарии ({scenarios.length})</TabsTrigger>
              <TabsTrigger value="comparison">Сравнение</TabsTrigger>
            </TabsList>

            <TabsContent value="modeling" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Создание сценария</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="scenario-name">Название сценария</Label>
                      <Input
                        id="scenario-name"
                        value={currentScenario.name}
                        onChange={(e) => setCurrentScenario({
                          ...currentScenario,
                          name: e.target.value
                        })}
                        placeholder="Введите название"
                      />
                    </div>

                    <div>
                      <Label htmlFor="task-select">Выберите задачу</Label>
                      <select
                        id="task-select"
                        className="w-full p-2 border rounded-md"
                        value={selectedTask}
                        onChange={(e) => setSelectedTask(e.target.value)}
                      >
                        <option value="">Выберите задачу</option>
                        {getTaskOptions().map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="change-type">Тип изменения</Label>
                      <select
                        id="change-type"
                        className="w-full p-2 border rounded-md"
                        value={changeType}
                        onChange={(e) => setChangeType(e.target.value)}
                      >
                        <option value="duration">Длительность (дни)</option>
                        <option value="numberOfPerformers">Количество исполнителей</option>
                        <option value="workload">Трудоемкость (н-ч)</option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="change-value">Новое значение</Label>
                      <Input
                        id="change-value"
                        type="number"
                        value={changeValue}
                        onChange={(e) => setChangeValue(Number(e.target.value))}
                        placeholder="Введите значение"
                        min="0"
                        step="0.1"
                      />
                    </div>

                    <Button 
                      onClick={addChange} 
                      disabled={!selectedTask || changeValue === 0 || isCalculating}
                      className="w-full"
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
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Текущие изменения</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Object.keys(currentScenario.changes).length === 0 ? (
                      <div className="text-center py-8">
                        <AlertTriangle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-500">Изменения не добавлены</p>
                        <p className="text-sm text-gray-400 mt-2">
                          Выберите задачу и добавьте изменение для начала моделирования
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {Object.entries(currentScenario.changes).map(([taskId, changes]) => (
                          <div key={taskId} className="border rounded-lg p-3">
                            <h4 className="font-medium mb-2">Задача: {taskId}</h4>
                            {Object.entries(changes).map(([changeType, value]) => (
                              <div key={changeType} className="flex items-center justify-between mb-2">
                                <span className="text-sm">
                                  {getChangeTypeLabel(changeType)}: <strong>{value}</strong>
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => removeChange(taskId, changeType)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    {currentScenario.results && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Результаты сценария:
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                          <div>
                            <span className="text-gray-600">Длительность:</span>
                            <span className="ml-2 font-medium">{currentScenario.results.projectDuration.toFixed(1)} дней</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Изменение:</span>
                            <span className={`ml-2 font-medium ${
                              currentScenario.results.projectDuration > baseResults.projectDuration ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {currentScenario.results.projectDuration - baseResults.projectDuration > 0 ? '+' : ''}
                              {(currentScenario.results.projectDuration - baseResults.projectDuration).toFixed(1)} дней
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 mb-3">
                          <strong>Критический путь:</strong> {currentScenario.results.criticalPath?.join(' → ') || 'Не определен'}
                        </div>
                        <Button onClick={saveScenario} className="w-full">
                          <Save className="h-4 w-4 mr-2" />
                          Сохранить сценарий
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="scenarios" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Сохраненные сценарии ({scenarios.length})</h3>
                <Button 
                  onClick={createExampleScenario}
                  variant="outline"
                  disabled={isCalculating}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Создать пример сценария
                </Button>
              </div>
              
              {scenarios.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <AlertTriangle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Сценарии не созданы</h3>
                    <p className="text-gray-500 mb-4">
                      Создайте сценарий на вкладке "Моделирование" и сохраните его, или создайте пример сценария из существующих данных.
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Button 
                        onClick={createExampleScenario}
                        variant="outline"
                        disabled={isCalculating}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Создать пример
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {scenarios.map((scenario) => {
                    const impact = getImpactAnalysis(scenario);
                    return (
                      <Card key={scenario.id} className="relative">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center justify-between">
                            <span className="truncate">{scenario.name}</span>
                            <Badge variant={
                              impact?.impact === 'high' ? 'destructive' :
                              impact?.impact === 'medium' ? 'default' : 'secondary'
                            }>
                              {impact?.impact === 'high' ? 'Высокое' :
                               impact?.impact === 'medium' ? 'Среднее' : 'Низкое'} влияние
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
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
                            <div className="pt-2 flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => loadScenarioToEditor(scenario)}
                                className="flex-1"
                                title="Загрузить в редактор"
                              >
                                Редактировать
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => duplicateScenario(scenario)}
                                title="Создать копию"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => removeScenario(scenario.id)}
                                className="text-red-600 hover:text-red-700"
                                title="Удалить сценарий"
                              >
                                <Trash2 className="h-4 w-4" />
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
                  <CardTitle>Сравнение сценариев</CardTitle>
                </CardHeader>
                <CardContent>
                  {scenarios.length === 0 ? (
                    <div className="text-center py-8">
                      <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500">
                        Создайте несколько сценариев для их сравнения
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-300 p-3 text-left">Сценарий</th>
                            <th className="border border-gray-300 p-3 text-center">Длительность</th>
                            <th className="border border-gray-300 p-3 text-center">Изменение</th>
                            <th className="border border-gray-300 p-3 text-center">Влияние</th>
                            <th className="border border-gray-300 p-3 text-center">Критический путь</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-blue-50">
                            <td className="border border-gray-300 p-2 font-medium">Базовый проект</td>
                            <td className="border border-gray-300 p-2 text-center">{baseResults.projectDuration?.toFixed(1)} дней</td>
                            <td className="border border-gray-300 p-2 text-center">-</td>
                            <td className="border border-gray-300 p-2 text-center">-</td>
                            <td className="border border-gray-300 p-2 text-center">{baseResults.criticalPath?.join(' → ') || 'Не определен'}</td>
                          </tr>
                          {scenarios.map((scenario) => {
                            const impact = getImpactAnalysis(scenario);
                            return (
                              <tr key={scenario.id}>
                                <td className="border border-gray-300 p-2">{scenario.name}</td>
                                <td className="border border-gray-300 p-2 text-center">{scenario.results?.projectDuration?.toFixed(1)} дней</td>
                                <td className={`border border-gray-300 p-2 text-center font-medium ${
                                  impact?.durationChange > 0 ? 'text-red-600' : 'text-green-600'
                                }`}>
                                  {impact?.durationChange > 0 ? '+' : ''}{impact?.durationChange?.toFixed(1)} дней
                                </td>
                                <td className="border border-gray-300 p-2 text-center">
                                  <Badge variant={
                                    impact?.impact === 'high' ? 'destructive' :
                                    impact?.impact === 'medium' ? 'default' : 'secondary'
                                  } size="sm">
                                    {impact?.impact === 'high' ? 'Высокое' :
                                     impact?.impact === 'medium' ? 'Среднее' : 'Низкое'}
                                  </Badge>
                                </td>
                                <td className="border border-gray-300 p-2 text-center text-sm">
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

