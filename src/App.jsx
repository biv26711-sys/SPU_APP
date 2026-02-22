import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { aonToAoa, looksLikeEdgeId } from '@/utils/converting'; 
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
  HelpCircle, 
  Users,
  Save,
  ScrollText,
  BookOpen 
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import GostViewer from './components/GostViewer';
import TaskInput from './components/TaskInput';
import CalculationResults from './components/CalculationResults';
import NetworkDiagram from './components/NetworkDiagram';
import GanttChart from './components/GanttChart';
import LogViewer from './components/LogViewer';
import ProjectDashboard from './components/ProjectDashboard';
import Calendar from './components/Calendar';
import ResourceManagement from './components/ResourceManagement';
import EnhancedExport from './components/EnhancedExport';
import { generateAndSaveWordReport } from './utils/exportService';
import ResourceCalendar from './components/ResourceCalendar';
import ThemeSettings from './components/ThemeSettings';
import WhatIfModeling from './components/WhatIfModeling';
import UserGuide from './components/UserGuide';
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
  const [resourceLimit, setResourceLimit] = useState(10);
  const [lastNumericLimit, setLastNumericLimit] = useState(10); 
  const [hoursPerDay, setHoursPerDay] = useState(6);
  const [shouldRecalcAfterHoursChange, setShouldRecalcAfterHoursChange] = useState(false);
  const maxPerformersPerTask = project.tasks.reduce((max, task) => Math.max(max, task.numberOfPerformers), 0);
  const isResourceLimitExceeded = maxPerformersPerTask > resourceLimit;

  const [baselinePlan, setBaselinePlan] = useState(null);
  const [calculationResults, setCalculationResults] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [activeTab, setActiveTab] = useState('input');
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [appZoom, setAppZoom] = useState(1);
  const networkDiagramRef = useRef(null);
  const ganttChartRef = useRef(null);
  const userGuideRef = useRef(null);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const { loadAutosavedData, clearAutosavedData, hasAutosavedData } = useAutosave(project, calculationResults);
  const [isGostModalOpen, setGostModalOpen] = useState(false);

  useEffect(() => {
    const source = Array.isArray(project.tasks) ? project.tasks : [];
    let changed = false;
    const tasks = source.map(t => {
      const laborHours = Number.isFinite(+t.laborIntensity) ? +t.laborIntensity : null;
      if (laborHours == null || laborHours <= 0) return t;
      const performers = Math.max(1, parseInt(t.numberOfPerformers, 10) || 1);
      const durationDays = Math.max(1, Math.ceil(laborHours / (hoursPerDay * performers)));
      if (t.duration === durationDays) return t;
      changed = true;
      return { ...t, duration: durationDays };
    });
    if (!changed) return;
    setProject(prev => ({ ...prev, tasks, criticalPath: [], projectDuration: 0 }));
    setCalculationResults(null);
    setValidationErrors([]);
  }, [hoursPerDay, project.tasks]);


  useEffect(() => {
  const off = window.electronAPI?.onMenuShowGost?.(() => {
    setGostModalOpen(true); 
  });
  return () => {
    window.electronAPI?.removeAllListeners?.('menu-show-gost');
  };
}, []);

  useEffect(() => {
    logger.logSystemEvent('APP_MOUNTED', {
      projectId: project.id,
      timestamp: new Date().toISOString()
    });

    if (hasAutosavedData()) {
      setShowRecoveryDialog(true);
    }
  }, []);
  useEffect(() => {
    const off = window.electronAPI?.onMenuSaveProject?.(() => {
      handleSaveProject();
    });
 
    return () => {
      window.electronAPI?.removeAllListeners?.('menu-save-project');
    };
  }, []); 

  useEffect(() => {
    const off = window.electronAPI?.onMenuExportWord?.(() => {
      if (!isExportingWord && project.tasks.length > 0) {
        handleExportToWord(); 
      }
    });

    return () => {
      window.electronAPI?.removeAllListeners?.('menu-export-word');
    };
  }, [isExportingWord, project.tasks]);

   useEffect(() => {
    const off = window.electronAPI?.onMenuCalculate?.(() => {
    
      if (project.tasks.length > 0 && !isCalculating) {
        handleCalculate();
      }
    });
  
    return () => {
      window.electronAPI?.removeAllListeners?.('menu-calculate');
    };
  }, [project.tasks, isCalculating]); 


  useEffect(() => {
    const offBasic = window.electronAPI?.onMenuLoadExampleBasic?.(() => {
      handleLoadExample();
    });
    const offRequired = window.electronAPI?.onMenuLoadExampleRequired?.(() => {
      handleLoadRequiredFromDB();
    });
    
    return () => {
      window.electronAPI?.removeAllListeners?.('menu-load-example-basic');
      window.electronAPI?.removeAllListeners?.('menu-load-example-required');
    };
  }, []); 

  useEffect(() => {
    const off = window.electronAPI?.onMenuClearAll?.(() => {
      handleClearAll();
    });
    return () => {
      window.electronAPI?.removeAllListeners?.('menu-clear-all');
    };
  }, []);

  

 const handleExportToWord = async () => {
  if (!calculationResults) {
    alert("Сначала выполните расчет, чтобы экспортировать отчет.");
    return;
  }
  setIsExportingWord(true);

  try {
    const networkImagePromise = networkDiagramRef.current?.getAsBase64();
    const ganttImagePromise = ganttChartRef.current?.getAsBase64();

    const [networkImage, ganttImage] = await Promise.all([
      networkImagePromise,
      ganttImagePromise,
    ]);

    const baselineData = baselinePlan
      ? {
          tasks: baselinePlan.tasks, 
          results: baselinePlan.results,
        }
      : null;

    const optimizedData = {
      tasks: project.tasks, 
      results: calculationResults,
      networkImage: networkImage,
      ganttImage: ganttImage,
    };

    await generateAndSaveWordReport({
      baseline: baselineData,
      optimized: optimizedData,
    });

  } catch (error) {
    console.error("Критическая ошибка при экспорте в Word:", error);
    alert("Произошла непредвиденная ошибка при подготовке данных для отчета.");
  } finally {
    setIsExportingWord(false);
  }
};


  useEffect(() => {
    const off = window.electronAPI?.onMenuLoadExampleBasic?.(() => {
      handleLoadExample();
    });
    return () => {
      window.electronAPI?.removeAllListeners?.('menu-load-example-basic');
    };
  }, []);
  

  
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


  useEffect(() => {
    const off = window.electronAPI?.onMenuShowHelp?.(() => {
      handleLoadHelp();
    });
    return () => {
      window.electronAPI?.removeAllListeners?.('menu-show-help');
    };
  }, []);
  

 
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setAppZoom(prev => Math.min(prev + 0.1, 2));
        } else if (e.key === '-') {
          e.preventDefault();
          setAppZoom(prev => Math.max(prev - 0.1, 0.5));
        } else if (e.key === 's') {
          e.preventDefault();
          handleSaveProject();
        } else if (e.key === 'o') {
          e.preventDefault();
          handleOpenProject();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

 
  const handleSaveProject = () => {
    try {
      const projectData = {
        project,
        calculationResults,
        savedAt: new Date().toISOString(),
        version: '1.0'
      };
      
      const dataStr = JSON.stringify(projectData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `${project.name || 'project'}_${new Date().toISOString().split('T')[0]}.spu`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      logger.logSystemEvent('PROJECT_SAVED', {
        projectId: project.id,
        tasksCount: project.tasks.length
      });
      
      alert('Проект успешно сохранен!');
    } catch (error) {
      logger.logError('PROJECT_SAVE_ERROR', { error: error.message });
      alert('Ошибка при сохранении проекта: ' + error.message);
    }
  };


  const handleOpenProject = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.spu,.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const projectData = JSON.parse(e.target.result);
            
            if (projectData.project && projectData.project.tasks) {
              setProject(projectData.project);
              if (projectData.calculationResults) {
                setCalculationResults(projectData.calculationResults);
              }
              
              logger.logSystemEvent('PROJECT_LOADED', {
                projectId: projectData.project.id,
                tasksCount: projectData.project.tasks.length
              });
              
              alert('Проект успешно загружен!');
            } else {
              throw new Error('Неверный формат файла проекта');
            }
          } catch (error) {
            logger.logError('PROJECT_LOAD_ERROR', { error: error.message });
            alert('Ошибка при загрузке проекта: ' + error.message);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleAddTask = (task) => {
    try {
      const newTask = {
        ...task,
        id: task.id || `${task.from}-${task.to}`,
        laborIntensity: task.laborIntensity || task.duration * hoursPerDay,
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

 
  const chooseExampleVariant = async () => {
   
    if (!window.electronAPI?.showMessageBox) {
      const choice = confirm('Загрузить базовый пример? (OK - базовый пример, Отмена - пример рабочих данных)');
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


  const handleHoursPerDayChange = (nextHours) => {
    setHoursPerDay(nextHours);
    setShouldRecalcAfterHoursChange(true);
  };

  const handleCalculate = async () => {
  setIsCalculating(true);
  setValidationErrors([]);

  try { 
    logger.logUserAction('START_CALCULATION', {
      tasksCount: project.tasks.length,
      projectId: project.id
    });

    const source = Array.isArray(project.tasks) ? project.tasks : [];
    const needsAdapt = source.some(t => !looksLikeEdgeId(String(t.id)));
    const tasksForCalc = needsAdapt ? aonToAoa(source, { hoursPerDay, createSink: true }) : source;
    const HOURS_PER_DAY = hoursPerDay;
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

    const validation = validateNetwork(normalizedTasks);
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      logger.logCalculationError(new Error('Validation failed'), {
        errors: validation.errors,
        tasksCount: normalizedTasks.length 
      });
      return;
    }

    const result = SPUCalculation.calculateNetworkParameters(normalizedTasks);

    if (result.isValid) {

    if (!baselinePlan) {
    
      const snapshot = {
        tasks: JSON.parse(JSON.stringify(project.tasks)), 
        results: JSON.parse(JSON.stringify(result)),      
    
        networkImage: null,
        ganttImage: null,
      };
      setBaselinePlan(snapshot);

      setCalculationResults(result);
    
      alert('Расчет выполнен. План зафиксирован как базовый.');

    } else {
    
      const userChoice = confirm(
        'Расчет выполнен успешно!\n\n' +
        'Хотите обновить "базовый" план этим новым результатом?\n\n' +
        '• Нажмите "OK", чтобы этот результат стал новым базовым планом для сравнения.\n' +
        '• Нажмите "Отмена", чтобы считать этот результат "оптимизацией" (старый базовый план останется для отчета).'
      );

      if (userChoice) {
      
        const snapshot = {
          tasks: JSON.parse(JSON.stringify(project.tasks)),
          results: JSON.parse(JSON.stringify(result)),
          networkImage: null,
          ganttImage: null,
        };
        setBaselinePlan(snapshot);
        setCalculationResults(result);
        alert('Базовый план обновлен.');
      } else {
        
        setCalculationResults(result);
        alert('Расчет выполнен как "оптимизация". Базовый план для сравнения не изменился.');
      }
    }


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

  useEffect(() => {
    if (!shouldRecalcAfterHoursChange) return;
    if (project.tasks.length === 0) {
      setShouldRecalcAfterHoursChange(false);
      return;
    }
    if (isCalculating || isResourceLimitExceeded) return;
    setShouldRecalcAfterHoursChange(false);
    handleCalculate();
  }, [shouldRecalcAfterHoursChange, hoursPerDay]);


  const handleLoadRequiredFromDB = async () => {
    try {
      const all = (await window.electronAPI.invoke('templates:getAllRequired')) || [];
      const required = all;

      const tasks = [];

      for (const tpl of required) {
        const req = (await window.electronAPI.invoke('templates:requiredFor', tpl.id)) || [];
        const preds = req.map(p => String(p.id));

        const laborHours = (tpl.base_duration_minutes || 0) / 60;
        const performers = 1;
        const durationDays = laborHours > 0
          ? Math.max(1, Math.ceil(laborHours / (hoursPerDay * performers)))
          : 1;

        tasks.push({
          id: String(tpl.id),
          name: tpl.name,
          duration: durationDays,
          laborIntensity: laborHours > 0 ? Math.ceil(laborHours * 10) / 10 : 0,
          numberOfPerformers: performers,
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

 const handleLoadHelp = () => {
    console.log('handleLoadHelp called!');
    
    if (userGuideRef.current) {
      console.log('userGuideRef.current exists, calling open()...');
      userGuideRef.current.open();
    } else {
      console.error('userGuideRef.current is null. Is <UserGuide ref={...} /> rendered?');
    }
  };


  const handleClearAll = () => {
    try {
      setProject(prev => ({ ...prev, tasks: [], criticalPath: [], projectDuration: 0 }));
      setCalculationResults(null);
      setBaselinePlan(null);
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
    <div className="min-h-screen w-full bg-background text-foreground">
      
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

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 app-container" style={{ transform: `scale(${appZoom})` }}>
      
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Программа для сетевого планирования и управления
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
       
            <Card className="mb-6">
          <CardHeader>
            <CardTitle>Управление проектом</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <Button 
                onClick={handleCalculate} 
                disabled={project.tasks.length === 0 || isCalculating || isResourceLimitExceeded}
                className="bg-green-600 hover:bg-green-700"
                title={isResourceLimitExceeded ? `Превышен лимит исполнителей. Макс. на задаче: ${maxPerformersPerTask}, лимит: ${resourceLimit}.` : 'Рассчитать параметры проекта (F5)'}
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

              <Button onClick={handleSaveProject} variant="outline" title="Ctrl+S">
                <Save className="h-4 w-4 mr-2" />
                Сохранить проект
              </Button>

              <Button onClick={handleOpenProject} variant="outline" title="Ctrl+O">
                <Upload className="h-4 w-4 mr-2" />
                Открыть проект
              </Button>
              
              <Button onClick={handleExportToWord} variant="outline" disabled={isExportingWord || project.tasks.length === 0}>
                <FileText className="h-4 w-4 mr-2" />
                {isExportingWord ? 'Экспорт...' : 'Экспорт в Word'}
              </Button>

              <Button onClick={handleLoadHelp} variant="outline" title="F1">
                <HelpCircle className="h-4 w-4 mr-2" />
                Руководство
              </Button>

              <Button variant="outline" onClick={() => setGostModalOpen(true)} title="F2">
                <ScrollText className="h-4 w-4 mr-2" />
                ГОСТ ЕСПД
              </Button>
            </div>

            {calculationResults && (
              <Alert className="mt-4 border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>Расчет выполнен успешно</strong>
                    

                  Критический путь: {calculationResults.criticalPath?.join(' → ') || 'Не определен'}
                </AlertDescription>
              </Alert>
            )}

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
      
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
            <TabsList className="tabs-list grid w-full grid-cols-2 lg:grid-cols-7 min-w-max">
            <TabsTrigger value="input" className="tabs-trigger flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Ввод работ</span>
            </TabsTrigger>
            <TabsTrigger value="network" className="tabs-trigger flex items-center gap-2">
              <Network className="h-4 w-4" />
              <span className="hidden sm:inline">Сетевой график</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="tabs-trigger flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">Результаты</span>
            </TabsTrigger>
            <TabsTrigger value="gantt" className="tabs-trigger flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Диаграмма Ганта</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="tabs-trigger flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Календарь</span>
            </TabsTrigger>
            <TabsTrigger value="analysis" className="tabs-trigger flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Анализ</span>
            </TabsTrigger>
            <TabsTrigger value="tools" className="tabs-trigger flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Инструменты</span>
            </TabsTrigger>
          </TabsList>

            <TabsContent value="input" className="space-y-4">
              <TaskInput 
                tasks={project.tasks}
                onTasksChange={(updatedTasks) => setProject(prev => ({ ...prev, tasks: updatedTasks }))}
                resourceLimit={resourceLimit}
                onResourceLimitChange={setResourceLimit}
                 isLimitExceeded={isResourceLimitExceeded} 
                maxPerformers={maxPerformersPerTask} 
                lastNumericLimit={lastNumericLimit}
                onLastNumericLimitChange={setLastNumericLimit}
                hoursPerDay={hoursPerDay}
                onHoursPerDayChange={handleHoursPerDayChange}
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
            {calculationResults ? ( <NetworkDiagram ref={networkDiagramRef} results={calculationResults} />) : (
              <Card>
              <CardContent className="text-center py-8">
                <Network className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">
              Выполните расчет параметров для построения сетевого графика
              </p>
              </CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="gantt" className="space-y-4">
             {calculationResults ? ( <GanttChart ref={ganttChartRef} results={calculationResults} project={project} />) : (
              <Card>
                <CardContent className="text-center py-8">
                  <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">
              Выполните расчет параметров для построения диаграммы Ганта
            </p>
            </CardContent></Card>)}
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            <Tabs defaultValue="dashboard" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="dashboard">Дашборд</TabsTrigger>
                <TabsTrigger value="resources">Ресурсы</TabsTrigger>
        
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

          <TabsContent value="calendar" className="space-y-4">
            <Calendar 
              project={project}
              results={calculationResults}
              onProjectUpdate={setProject}
            />
          </TabsContent>

          <TabsContent value="tools" className="space-y-4">
            {project.tasks.length > 0 || calculationResults ? (
              <>
            <Tabs defaultValue="export" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="export">Экспорт</TabsTrigger>
                <TabsTrigger value="themes">Темы</TabsTrigger>
                <TabsTrigger value="logs">Логи</TabsTrigger>
              </TabsList>
              
              <TabsContent value="export">
               
                <EnhancedExport 
                    results={calculationResults}
                    project={project}
                    tasks={project.tasks}
                    ganttChartRef={ganttChartRef}
                    networkDiagramRef={networkDiagramRef}
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
       <UserGuide ref={userGuideRef} />
        <GostViewer open={isGostModalOpen} onOpenChange={setGostModalOpen} />
       {calculationResults && (
  <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', zIndex: -1 }}>
    <NetworkDiagram ref={networkDiagramRef} results={calculationResults} />
    <GanttChart ref={ganttChartRef} results={calculationResults} project={project} />
  </div>
)}
    </div>
  );
}

export default App;
