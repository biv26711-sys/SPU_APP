import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { aonToAoa, looksLikeEdgeId } from '@/utils/converting'; // новое
import { 
  Calculator, 
  FileText, 
  Network, 
  BarChart3, 
  CheckCircle, 
  AlertCircle,
  Download,
  Upload,
  Trash2,
  Activity,
  Settings,
  Users,
  Save
} from 'lucide-react';

import TaskInput from './components/TaskInput';
import CalculationResults from './components/CalculationResults';
import NetworkDiagram from './components/NetworkDiagram';
import GanttChart from './components/GanttChart';
import ImportExport from './components/ImportExport';
import LogViewer from './components/LogViewer';
import ProjectDashboard from './components/ProjectDashboard';
import Calendar from './components/Calendar';
import ResourceManagement from './components/ResourceManagement';
import EnhancedExport from './components/EnhancedExport';
import ResourceCalendar from './components/ResourceCalendar';
import ThemeSettings from './components/ThemeSettings';
import WhatIfModeling from './components/WhatIfModeling';
import { SPUCalculation } from './utils/spuCalculations';
import { validateNetwork } from './utils/calculations';
import { sampleTasks as exampleTasks } from './types/index';
import logger from './utils/logger';
import useAutosave from './hooks/useAutosave';
import './App.css';

