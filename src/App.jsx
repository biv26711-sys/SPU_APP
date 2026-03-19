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
  BookOpen,
  ChevronLeft,
  ChevronRight 
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { calcDurationDays, calcLaborHours, roundToOneDecimal } from './utils/time';
import logger from './utils/logger';
import useAutosave from './hooks/useAutosave';
import './App.css';

const EDGE_ID_PATTERN = /^\d+-\d+$/;
const NUMERIC_ID_PATTERN = /^\d+$/;

const parseEdgeNodes = (edgeId) => {
  const value = String(edgeId ?? '').trim();
  const match = value.match(/^(\d+)-(\d+)$/);
  if (!match) return null;
  return { from: match[1], to: match[2] };
};

const getTaskIdKind = (value) => {
  const id = String(value ?? '').trim();
  if (!id) return 'empty';
  if (EDGE_ID_PATTERN.test(id)) return 'edge';
  if (NUMERIC_ID_PATTERN.test(id)) return 'numeric';
  return 'invalid';
};

const analyzeTaskIdKinds = (tasks) => {
  let hasEdge = false;
  let hasNumeric = false;
  const invalidIds = [];

  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    const id = String(task?.id ?? '').trim();
    const kind = getTaskIdKind(id);
    if (kind === 'edge') {
      hasEdge = true;
    } else if (kind === 'numeric') {
      hasNumeric = true;
    } else if (kind === 'invalid') {
      invalidIds.push(id);
    }
  });

  if (invalidIds.length > 0) {
    return { mode: 'invalid', invalidIds: Array.from(new Set(invalidIds)) };
  }
  if (hasEdge && hasNumeric) {
    return { mode: 'mixed', invalidIds: [] };
  }
  if (hasEdge) {
    return { mode: 'edge', invalidIds: [] };
  }
  if (hasNumeric) {
    return { mode: 'numeric', invalidIds: [] };
  }
  return { mode: 'empty', invalidIds: [] };
};

const PROJECT_MODES = {
  AUTO_AOA: 'auto_aoa',
  MANUAL_AOA: 'manual_aoa',
};

const isKnownProjectMode = (value) =>
  value === PROJECT_MODES.AUTO_AOA || value === PROJECT_MODES.MANUAL_AOA;

const createDefaultProjectState = () => ({
  id: 'project_' + Date.now(),
  name: 'Новый проект',
  startDate: new Date().toISOString().split('T')[0],
  tasks: [],
  criticalPath: [],
  projectDuration: 0,
  mode: PROJECT_MODES.AUTO_AOA,
  autoModeUnlocked: false,
});

const inferProjectModeFromTasks = (tasks) => {
  const idKindInfo = analyzeTaskIdKinds(tasks);

  if (idKindInfo.mode === 'edge') {
    return PROJECT_MODES.MANUAL_AOA;
  }

  return PROJECT_MODES.AUTO_AOA;
};

const normalizeProjectState = (projectLike = {}, { hasCalculationResults = false } = {}) => {
  const defaults = createDefaultProjectState();
  const tasks = Array.isArray(projectLike?.tasks) ? projectLike.tasks : [];
  const criticalPath = Array.isArray(projectLike?.criticalPath) ? projectLike.criticalPath : [];
  const inferredMode = inferProjectModeFromTasks(tasks);
  const mode = isKnownProjectMode(projectLike?.mode) ? projectLike.mode : inferredMode;
  const idKindInfo = analyzeTaskIdKinds(tasks);
  const autoModeUnlocked = mode === PROJECT_MODES.AUTO_AOA
    ? (
        typeof projectLike?.autoModeUnlocked === 'boolean'
          ? projectLike.autoModeUnlocked
          : hasCalculationResults || idKindInfo.mode === 'mixed'
      )
    : false;

  return {
    ...defaults,
    ...projectLike,
    tasks,
    criticalPath,
    projectDuration: Number.isFinite(Number(projectLike?.projectDuration))
      ? Number(projectLike.projectDuration)
      : defaults.projectDuration,
    mode,
    autoModeUnlocked,
  };
};

const collectDuplicateTaskIds = (tasks) => {
  const seen = new Set();
  const duplicateIds = [];

  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    const id = String(task?.id ?? '').trim();
    if (!id) return;
    if (seen.has(id)) {
      duplicateIds.push(id);
      return;
    }
    seen.add(id);
  });

  return Array.from(new Set(duplicateIds));
};

const splitTasksByIdKind = (tasks) => {
  const edgeTasks = [];
  const numericTasks = [];

  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    const id = String(task?.id ?? '').trim();
    const kind = getTaskIdKind(id);
    if (kind === 'edge') {
      edgeTasks.push({ ...task, id });
    } else if (kind === 'numeric') {
      numericTasks.push({ ...task, id });
    }
  });

  return { edgeTasks, numericTasks };
};

