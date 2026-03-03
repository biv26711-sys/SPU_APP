import { SPUCalculation } from './spuCalculations.js';
import { calcLaborHours } from './time.js';

export const validateNetwork = (tasks, options = {}) => {
  try {
    return SPUCalculation.validateNetwork(tasks, options);
  } catch (error) {
    return {
      isValid: false,
      errors: [error.message]
    };
  }
};

export const calculateNetworkParameters = (tasks, options = {}) => {
  try {
    return SPUCalculation.calculateNetworkParameters(tasks, options);
  } catch (error) {
    return {
      isValid: false,
      errors: [error.message],
      tasks: [],
      projectDuration: 0,
      criticalPath: []
    };
  }
};

export const validateTask = (task) => {
  const errors = [];
  
  if (!task.id || task.id.trim() === '') {
    errors.push('ID задачи не может быть пустым');
  }
  
  if (!task.name || task.name.trim() === '') {
    errors.push('Название задачи не может быть пустым');
  }
  
  if (!task.duration || task.duration <= 0) {
    errors.push('Продолжительность должна быть больше 0');
  }
  
  if (!task.numberOfPerformers || task.numberOfPerformers <= 0) {
    errors.push('Количество исполнителей должно быть больше 0');
  }
  
  if (task.id && !task.id.includes('-')) {
    errors.push('ID задачи должен быть в формате "узел1-узел2"');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateTasks = (tasks) => {
  const allErrors = [];
  
  if (!tasks || tasks.length === 0) {
    return ['Список задач не может быть пустым'];
  }
  
  tasks.forEach((task, index) => {
    const validation = validateTask(task);
    if (!validation.isValid) {
      validation.errors.forEach(error => {
        allErrors.push(`Задача ${index + 1} (${task.id || 'без ID'}): ${error}`);
      });
    }
  });
  
  const ids = tasks.map(task => task.id).filter(id => id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    allErrors.push(`Дублирующиеся ID задач: ${[...new Set(duplicateIds)].join(', ')}`);
  }
  
  return allErrors;
};

export const createProject = (id, name, tasks = []) => {
  return {
    id: id || 'project_' + Date.now(),
    name: name || 'Новый проект',
    startDate: new Date().toISOString().split('T')[0],
    tasks: tasks || [],
    criticalPath: [],
    projectDuration: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

export const createTask = (
  id,
  name,
  duration,
  laborIntensity,
  numberOfPerformers,
  predecessors = [],
  hoursPerDay = 8
) => {
  const parsedDuration = parseFloat(duration) || 0;
  const parsedPerformers = Math.max(1, parseInt(numberOfPerformers, 10) || 1);
  const parsedLabor = Number(laborIntensity);
  return {
    id: id || '',
    name: name || '',
    duration: parsedDuration,
    laborIntensity: Number.isFinite(parsedLabor)
      ? parsedLabor
      : calcLaborHours(parsedDuration, parsedPerformers, hoursPerDay),
    numberOfPerformers: parsedPerformers,
    predecessors: Array.isArray(predecessors) ? predecessors : [],
    createdAt: new Date().toISOString()
  };
};

export const findCriticalPath = (tasks) => {
  try {
    const criticalTasks = tasks.filter(task => 
      Math.abs((task.lateStart || 0) - (task.earlyStart || 0)) < 0.001
    );
    
    if (criticalTasks.length === 0) {
      return [];
    }
    
    const path = [];
    const taskMap = new Map();
    
    criticalTasks.forEach(task => {
      const [from, to] = task.id.split('-');
      if (!taskMap.has(from)) {
        taskMap.set(from, []);
      }
      taskMap.get(from).push({ task, to });
    });
    
    const allToNodes = new Set(criticalTasks.map(t => t.id.split('-')[1]));
    const startNodes = criticalTasks
      .map(t => t.id.split('-')[0])
      .filter(from => !allToNodes.has(from));
    
    if (startNodes.length === 0) {
      return criticalTasks.map(t => t.id);
    }
    
    let currentNode = startNodes[0];
    path.push(currentNode);
    
    while (taskMap.has(currentNode)) {
      const nextTasks = taskMap.get(currentNode);
      if (nextTasks.length === 0) break;
      
      const nextTask = nextTasks[0];
      path.push(nextTask.to);
      currentNode = nextTask.to;
    }
    
    return path;
  } catch (error) {
    console.error('Error finding critical path:', error);
    return [];
  }
};

export const calculateTotalLaborIntensity = (tasks) => {
  return tasks.reduce((total, task) => total + (task.laborIntensity || 0), 0);
};

export const calculateTotalPerformers = (tasks) => {
  return tasks.reduce((total, task) => total + (task.numberOfPerformers || 0), 0);
};

export const calculateAverageLoad = (tasks, projectDuration, hoursPerDay = 8) => {
  if (!projectDuration || projectDuration === 0) {
    return 0;
  }
  
  const totalLaborIntensity = calculateTotalLaborIntensity(tasks);
  const totalPerformers = calculateTotalPerformers(tasks);
  
  if (totalPerformers === 0) {
    return 0;
  }
  
  return totalLaborIntensity / (totalPerformers * projectDuration * hoursPerDay) * 100;
};

export { SPUCalculation };
