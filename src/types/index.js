export const createTask = (id, name, duration, laborIntensity, numberOfPerformers, predecessors = []) => ({
  id,
  name,
  duration, 
  laborIntensity,
  numberOfPerformers, 
  predecessors, 
  earlyStart: null,
  earlyFinish: null,
  lateStart: null,
  lateFinish: null,
  totalFloat: null,
  freeFloat: null, 
  isCritical: false,
});

export const createProject = (id, name, tasks = [], startDate = new Date()) => ({
  id,
  name,
  tasks,
  startDate,
  criticalPath: [], 
  projectDuration: null,
});

export const createEvent = (id, name) => ({
  id,
  name,
  earlyTime: null,
  lateTime: null,
  timeReserve: null,
});

export const sampleTasks = [
  createTask('1-2', 'Работа 1-2', 16.4, 16.4, 1, []),
  createTask('1-3', 'Работа 1-3', 24.6, 98.4, 4, []),
  createTask('2-4', 'Работа 2-4', 82.0, 82.0, 1, ['1-2']),
  createTask('2-5', 'Работа 2-5', 24.6, 24.6, 1, ['1-2']),
  createTask('3-2', 'Работа 3-2', 32.8, 65.6, 2, ['1-3']),
  createTask('3-5', 'Работа 3-5', 131.2, 393.6, 3, ['1-3']),
  createTask('4-6', 'Работа 4-6', 41.0, 164.0, 4, ['2-4']),
  createTask('5-6', 'Работа 5-6', 41.0, 41.0, 1, ['2-5', '3-5']),
];

export const sampleProject = createProject(
  'project-1',
  'Пример проекта СПУ',
  sampleTasks,
  new Date()
);