function App() {
  const [project, setProject] = useState({
    id: 'project_' + Date.now(),
    name: 'Новый проект',
    startDate: new Date().toISOString().split('T')[0],
    tasks: [],
    criticalPath: [],
    projectDuration: 0
  });
  const [calculationResults, setCalculationResults] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [activeTab, setActiveTab] = useState('input');
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const networkDiagramRef = useRef(null);

  const { loadAutosavedData, clearAutosavedData, hasAutosavedData } = useAutosave(project, calculationResults);

  useEffect(() => {
    logger.logSystemEvent('APP_MOUNTED', {
      projectId: project.id,
      timestamp: new Date().toISOString()
    });

    if (hasAutosavedData()) {
      setShowRecoveryDialog(true);
    }
  }, []);

  // новое
  useEffect(() => {
    const off = window.electronAPI?.onMenuLoadExampleBasic?.(() => {
      handleLoadExample();
    });
    return () => {
      window.electronAPI?.removeAllListeners?.('menu-load-example-basic');
    };
  }, []);
  //

  // новое
  useEffect(() => {
    const off = window.electronAPI?.onMenuLoadExampleRequired?.(async () => {
      try {
        await handleLoadRequiredFromDB();
      } catch (e) {
        logger.logError('MENU_LOAD_REQUIRED_ERROR', { error: e.message });
      }
    });
    return () => {
      window.electronAPI?.removeAllListeners?.('menu-load-example-required');
    };
  }, []);
  //

  const handleAddTask = (task) => {
    try {
      const newTask = {
        ...task,
        id: task.id || `${task.from}-${task.to}`,
        laborIntensity: task.laborIntensity || task.duration * 8,
        numberOfPerformers: task.numberOfPerformers || 1
      };

      const updatedTasks = [...project.tasks, newTask];
      setProject(prev => ({ ...prev, tasks: updatedTasks }));
      
      logger.logUserAction('ADD_TASK', {
        taskId: newTask.id,
        taskName: newTask.name,
        duration: newTask.duration,
        laborIntensity: newTask.laborIntensity,
        numberOfPerformers: newTask.numberOfPerformers
      });
      
      setCalculationResults(null);
      setValidationErrors([]);
    } catch (error) {
      logger.logError('ADD_TASK_ERROR', { error: error.message, task });
    }
  };

  const handleUpdateTask = (taskId, updatedTask) => {
    try {
      const updatedTasks = project.tasks.map(task => 
        task.id === taskId ? { ...task, ...updatedTask } : task
      );
      setProject(prev => ({ ...prev, tasks: updatedTasks }));
      
      logger.logUserAction('UPDATE_TASK', {
        taskId,
        updatedFields: Object.keys(updatedTask)
      });
      
      setCalculationResults(null);
      setValidationErrors([]);
    } catch (error) {
      logger.logError('UPDATE_TASK_ERROR', { error: error.message, taskId, updatedTask });
    }
  };

  const handleDeleteTask = (taskId) => {
    try {
      const updatedTasks = project.tasks.filter(task => task.id !== taskId);
      setProject(prev => ({ ...prev, tasks: updatedTasks }));
      
      logger.logUserAction('DELETE_TASK', { taskId });
      
      setCalculationResults(null);
      setValidationErrors([]);
    } catch (error) {
      logger.logError('DELETE_TASK_ERROR', { error: error.message, taskId });
    }
  };

  // новое
  const chooseExampleVariant = async () => {
    // Fallback for browser environment without Electron API
    if (!window.electronAPI?.showMessageBox) {
      const choice = confirm('Загрузить базовый пример? (OK - базовый пример, Отмена - все обязательные из БД)');
      if (choice) {
        return handleLoadExample();
      } else {
        return handleLoadRequiredFromDB();
      }
    }

    const res = await window.electronAPI?.showMessageBox?.({
      type: 'question',
      buttons: ['Базовый пример', 'Все обязательные из БД', 'Отмена'],
      defaultId: 0,
      cancelId: 2,
      title: 'Загрузить пример',
      message: 'Выберите вариант примера для загрузки',
    });

    const idx = res?.response ?? 2;
    if (idx === 0) return handleLoadExample();
    if (idx === 1) return handleLoadRequiredFromDB();
  };


  const handleCalculate = async () => {
  setIsCalculating(true);
  setValidationErrors([]);

  try { // ниже тут очень много нового *************
    logger.logUserAction('START_CALCULATION', {
      tasksCount: project.tasks.length,
      projectId: project.id
    });

    const source = Array.isArray(project.tasks) ? project.tasks : [];
    const needsAdapt = source.some(t => !looksLikeEdgeId(String(t.id)));
    const tasksForCalc = needsAdapt ? aonToAoa(source, { hoursPerDay: 6, createSink: true }) : source;
    const HOURS_PER_DAY = 6;
    const normalizedTasks = tasksForCalc.map(t => {
      const p = Math.max(1, parseInt(t.numberOfPerformers, 10) || 1);
      const isDummy = t.isDummy === true || Number(t.duration) === 0;

      const laborHours = Number.isFinite(+t.laborIntensity) ? +t.laborIntensity : null;
      let durationDays;

      if (isDummy) {
        durationDays = 0;
      } else if (laborHours != null && laborHours > 0) {
        durationDays = Math.max(1, Math.ceil(laborHours / (HOURS_PER_DAY * p)));
      } else {
        const d = Number.isFinite(+t.duration) ? +t.duration : 0;
        durationDays = Math.max(1, Math.ceil(d || 1));
      }

      const preds = Array.isArray(t.predecessors)
        ? t.predecessors
        : (typeof t.predecessors === 'string' && t.predecessors.trim().length
            ? t.predecessors.split(',').map(s => s.trim()).filter(Boolean)
            : []);

      return {
        ...t,
        isDummy,
        numberOfPerformers: p,
        duration: durationDays,
        predecessors: preds,
      };
    });

    // ************

    const validation = validateNetwork(normalizedTasks); // новое
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      logger.logCalculationError(new Error('Validation failed'), {
        errors: validation.errors,
        tasksCount: normalizedTasks.length // новое 
      });
      return;
    }

    const result = SPUCalculation.calculateNetworkParameters(normalizedTasks);

    if (result.isValid) {
      setCalculationResults(result);
      setProject(prev => ({
        ...prev,
        criticalPath: result.criticalPath,
        projectDuration: result.projectDuration
      }));
      logger.logCalculationSuccess(result);
      setActiveTab('network');
    } else {
      setValidationErrors(result.errors);
      logger.logCalculationError(new Error('Calculation failed'), {
        errors: result.errors,
        tasksCount: normalizedTasks.length
      });
    }
  } catch (error) {
    setValidationErrors([error.message]);
    logger.logCalculationError(error, {
      tasksCount: project.tasks.length,
      projectId: project.id
    });
  } finally {
    setIsCalculating(false);
  }
};

  const handleLoadExample = () => {
    try {
      setProject(prev => ({ ...prev, tasks: [...exampleTasks] }));
      setCalculationResults(null);
      setValidationErrors([]);
      
      logger.logUserAction('LOAD_EXAMPLE', {
        exampleTasksCount: exampleTasks.length
      });
    } catch (error) {
      logger.logError('LOAD_EXAMPLE_ERROR', { error: error.message });
    }
  };

  // в этом блоке новое
  const handleLoadRequiredFromDB = async () => {
    try {
      const all = (await window.electronAPI.invoke('templates:getAllRequired')) || [];
      const required = all;

      const tasks = [];

      for (const tpl of required) {
        const req = (await window.electronAPI.invoke('templates:requiredFor', tpl.id)) || [];
        const preds = req.map(p => String(p.id));

        const hours = Math.ceil((tpl.base_duration_minutes || 0) / 60);
        const days  = Math.max(1, Math.ceil((tpl.base_duration_minutes || 0) / 1440));

        tasks.push({
          id: String(tpl.id),
          name: tpl.name,
          duration: days,
          laborIntensity: hours,
          numberOfPerformers: 1,
          predecessors: preds,
          phase: tpl.phase_id,
        });
      }

      setProject(prev => ({ ...prev, tasks }));
      setCalculationResults(null);
      setValidationErrors([]);

      logger.logUserAction('LOAD_EXAMPLE_REQUIRED', {
        example: 'required_from_db',
        tasksCount: tasks.length
      });
    } catch (error) {
      logger.logError('LOAD_EXAMPLE_REQUIRED_ERROR', { error: error.message });
    }
  };

  // конец нового


  const handleClearAll = () => {
    try {
      setProject(prev => ({ ...prev, tasks: [], criticalPath: [], projectDuration: 0 }));
      setCalculationResults(null);
      setValidationErrors([]);
      
      logger.logUserAction('CLEAR_ALL_TASKS');
    } catch (error) {
      logger.logError('CLEAR_ALL_ERROR', { error: error.message });
    }
  };

  const handleProjectImport = (importedProject, importedResults = null) => {
    try {
      setProject({
        ...importedProject,
        id: importedProject.id || 'imported_' + Date.now()
      });
      
      if (importedResults) {
        setCalculationResults(importedResults);
      } else {
        setCalculationResults(null);
      }
      
      setValidationErrors([]);
      
      logger.logUserAction('IMPORT_PROJECT', {
        projectId: importedProject.id,
        tasksCount: importedProject.tasks?.length || 0,
        hasResults: !!importedResults
      });
    } catch (error) {
      logger.logError('IMPORT_PROJECT_ERROR', { error: error.message });
    }
  };

  const handleTasksImport = (importedTasks) => {
    try {
      setProject(prev => ({ ...prev, tasks: importedTasks }));
      setCalculationResults(null);
      setValidationErrors([]);
      
      logger.logUserAction('IMPORT_TASKS', {
        tasksCount: importedTasks.length
      });
    } catch (error) {
      logger.logError('IMPORT_TASKS_ERROR', { error: error.message });
    }
  };

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    logger.logUserAction('CHANGE_TAB', { tab: newTab });
  };

  const handleRecoverData = () => {
    try {
      const recoveredData = loadAutosavedData();
      if (recoveredData) {
        setProject(recoveredData.project);
        setCalculationResults(recoveredData.calculationResults);
        setShowRecoveryDialog(false);
        logger.logUserAction('RECOVER_AUTOSAVED_DATA', {
          timestamp: recoveredData.timestamp
        });
      }
    } catch (error) {
      logger.logError('RECOVER_DATA_ERROR', { error: error.message });
    }
  };

  const handleDiscardRecovery = () => {
    clearAutosavedData();
    setShowRecoveryDialog(false);
    logger.logUserAction('DISCARD_AUTOSAVED_DATA');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Диалог восстановления данных */}
      {showRecoveryDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Save className="h-5 w-5" />
                Восстановление данных
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Обнаружены автоматически сохраненные данные проекта. Хотите восстановить их?
              </p>
              <div className="flex gap-2">
                <Button onClick={handleRecoverData} className="flex-1">
                  Восстановить
                </Button>
                <Button variant="outline" onClick={handleDiscardRecovery} className="flex-1">
                  Отклонить
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Заголовок */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            СПУ - Сетевое планирование и управление
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            Система для расчета параметров сетевого графика и построения диаграмм
          </p>
          <div className="flex justify-center items-center gap-4 text-sm text-gray-500">
            <span>Задач: {project.tasks.length}</span>
            <span>Длительность: {project.projectDuration?.toFixed(2) || 0} дн.</span>
            {calculationResults && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Расчет выполнен успешно
              </Badge>
            )}
          </div>
        </div>

        {/* Управление проектом */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Управление проектом</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={handleCalculate} 
                disabled={project.tasks.length === 0 || isCalculating}
                className="bg-green-600 hover:bg-green-700"
              >
                <Calculator className="h-4 w-4 mr-2" />
                {isCalculating ? 'Расчет...' : 'Рассчитать параметры'}
              </Button>
              
              <Button onClick={chooseExampleVariant} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Загрузить пример
              </Button>
              
              <Button onClick={handleClearAll} variant="outline">
                <Trash2 className="h-4 w-4 mr-2" />
                Очистить все
              </Button>
            </div>

            {/* Статус расчета */}
            {calculationResults && (
              <Alert className="mt-4 border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>Расчет выполнен успешно</strong>
                  <br />
                  Критический путь: {calculationResults.criticalPath?.join(' → ') || 'Не определен'}
                </AlertDescription>
              </Alert>
            )}

            {/* Ошибки валидации */}
            {validationErrors.length > 0 && (
              <Alert className="mt-4 border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>Ошибки валидации:</strong>
                  <ul className="list-disc list-inside mt-2">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Основные вкладки */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6">
            <TabsTrigger value="input" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Ввод работ</span>
            </TabsTrigger>
            <TabsTrigger value="network" className="flex items-center gap-2">
              <Network className="h-4 w-4" />
              <span className="hidden sm:inline">Сетевой график</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">Результаты</span>
            </TabsTrigger>
            <TabsTrigger value="gantt" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Диаграмма Ганта</span>
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Анализ</span>
            </TabsTrigger>
            <TabsTrigger value="tools" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Инструменты</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="input" className="space-y-4">
            <TaskInput 
              tasks={project.tasks}
              onTasksChange={(updatedTasks) => setProject(prev => ({ ...prev, tasks: updatedTasks }))}
            />
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            {calculationResults ? (
              <CalculationResults results={calculationResults} project={project} />
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Calculator className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">
                    Выполните расчет параметров для просмотра результатов
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="network" className="space-y-4">
            {calculationResults ? (
              <div ref={networkDiagramRef}>
                <NetworkDiagram results={calculationResults} />
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Network className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">
                    Выполните расчет параметров для построения сетевого графика
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="gantt" className="space-y-4">
            {calculationResults ? (
              <GanttChart results={calculationResults} />
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">
                    Выполните расчет параметров для построения диаграммы Ганта
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            <Tabs defaultValue="dashboard" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dashboard">Дашборд</TabsTrigger>
                <TabsTrigger value="resources">Ресурсы</TabsTrigger>
                <TabsTrigger value="what-if">Что-если</TabsTrigger>
              </TabsList>
              
              <TabsContent value="dashboard">
                {calculationResults ? (
                  <ProjectDashboard results={calculationResults} project={project} />
                ) : (
                  <Card>
                    <CardContent className="text-center py-8">
                      <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500">
                        Выполните расчет параметров для просмотра дашборда проекта
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              
              <TabsContent value="resources">
                {calculationResults ? (
                  <ResourceManagement results={calculationResults} project={project} />
                ) : (
                  <Card>
                    <CardContent className="text-center py-8">
                      <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500">
                        Выполните расчет параметров для анализа ресурсов
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              
              <TabsContent value="what-if">
                <WhatIfModeling 
                  originalProject={project}
                  originalResults={calculationResults}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="tools" className="space-y-4">
            {project.tasks.length > 0 || calculationResults ? (
              <>
            <Tabs defaultValue="calendar" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="calendar">Календарь</TabsTrigger>
                <TabsTrigger value="import-export">Импорт/Экспорт</TabsTrigger>
                <TabsTrigger value="themes">Темы</TabsTrigger>
                <TabsTrigger value="logs">Логи</TabsTrigger>
              </TabsList>
              
              <TabsContent value="calendar">
                <Calendar 
                  project={project}
                  results={calculationResults}
                  onProjectUpdate={setProject}
                />
              </TabsContent>
              
              <TabsContent value="import-export">
                <ImportExport 
                  project={project}
                  calculationResults={calculationResults}
                  onProjectImport={handleProjectImport}
                  onTasksImport={handleTasksImport}
                  networkDiagramRef={networkDiagramRef}
                />
                <EnhancedExport 
                  results={calculationResults}
                  project={project}
                  tasks={project.tasks}
                />
              </TabsContent>
              
              <TabsContent value="themes">
                <ThemeSettings />
              </TabsContent>
              
              <TabsContent value="logs">
                <LogViewer />
              </TabsContent>
            </Tabs>
              </>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Settings className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">
                    Добавьте задачи или выполните расчет для доступа к инструментам.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;