const buildTasksForAutoMode = (tasks, { hoursPerDay = 8 } = {}) => {
  const { edgeTasks, numericTasks } = splitTasksByIdKind(tasks);

  if (numericTasks.length === 0) {
    return {
      tasks: edgeTasks,
      mode: 'edge',
      duplicateIds: collectDuplicateTaskIds(edgeTasks),
      errors: [],
    };
  }

  const convertedNumericTasks = aonToAoa(numericTasks, { hoursPerDay, createSink: true });
  if (edgeTasks.length === 0) {
    return {
      tasks: convertedNumericTasks,
      mode: 'numeric',
      duplicateIds: collectDuplicateTaskIds(convertedNumericTasks),
      errors: [],
    };
  }

  const mergedTasks = [...edgeTasks, ...convertedNumericTasks];

  return {
    tasks: mergedTasks,
    mode: 'mixed',
    duplicateIds: collectDuplicateTaskIds(mergedTasks),
    errors: [],
  };
};

const buildTasksForManualMode = (tasks) => {
  const { edgeTasks, numericTasks } = splitTasksByIdKind(tasks);

  if (numericTasks.length > 0) {
    const invalidNumericIds = numericTasks.map((task) => String(task?.id ?? '').trim()).filter(Boolean);
    return {
      tasks: [],
      mode: 'invalid',
      duplicateIds: [],
      errors: [
        'В ручном режиме автопостроение отключено.',
        `Для расчета допустимы только ID вида "N-M". Найдены числовые ID: ${invalidNumericIds.join(', ')}`,
      ],
    };
  }

  return {
    tasks: edgeTasks,
    mode: 'edge',
    duplicateIds: collectDuplicateTaskIds(edgeTasks),
    errors: [],
  };
};

const buildTasksForCalculation = (tasks, { hoursPerDay = 8, projectMode = PROJECT_MODES.AUTO_AOA } = {}) => {
  if (projectMode === PROJECT_MODES.MANUAL_AOA) {
    return buildTasksForManualMode(tasks);
  }

  return buildTasksForAutoMode(tasks, { hoursPerDay });
};

const buildResolvedEdgeBySourceId = (sourceTasks, tasksForCalc) => {
  const map = new Map();

  (Array.isArray(sourceTasks) ? sourceTasks : []).forEach((task) => {
    const sourceId = String(task?.id ?? '').trim();
    if (!sourceId) return;
    if (getTaskIdKind(sourceId) === 'edge') {
      map.set(sourceId, sourceId);
    }
  });

  (Array.isArray(tasksForCalc) ? tasksForCalc : []).forEach((task) => {
    const edgeId = String(task?.id ?? '').trim();
    if (!edgeId || getTaskIdKind(edgeId) !== 'edge') return;
    const sourceTaskId = String(task?.sourceTaskId ?? '').trim();
    if (sourceTaskId) {
      map.set(sourceTaskId, edgeId);
    }
  });

  return map;
};

const validateEdgePredecessorBinding = (sourceTasks, edgeBySourceId, normalizePredecessors) => {
  const errors = [];

  (Array.isArray(sourceTasks) ? sourceTasks : []).forEach((task) => {
    const taskId = String(task?.id ?? '').trim();
    if (getTaskIdKind(taskId) !== 'edge') return;

    const currentEdgeNodes = parseEdgeNodes(taskId);
    if (!currentEdgeNodes) return;

    const predecessors = normalizePredecessors(task);
    predecessors.forEach((predIdRaw) => {
      const predId = String(predIdRaw ?? '').trim();
      if (!predId) return;

      const predEdgeId = getTaskIdKind(predId) === 'edge'
        ? predId
        : String(edgeBySourceId.get(predId) ?? '').trim();
      const predEdgeNodes = parseEdgeNodes(predEdgeId);

      if (!predEdgeNodes) {
        errors.push(
          `Для дуги ${taskId} не удалось сопоставить предшественник ${predId} с форматом N-M.`
        );
        return;
      }
      if (predEdgeNodes.to !== currentEdgeNodes.from) {
        errors.push(
          `Для дуги ${taskId} предшественник ${predId} (${predEdgeId}) должен оканчиваться в узле ${currentEdgeNodes.from}.`
        );
      }
    });
  });

  return Array.from(new Set(errors));
};

function App() {
  const [project, setProject] = useState(() => createDefaultProjectState());
  const [resourceLimit, setResourceLimit] = useState(10);
  const [lastNumericLimit, setLastNumericLimit] = useState(10); 
  const [hoursPerDay, setHoursPerDay] = useState(8);
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
  const networkExportRef = useRef(null);
  const ganttExportRef = useRef(null);
  const userGuideRef = useRef(null);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const { loadAutosavedData, clearAutosavedData, hasAutosavedData } = useAutosave(project, calculationResults);
  const [isGostModalOpen, setGostModalOpen] = useState(false);
  const tabsListRef = useRef(null);
  const [isTabsOverflowing, setIsTabsOverflowing] = useState(false);
  const [isTabsAtStart, setIsTabsAtStart] = useState(true);
  const [isTabsAtEnd, setIsTabsAtEnd] = useState(false);
  const [missingDepsDialogOpen, setMissingDepsDialogOpen] = useState(false);
  const [missingDepsInfo, setMissingDepsInfo] = useState({ missingIds: [], byTask: [] });
  const [currentMissingTaskIndex, setCurrentMissingTaskIndex] = useState(0);
  const [manualPredecessorSelections, setManualPredecessorSelections] = useState(['']);
  const [missingDepsDialogError, setMissingDepsDialogError] = useState('');
  const [isResolvingMissingDeps, setIsResolvingMissingDeps] = useState(false);

  const updateTabsScrollState = () => {
    const el = tabsListRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 1;
    setIsTabsOverflowing(hasOverflow);
    if (!hasOverflow) {
      setIsTabsAtStart(true);
      setIsTabsAtEnd(true);
      return;
    }
    setIsTabsAtStart(el.scrollLeft <= 1);
    setIsTabsAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  };

  const scrollTabs = (direction) => {
    const el = tabsListRef.current;
    if (!el) return;
    const delta = Math.round(el.clientWidth * 0.7);
    el.scrollBy({ left: direction === 'left' ? -delta : delta, behavior: 'smooth' });
  };


  useEffect(() => {
  const off = window.electronAPI?.onMenuShowGost?.(() => {
    setGostModalOpen(true); 
  });
  return () => {
    window.electronAPI?.removeAllListeners?.('menu-show-gost');
  };
}, []);

  useEffect(() => {
    let didChange = false;
    const updatedTasks = project.tasks.map(task => {
      const laborHours = Number.isFinite(+task.laborIntensity) ? +task.laborIntensity : null;
      const parsedPerformers = parseInt(task.numberOfPerformers, 10);
      const performers = Number.isFinite(parsedPerformers) ? Math.max(0, parsedPerformers) : 0;
      if (performers > 0 && laborHours != null && laborHours > 0) {
        const duration = calcDurationDays(laborHours, performers, hoursPerDay);
        if (Number.isFinite(duration) && duration !== task.duration) {
          didChange = true;
          return { ...task, duration };
        }
      }
      return task;
    });

    if (!didChange) return;
    setProject(prev => ({ ...prev, tasks: updatedTasks }));
    setCalculationResults(null);
    setBaselinePlan(null);
    setValidationErrors([]);
  }, [hoursPerDay, project.tasks]);

  useEffect(() => {
    const el = tabsListRef.current;
    if (!el) return;
    const handleResize = () => updateTabsScrollState();
    const handleScroll = () => updateTabsScrollState();
    updateTabsScrollState();
    window.addEventListener('resize', handleResize);
    el.addEventListener('scroll', handleScroll, { passive: true });
    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateTabsScrollState());
      resizeObserver.observe(el);
    }
    return () => {
      window.removeEventListener('resize', handleResize);
      el.removeEventListener('scroll', handleScroll);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
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
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });

    const networkSource = networkExportRef.current || networkDiagramRef.current;
    const ganttSource = ganttExportRef.current || ganttChartRef.current;
    const networkImagePromise = networkSource?.getAsBase64();
    const ganttImagePromise = ganttSource?.getAsBase64();
    const ganttImagesPromise = ganttSource?.getPaginatedBase64?.() || [];

    const [networkImage, ganttImage, ganttImages] = await Promise.all([
      networkImagePromise,
      ganttImagePromise,
      ganttImagesPromise,
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
      ganttImages: ganttImages,
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
        version: '1.1'
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
              const nextCalculationResults = projectData.calculationResults || null;
              setProject(
                normalizeProjectState(projectData.project, {
                  hasCalculationResults: Boolean(nextCalculationResults),
                })
              );
              setCalculationResults(nextCalculationResults);
              
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
      const parsedPerformers = parseInt(task.numberOfPerformers, 10);
      const performers = Number.isFinite(parsedPerformers) ? Math.max(0, parsedPerformers) : 0;
      const isDummyTask = performers === 0;
      const newTask = {
        ...task,
        id: task.id || `${task.from}-${task.to}`,
        laborIntensity: isDummyTask
          ? 0
          : (Number.isFinite(+task.laborIntensity)
              ? +task.laborIntensity
              : calcLaborHours(task.duration, performers, hoursPerDay)),
        numberOfPerformers: performers,
        isDummy: isDummyTask,
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

  const normalizePredecessors = (task) => {
    if (Array.isArray(task?.predecessors)) {
      return task.predecessors.map(p => String(p).trim()).filter(Boolean);
    }
    if (typeof task?.predecessors === 'string' && task.predecessors.trim()) {
      return task.predecessors
        .split(',')
        .map(p => String(p).trim())
        .filter(Boolean);
    }
    return [];
  };

  const getTaskOrderIndexMap = (tasks) => {
    const map = new Map();
    (Array.isArray(tasks) ? tasks : []).forEach((task, index) => {
      const id = String(task?.id ?? '').trim();
      if (id && !map.has(id)) map.set(id, index);
    });
    return map;
  };

  const findPredecessorOrderViolations = (tasks) => {
    const list = Array.isArray(tasks) ? tasks : [];
    const indexMap = getTaskOrderIndexMap(list);
    const errors = [];

    list.forEach((task, taskIndex) => {
      const taskId = String(task?.id ?? '').trim();
      if (!taskId) return;
      const badPreds = normalizePredecessors(task)
        .filter(predId => indexMap.has(predId) && indexMap.get(predId) >= taskIndex);
      if (badPreds.length > 0) {
        errors.push(`Для задачи ${taskId} предшественники должны быть выше по списку: ${badPreds.join(', ')}`);
      }
    });

    return errors;
  };

  const getMissingPredecessorInfo = (tasks) => {
    const list = Array.isArray(tasks) ? tasks : [];
    const tasksById = new Map();
    list.forEach(task => {
      const id = String(task?.id ?? '').trim();
      if (id && !tasksById.has(id)) tasksById.set(id, task);
    });
    const byTask = [];

    list.forEach(task => {
      const taskId = String(task?.id ?? '').trim();
      if (!taskId) return;
      const predecessors = normalizePredecessors(task);
      const taskTemplateId = String(task?.templateId ?? '').trim();
      const isTemplateStrictMode = taskTemplateId && task?.predecessorBindingMode !== 'manual';
      const existingForTask = [];
      const missingForTask = [];
      predecessors.forEach(predId => {
        const candidate = tasksById.get(predId);
        if (!candidate) {
          missingForTask.push(predId);
          return;
        }

        if (!isTemplateStrictMode) {
          existingForTask.push(predId);
          return;
        }

        const candidateTemplateId = String(candidate?.templateId ?? '').trim();
        if (candidateTemplateId && candidateTemplateId === predId) {
          existingForTask.push(predId);
          return;
        }

        missingForTask.push(predId);
      });
      const uniqueExisting = Array.from(new Set(existingForTask));
      const uniqueMissing = Array.from(new Set(missingForTask));
      if (uniqueMissing.length > 0 && uniqueExisting.length === 0) {
        byTask.push({
          taskId,
          taskName: String(task?.name ?? ''),
          missingIds: uniqueMissing,
        });
      }
    });

    const missingIds = Array.from(new Set(byTask.flatMap(item => item.missingIds))).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    return {
      missingIds,
      byTask,
    };
  };

  const applyManualPredecessorMappingForTask = (tasks, targetTaskId, selectedPredecessors) => {
    const list = Array.isArray(tasks) ? tasks : [];
    const orderIndexMap = getTaskOrderIndexMap(list);
    const idPool = new Set(orderIndexMap.keys());
    const targetIndex = orderIndexMap.get(targetTaskId);

    if (!Number.isInteger(targetIndex)) {
      return { ok: false, reason: 'target_not_found', tasks };
    }

    const manualSelected = (Array.isArray(selectedPredecessors) ? selectedPredecessors : [])
      .map(id => String(id || '').trim())
      .filter(Boolean);

    if (manualSelected.length === 0) {
      return { ok: false, reason: 'at_least_one_required', tasks };
    }

    const mappedTasks = list.map(task => {
      const taskId = String(task?.id ?? '').trim();
      if (taskId !== targetTaskId) return task;

      const originalPreds = normalizePredecessors(task);
      const preservedExisting = originalPreds.filter(predId =>
        idPool.has(predId) && predId !== taskId && orderIndexMap.get(predId) < targetIndex
      );
      const manualResolved = manualSelected
        .filter(predId =>
          idPool.has(predId) && predId !== taskId && orderIndexMap.get(predId) < targetIndex
        );

      return {
        ...task,
        predecessors: Array.from(new Set([...preservedExisting, ...manualResolved])),
        predecessorBindingMode: 'manual',
      };
    });

    return { ok: true, reason: '', tasks: mappedTasks };
  };

  const openMissingDepsResolver = (info, errorMessage = '', preferredTaskId = null) => {
    const byTask = Array.isArray(info?.byTask) ? info.byTask : [];
    const fallbackIndex = 0;
    const preferredIndex = preferredTaskId
      ? byTask.findIndex(item => item.taskId === preferredTaskId)
      : -1;
    const nextIndex = preferredIndex >= 0 ? preferredIndex : fallbackIndex;
    const currentTask = byTask[nextIndex] || null;

    setManualPredecessorSelections(['']);
    setMissingDepsInfo(info);
    setCurrentMissingTaskIndex(nextIndex);
    setMissingDepsDialogError(errorMessage);
    setMissingDepsDialogOpen(true);
  };

  const handleApplyManualMappingAndCalculate = async () => {
    setIsResolvingMissingDeps(true);
    setMissingDepsDialogError('');

    try {
      const sourceTasks = Array.isArray(project.tasks) ? project.tasks : [];
      const currentTask = (missingDepsInfo.byTask || [])[currentMissingTaskIndex];
      const currentTaskId = currentTask?.taskId || '';
      const currentMissingIds = currentTask?.missingIds || [];

      if (!currentTaskId || currentMissingIds.length === 0) {
        setMissingDepsDialogOpen(false);
        return;
      }

      const orderIndexMap = getTaskOrderIndexMap(sourceTasks);
      const currentIndex = orderIndexMap.get(currentTaskId);
      if (!Number.isInteger(currentIndex)) {
        setMissingDepsDialogError('Не удалось определить позицию текущей задачи в списке.');
        return;
      }

      const idPool = new Set(orderIndexMap.keys());
      const selectedEntries = manualPredecessorSelections
        .map(value => String(value || '').trim())
        .filter(Boolean);
      const uniqueSelectedEntries = Array.from(new Set(selectedEntries));
      const maxAllowedPredecessors = Math.min(Math.max(currentIndex, 0), 4);

      if (maxAllowedPredecessors === 0) {
        setMissingDepsDialogError('Для текущей задачи нет допустимых предшественников выше по списку. Измените порядок задач в списке.');
        return;
      }

      if (uniqueSelectedEntries.length > maxAllowedPredecessors) {
        setMissingDepsDialogError(
          `Можно выбрать не более ${maxAllowedPredecessors} предшественников для текущей задачи.`
        );
        return;
      }

      if (selectedEntries.length === 0) {
        setMissingDepsDialogError('Выберите вручную хотя бы одного предшественника для текущей задачи.');
        return;
      }

      if (selectedEntries.length !== uniqueSelectedEntries.length) {
        setMissingDepsDialogError('Нельзя выбирать одного и того же предшественника несколько раз.');
        return;
      }

      const invalidTargets = selectedEntries
        .filter(targetId => {
          const targetIndex = orderIndexMap.get(targetId);
          return !idPool.has(targetId) || targetId === currentTaskId || !Number.isInteger(targetIndex) || targetIndex >= currentIndex;
        })
        .map(targetId => targetId);

      if (invalidTargets.length > 0) {
        setMissingDepsDialogError(
          `Выберите корректные работы выше текущей задачи. Некорректный выбор: ${invalidTargets.join(', ')}`
        );
        return;
      }

      const mapped = applyManualPredecessorMappingForTask(
        sourceTasks,
        currentTaskId,
        uniqueSelectedEntries
      );

      if (!mapped.ok) {
        if (mapped.reason === 'at_least_one_required') {
          setMissingDepsDialogError('Выберите вручную хотя бы одного предшественника для текущей задачи.');
        } else if (mapped.reason === 'target_not_found') {
          setMissingDepsDialogError('Текущая задача не найдена в списке работ.');
        } else {
          setMissingDepsDialogError('Не удалось применить ручной выбор для текущей задачи.');
        }
        return;
      }

      setProject(prev => ({ ...prev, tasks: mapped.tasks }));
      setCalculationResults(null);
      setValidationErrors([]);

      const remaining = getMissingPredecessorInfo(mapped.tasks);
      if (remaining.missingIds.length > 0) {
        openMissingDepsResolver(remaining);
        return;
      }

      setMissingDepsDialogOpen(false);
      await handleCalculate({ skipMissingDependencyCheck: false, tasksOverride: mapped.tasks });
    } finally {
      setIsResolvingMissingDeps(false);
    }
  };

  const handleCalculate = async ({ skipMissingDependencyCheck = false, tasksOverride = null } = {}) => {
  setValidationErrors([]);

  const sourceTasks = Array.isArray(tasksOverride) ? tasksOverride : (Array.isArray(project.tasks) ? project.tasks : []);
  const idKindInfo = analyzeTaskIdKinds(sourceTasks);
  if (idKindInfo.mode === 'invalid') {
    const errors = [
      `Некорректные ID работ: ${idKindInfo.invalidIds.join(', ')}`,
      'Допустимы только форматы "N" (например, 3) или "N-M" (например, 1-2).',
    ];
    setValidationErrors(errors);
    logger.logCalculationError(new Error('Invalid task ID format'), {
      errors,
      tasksCount: sourceTasks.length,
      projectId: project.id,
    });
    setActiveTab('input');
    return;
  }
  if (!skipMissingDependencyCheck) {
    const missingInfo = getMissingPredecessorInfo(sourceTasks);
    if (missingInfo.missingIds.length > 0) {
      openMissingDepsResolver(missingInfo);
      return;
    }
  }

  const orderErrors = findPredecessorOrderViolations(sourceTasks);
  if (orderErrors.length > 0) {
    setValidationErrors(orderErrors);
    logger.logCalculationError(new Error('Predecessor order validation failed'), {
      errors: orderErrors,
      tasksCount: sourceTasks.length,
    });
    setActiveTab('input');
    return;
  }

  setIsCalculating(true);

  try { 
    logger.logUserAction('START_CALCULATION', {
      tasksCount: sourceTasks.length,
      projectId: project.id
    });

    const calcInput = buildTasksForCalculation(sourceTasks, { hoursPerDay, projectMode: project.mode });
    if (Array.isArray(calcInput.errors) && calcInput.errors.length > 0) {
      setValidationErrors(calcInput.errors);
      logger.logCalculationError(new Error('Calculation mode validation failed'), {
        errors: calcInput.errors,
        tasksCount: sourceTasks.length,
        projectId: project.id,
        projectMode: project.mode,
      });
      setActiveTab('input');
      return;
    }

    if (calcInput.duplicateIds.length > 0) {
      const errors = [
        `После подготовки работ к расчету обнаружены дубли ID дуг: ${calcInput.duplicateIds.join(', ')}`,
        project.mode === PROJECT_MODES.AUTO_AOA
          ? 'Измените конфликтующие ID. Обычно это ручные дуги, совпавшие с автосгенерированными.'
          : 'В ручном режиме каждая дуга должна иметь уникальный ID вида "N-M".',
      ];
      setValidationErrors(errors);
      logger.logCalculationError(new Error('Duplicate edge IDs after preparation'), {
        errors,
        tasksCount: sourceTasks.length,
        projectId: project.id,
        projectMode: project.mode,
      });
      setActiveTab('input');
      return;
    }

    const tasksForCalc = calcInput.tasks;
    const edgeBySourceId = buildResolvedEdgeBySourceId(sourceTasks, tasksForCalc);
    const edgeBindingErrors = validateEdgePredecessorBinding(
      sourceTasks,
      edgeBySourceId,
      normalizePredecessors
    );
    if (edgeBindingErrors.length > 0) {
      setValidationErrors(edgeBindingErrors);
      logger.logCalculationError(new Error('Edge predecessor binding validation failed'), {
        errors: edgeBindingErrors,
        tasksCount: sourceTasks.length,
        projectId: project.id,
      });
      setActiveTab('input');
      return;
    }

    const normalizedTasks = tasksForCalc.map(t => {
      const parsedPerformers = parseInt(t.numberOfPerformers, 10);
      const p = Number.isFinite(parsedPerformers) ? Math.max(0, parsedPerformers) : 0;
      const laborHours = Number.isFinite(+t.laborIntensity) ? +t.laborIntensity : null;
      const isDummy = p === 0;
      let durationDays;

      if (isDummy) {
        const d = Number.isFinite(+t.duration) ? +t.duration : 0;
        durationDays = Math.max(0, roundToOneDecimal(d || 0));
      } else if (laborHours != null && laborHours > 0) {
        durationDays = Math.max(0.1, calcDurationDays(laborHours, p, hoursPerDay));
      } else {
        const d = Number.isFinite(+t.duration) ? +t.duration : 0;
        durationDays = Math.max(0.1, roundToOneDecimal(d || 0));
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
        laborIntensity: isDummy
          ? 0
          : (laborHours != null && laborHours > 0
              ? laborHours
              : calcLaborHours(durationDays, p, hoursPerDay)),
        predecessors: preds,
      };
    });

    const validation = validateNetwork(normalizedTasks, { hoursPerDay, projectMode: project.mode });
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      logger.logCalculationError(new Error('Validation failed'), {
        errors: validation.errors,
        tasksCount: normalizedTasks.length 
      });
      return;
    }

    const result = SPUCalculation.calculateNetworkParameters(normalizedTasks, { hoursPerDay });

    if (result.isValid) {

    if (!baselinePlan) {
    
      const snapshot = {
        tasks: JSON.parse(JSON.stringify(sourceTasks)), 
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
          tasks: JSON.parse(JSON.stringify(sourceTasks)),
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
      projectDuration: result.projectDuration,
      autoModeUnlocked: prev.mode === PROJECT_MODES.AUTO_AOA ? true : prev.autoModeUnlocked,
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
      tasksCount: sourceTasks.length,
      projectId: project.id
    });
  } finally {
    setIsCalculating(false);
  }
};


  const handleLoadExample = () => {
    try {
      setProject(prev => ({
        ...prev,
        tasks: [...exampleTasks],
        criticalPath: [],
        projectDuration: 0,
        mode: PROJECT_MODES.MANUAL_AOA,
        autoModeUnlocked: false,
      }));
      setCalculationResults(null);
      setValidationErrors([]);
      
      logger.logUserAction('LOAD_EXAMPLE', {
        exampleTasksCount: exampleTasks.length
      });
    } catch (error) {
      logger.logError('LOAD_EXAMPLE_ERROR', { error: error.message });
    }
  };


  const handleLoadRequiredFromDB = async () => {
    try {
      const all = (await window.electronAPI.invoke('templates:getAllRequired')) || [];
      const required = all;

      const tasks = [];

      for (const tpl of required) {
        const req = (await window.electronAPI.invoke('templates:requiredFor', tpl.id)) || [];
        const preds = req.map(p => String(p.id));

        const hours = roundToOneDecimal((tpl.base_duration_minutes || 0) / 60);
        const days = Math.max(0.1, calcDurationDays(hours, 1, hoursPerDay));

        tasks.push({
          id: String(tpl.id),
          templateId: String(tpl.id),
          name: tpl.name,
          duration: days,
          laborIntensity: hours,
          numberOfPerformers: 1,
          predecessors: preds,
          phase: tpl.phase_id,
        });
      }

      setProject(prev => ({
        ...prev,
        tasks,
        criticalPath: [],
        projectDuration: 0,
        mode: PROJECT_MODES.AUTO_AOA,
        autoModeUnlocked: false,
      }));
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
      setProject(prev => ({
        ...prev,
        tasks: [],
        criticalPath: [],
        projectDuration: 0,
        autoModeUnlocked: false,
      }));
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
      setProject(
        normalizeProjectState(
          {
            ...importedProject,
            id: importedProject.id || 'imported_' + Date.now(),
          },
          { hasCalculationResults: Boolean(importedResults) }
        )
      );
      
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
      setProject(prev => normalizeProjectState({
        ...prev,
        tasks: Array.isArray(importedTasks) ? importedTasks : [],
        criticalPath: [],
        projectDuration: 0,
      }));
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
        const nextCalculationResults = recoveredData.calculationResults || null;
        setProject(
          normalizeProjectState(recoveredData.project, {
            hasCalculationResults: Boolean(nextCalculationResults),
          })
        );
        setCalculationResults(nextCalculationResults);
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

  const missingTaskQueue = Array.isArray(missingDepsInfo.byTask) ? missingDepsInfo.byTask : [];
  const activeMissingTask = missingTaskQueue[currentMissingTaskIndex] || null;
  const activeMissingIds = activeMissingTask?.missingIds || [];
  const activeTaskOrderIndex = (() => {
    const map = getTaskOrderIndexMap(project.tasks);
    return activeMissingTask ? map.get(activeMissingTask.taskId) : -1;
  })();
  const allowedManualPredecessorOptions = project.tasks
    .map(task => ({
      id: String(task?.id ?? '').trim(),
      name: task?.name,
    }))
    .filter((task, index) =>
      task.id &&
      index < activeTaskOrderIndex &&
      task.id !== activeMissingTask?.taskId
    )
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
  const maxManualPredecessors = Math.min(
    Math.max(activeTaskOrderIndex, 0),
    4,
    allowedManualPredecessorOptions.length
  );
  const hasEmptyManualSelection = manualPredecessorSelections.some(value => !String(value || '').trim());
  const canAddManualPredecessor = maxManualPredecessors > 0 &&
    manualPredecessorSelections.length < maxManualPredecessors &&
    !hasEmptyManualSelection;
  const calculatedEdgeIdByTaskId = (() => {
    const map = {};
    const tasks = Array.isArray(calculationResults?.tasks) ? calculationResults.tasks : [];
    tasks.forEach(task => {
      if (!task) return;
      const edgeId = String(task.id ?? '').trim();
      if (!looksLikeEdgeId(edgeId)) return;
      const sourceId = String(task.sourceTaskId ?? edgeId).trim();
      if (!sourceId) return;
      map[sourceId] = edgeId;
    });
    return map;
  })();

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
          <div className="tabs-list-container">
            {isTabsOverflowing && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="tabs-scroll-button"
                onClick={() => scrollTabs('left')}
                disabled={isTabsAtStart}
                aria-label="Прокрутить вкладки влево"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <TabsList ref={tabsListRef} className="tabs-list flex flex-1 w-full flex-nowrap gap-2 justify-start">
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
            {isTabsOverflowing && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="tabs-scroll-button"
                onClick={() => scrollTabs('right')}
                disabled={isTabsAtEnd}
                aria-label="Прокрутить вкладки вправо"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>

            <TabsContent value="input" className="space-y-4">
              <TaskInput 
                tasks={project.tasks}
                onTasksChange={(updatedTasks) => setProject(prev => ({ ...prev, tasks: updatedTasks }))}
                projectMode={project.mode}
                autoModeUnlocked={Boolean(project.autoModeUnlocked)}
                onProjectModeChange={(mode) => setProject(prev => ({
                  ...prev,
                  mode,
                  autoModeUnlocked: false,
                }))}
                resourceLimit={resourceLimit}
                onResourceLimitChange={setResourceLimit}
                 isLimitExceeded={isResourceLimitExceeded} 
                maxPerformers={maxPerformersPerTask} 
                 lastNumericLimit={lastNumericLimit}
                onLastNumericLimitChange={setLastNumericLimit}
                hoursPerDay={hoursPerDay}
                onHoursPerDayChange={setHoursPerDay}
                calculatedEdgeIdByTaskId={calculatedEdgeIdByTaskId}
                showCalculatedEdgeIds={!!calculationResults}
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
              <NetworkDiagram
                ref={networkDiagramRef}
                results={calculationResults}
                hoursPerDay={hoursPerDay}
              />
            ) : (
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
             {calculationResults ? ( <GanttChart ref={ganttChartRef} results={calculationResults} project={project} resourceLimit={resourceLimit}/>) : (
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
                  <ProjectDashboard results={calculationResults} project={project} hoursPerDay={hoursPerDay} />
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
                  <ResourceManagement results={calculationResults} project={project} hoursPerDay={hoursPerDay} />
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
                  hoursPerDay={hoursPerDay}
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
                    ganttExportRef={ganttExportRef}
                    networkExportRef={networkExportRef}
                    hoursPerDay={hoursPerDay}
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
      <Dialog
        open={missingDepsDialogOpen}
        onOpenChange={(open) => {
          if (isResolvingMissingDeps) return;
          setMissingDepsDialogOpen(open);
          if (!open) {
            setMissingDepsDialogError('');
            setManualPredecessorSelections(['']);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Найдены отсутствующие предшественники</DialogTitle>
            <DialogDescription>
              В проекте есть ссылки на предшественников, которых нет в текущем списке работ.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-medium">
                Шаг {Math.min(currentMissingTaskIndex + 1, Math.max(missingTaskQueue.length, 1))} из {Math.max(missingTaskQueue.length, 1)}
              </div>
              {activeMissingTask ? (
                <div className="mt-1">
                  Обрабатывается задача: <span className="font-medium">{activeMissingTask.taskId}</span>
                  {activeMissingTask.taskName ? ` (${activeMissingTask.taskName})` : ''}
                </div>
              ) : (
                <div className="mt-1">Нет активной задачи для обработки.</div>
              )}
              <div className="mt-1 text-muted-foreground">
                Достаточно выбрать хотя бы одного предшественника для задачи.
              </div>
              <div className="mt-1 text-muted-foreground">
                Для выбора доступны только задачи, расположенные раньше текущей. Поля можно добавлять кнопкой "+".
              </div>
              <div className="mt-1 text-muted-foreground">
                Максимум предшественников: {maxManualPredecessors}.
              </div>
            </div>

            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {manualPredecessorSelections.map((selectedValue, rowIndex) => (
                <div key={`manual-pred-${rowIndex}`} className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-2 items-center">
                  <div className="text-sm font-medium">Предшественник {rowIndex + 1}</div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedValue}
                      onChange={(e) => {
                        const nextValue = String(e.target.value || '').trim();
                        const duplicateInOtherRow = manualPredecessorSelections
                          .some((value, index) => index !== rowIndex && String(value || '').trim() === nextValue);
                        if (duplicateInOtherRow) {
                          setMissingDepsDialogError('Этот предшественник уже выбран в другом поле.');
                          return;
                        }
                        setMissingDepsDialogError('');
                        setManualPredecessorSelections(prev => {
                          const next = [...prev];
                          next[rowIndex] = nextValue;
                          return next;
                        });
                      }}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      disabled={isResolvingMissingDeps}
                    >
                      <option value="">Выберите работу из текущего списка</option>
                      {allowedManualPredecessorOptions
                        .filter(task => {
                          const selectedInOtherRows = new Set(
                            manualPredecessorSelections
                              .map((value, index) => index === rowIndex ? '' : String(value || '').trim())
                              .filter(Boolean)
                          );
                          return task.id === selectedValue || !selectedInOtherRows.has(task.id);
                        })
                        .map(task => (
                        <option key={`${rowIndex}:${task.id}`} value={task.id}>
                          {task.id} - {task.name}
                        </option>
                      ))}
                    </select>
                    {manualPredecessorSelections.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setManualPredecessorSelections(prev => prev.filter((_, i) => i !== rowIndex))
                        }
                        disabled={isResolvingMissingDeps}
                      >
                        -
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setManualPredecessorSelections(prev => [...prev, ''])}
                disabled={isResolvingMissingDeps || !canAddManualPredecessor}
              >
                + Добавить предшественника
              </Button>
              {hasEmptyManualSelection && maxManualPredecessors > 0 && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Новое поле можно добавить только после заполнения текущего.
                </div>
              )}
            </div>

            {missingDepsDialogError && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {missingDepsDialogError}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMissingDepsDialogOpen(false)}
              disabled={isResolvingMissingDeps}
            >
              Отмена
            </Button>
            <Button
              type="button"
              onClick={handleApplyManualMappingAndCalculate}
              disabled={isResolvingMissingDeps || activeMissingIds.length === 0}
            >
              Применить для этой задачи
            </Button>
          </div>
        </DialogContent>
      </Dialog>
       <UserGuide ref={userGuideRef} />
        <GostViewer open={isGostModalOpen} onOpenChange={setGostModalOpen} />
       {calculationResults && (
  <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', zIndex: -1, width: '1600px', background: '#ffffff' }}>
    <NetworkDiagram
      ref={networkExportRef}
      results={calculationResults}
      hoursPerDay={hoursPerDay}
    />
    <GanttChart
      ref={ganttExportRef}
      results={calculationResults}
      project={project}
      resourceLimit={resourceLimit}
    />
  </div>
)}
    </div>
  );
}

export default App;
