
import { calcLaborHours } from './time.js';

export class SPUTask {
  constructor(name, duration, from, to, laborIntensity = 0, numberOfPerformers = 1, hoursPerDay = 8) {
    this.name = name;
    this.duration = parseFloat(duration) || 0;
    this.from = from;
    this.to = to;
    const parsedPerformers = parseInt(numberOfPerformers, 10);
    this.numberOfPerformers = Number.isFinite(parsedPerformers) ? Math.max(0, parsedPerformers) : 0;
    const parsedLabor = Number(laborIntensity);
    this.laborIntensity = this.numberOfPerformers === 0
      ? 0
      : (Number.isFinite(parsedLabor)
          ? parsedLabor
          : calcLaborHours(this.duration, this.numberOfPerformers, hoursPerDay));
    this.ES = 0;
    this.EF = 0; 
    this.LS = 0; 
    this.LF = 0; 
    this._totalFloat = 0;
    this._freeFloat = 0;
  }

  get id() {
    return `${this.from}-${this.to}`;
  }

  get totalFloat() {
    return this._totalFloat;
  }

  set totalFloat(value) {
    this._totalFloat = value;
  }

  get freeFloat() {
    return this._freeFloat;
  }

  set freeFloat(value) {
    this._freeFloat = value;
  }

  get isCritical() {
    return Math.abs(this.totalFloat) < 0.001; 
  }

  get predecessors() {
    return [];
  }
}

export class SPUCalculation {
  constructor(tasks, { hoursPerDay = 8 } = {}) {
    this.tasks = tasks.map(task => {
      if (task instanceof SPUTask) {
        return task;
      }
      return new SPUTask(
        task.name || task.id,
        task.duration,
        task.id.split("-")[0],
        task.id.split("-")[1],
        task.laborIntensity,
        task.numberOfPerformers,
        hoursPerDay
      );
    });
  }

  calculateEarlyStartAndFinish() {
    const fromTo = [...new Set(this.tasks.flatMap(t => [t.from, t.to]))];

    const outgoing = {};
    
    fromTo.forEach(node => {
      outgoing[node] = [];
    });

    this.tasks.forEach(task => {
      outgoing[task.from].push(task);
    });

    const sortedNodes = this.sortNodes(fromTo, outgoing);

    const earlyEventTime = {};
    fromTo.forEach(node => {
      earlyEventTime[node] = 0;
    });

    sortedNodes.forEach(node => {
      outgoing[node].forEach(task => {
        const candidateFinish = earlyEventTime[node] + task.duration;
        earlyEventTime[task.to] = Math.max(earlyEventTime[task.to], candidateFinish);
      });
    });

    const projectDuration = Math.max(0, ...Object.values(earlyEventTime));
    const lateEventTime = {};

    fromTo.forEach(node => {
      lateEventTime[node] = projectDuration;
    });

    const reversedNodes = [...sortedNodes].reverse();

    reversedNodes.forEach(node => {
      if (outgoing[node].length === 0) {
        lateEventTime[node] = Math.min(lateEventTime[node], projectDuration);
        return;
      }

      lateEventTime[node] = Math.min(
        ...outgoing[node].map(task => lateEventTime[task.to] - task.duration)
      );
    });

    const eventReserve = {};

    fromTo.forEach(node => {
      eventReserve[node] = lateEventTime[node] - earlyEventTime[node];
    });

    this.tasks.forEach(task => {
      task.ES = earlyEventTime[task.from];
      task.EF = task.ES + task.duration;
      task.LF = lateEventTime[task.to];
      task.LS = task.LF - task.duration;

      task.totalFloat = task.LF - task.ES - task.duration;
      task.freeFloat = earlyEventTime[task.to] - task.ES - task.duration;
    });

    return {
      tasks: this.tasks,
      projectDuration: projectDuration,
      criticalPath: this.findCriticalPath(),
      nodes: fromTo,
      earlyEventTime,
      lateEventTime,
      eventReserve
    };
  }

  sortNodes(nodes, outgoing) {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (node) => {
      if (visiting.has(node)) {
        throw new Error(`Обнаружен цикл в сетевом графике в узле: ${node}`);
      }
      if (visited.has(node)) {
        return;
      }

      visiting.add(node);
      
      outgoing[node].forEach(task => {
        visit(task.to);
      });
      
      visiting.delete(node);
      visited.add(node);
      sorted.push(node);
    };

    nodes.forEach(node => {
      if (!visited.has(node)) {
        visit(node);
      }
    });

    return sorted.reverse();
  }

  findCriticalPath() {
    const criticalTasks = this.tasks.filter(task => task.isCritical);
    
    if (criticalTasks.length === 0) {
      return [];
    }

    const path = [];
    const taskMap = new Map();
    
    criticalTasks.forEach(task => {
      if (!taskMap.has(task.from)) {
        taskMap.set(task.from, []);
      }
      taskMap.get(task.from).push(task);
    });

    const allToNodes = new Set(criticalTasks.map(t => t.to));
    const startNodes = criticalTasks
      .map(t => t.from)
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
  }

  static calculateNetworkParameters(tasks, { hoursPerDay = 8 } = {}) {
    try {
      const spuTasks = tasks.map(task => {
        const [from, to] = task.id.split("-");
        return new SPUTask(
          task.name,
          task.duration,
          from,
          to,
          task.laborIntensity,
          task.numberOfPerformers,
          hoursPerDay
        );
      });

      const calculation = new SPUCalculation(spuTasks, { hoursPerDay });
      const result = calculation.calculateEarlyStartAndFinish();
      const eventTimes = {
        early: result.earlyEventTime,
        late: result.lateEventTime,
        reserve: result.eventReserve
      };

      const calculatedTasks = result.tasks.map(spuTask => {
        const sourceTask = tasks.find(t => t.id === spuTask.id);
        return {
        id: spuTask.id,
        name: spuTask.name,
        duration: spuTask.duration,
        laborIntensity: spuTask.laborIntensity,
        numberOfPerformers: spuTask.numberOfPerformers,
        predecessors: sourceTask?.predecessors || [],
        isDummy: Number(sourceTask?.numberOfPerformers) === 0 || Boolean(sourceTask?.isDummy),
        sourceTaskId: sourceTask?.sourceTaskId ?? null,
        earlyStart: spuTask.ES,
        earlyFinish: spuTask.EF,
        lateStart: spuTask.LS,
        lateFinish: spuTask.LF,
        totalFloat: spuTask.totalFloat,
        freeFloat: spuTask.freeFloat,
        isCritical: spuTask.isCritical,
        earlyEventTimeI: result.earlyEventTime[spuTask.from], 
        earlyEventTimeJ: result.earlyEventTime[spuTask.to], 
        lateEventTimeI: result.lateEventTime[spuTask.from], 
        lateEventTimeJ: result.lateEventTime[spuTask.to],
        eventReserveJ: result.eventReserve[spuTask.to]
      };
    });


      return {
        tasks: calculatedTasks,
        projectDuration: result.projectDuration,
        criticalPath: result.criticalPath,
        eventTimes,
        isValid: true,
        errors: []
      };
    } catch (error) {
      console.error('SPU Calculation Error:', error);
      return {
        tasks: [],
        projectDuration: 0,
        criticalPath: [],
        isValid: false,
        errors: [error.message]
      };
    }
  }

  static validateNetwork(tasks, { hoursPerDay = 8, projectMode = 'auto_aoa' } = {}) {
    const errors = [];
    
    if (!Array.isArray(tasks) || tasks.length === 0) { 
      errors.push("Список задач пуст");
      return { isValid: false, errors };
    }

    tasks.forEach(task => {
     
      if (!task.id || typeof task.id !== 'string' || !/^\d+-\d+$/.test(task.id.trim())) {
        errors.push(`Некорректный ID задачи: ${task.id}`);
      }

      if (!task.name || String(task.name).trim() === "") {
        errors.push(`Отсутствует название для задачи: ${task.id}`);
      }

      const dur = Number(task.duration);
      const perf = parseInt(task.numberOfPerformers, 10);
      const labor = Number(task.laborIntensity);
      const isDummy = perf === 0;

      if (isDummy) {
        if (!Number.isFinite(dur) || dur < 0) {
          errors.push(`Некорректная продолжительность для фиктивной задачи: ${task.id}`);
        }
        if (!Number.isFinite(perf) || perf !== 0) {
          errors.push(`Для фиктивной задачи количество исполнителей должно быть равно 0: ${task.id}`);
        }
        if (!Number.isFinite(labor) || labor !== 0) {
          errors.push(`Для фиктивной задачи трудоемкость должна быть равна 0: ${task.id}`);
        }
      } else {
        if (!Number.isFinite(dur) || dur < 0.1) {
          errors.push(`Некорректная продолжительность для задачи: ${task.id}`);
        }
        if (!Number.isFinite(perf) || perf <= 0) {
          errors.push(`Некорректное количество исполнителей для задачи: ${task.id}`);
        }
        if (!Number.isFinite(labor) || labor <= 0) {
          errors.push(`Для обычной задачи трудоемкость должна быть больше 0: ${task.id}`);
        }
      }
      
    });

    if (projectMode === 'manual_aoa') {
      const incoming = new Map();
      const outgoing = new Map();
      const allNodes = new Set();

      tasks.forEach(task => {
        const match = String(task?.id ?? '').trim().match(/^(\d+)-(\d+)$/);
        if (!match) return;
        const from = match[1];
        const to = match[2];
        allNodes.add(from);
        allNodes.add(to);
        outgoing.set(from, (outgoing.get(from) || 0) + 1);
        incoming.set(to, (incoming.get(to) || 0) + 1);
      });

      const startEvents = Array.from(allNodes).filter(node => !incoming.has(node));
      const endEvents = Array.from(allNodes).filter(node => !outgoing.has(node));

      if (startEvents.length !== 1 || endEvents.length !== 1) {
        errors.push(
          `больше кон/нач события, добавьте работы (начальных: ${startEvents.length}, конечных: ${endEvents.length})`
        );
      }
    }

    try {
      const spuTasks = tasks.map(task => {
        const [from, to] = String(task.id).split("-");
        return new SPUTask(
          task.name,
          Number(task.duration),
          from,
          to,
          task.laborIntensity, 
          task.numberOfPerformers,
          hoursPerDay
        );
      });
      const calculation = new SPUCalculation(spuTasks, { hoursPerDay });
      calculation.calculateEarlyStartAndFinish();
    } catch (error) {
      errors.push(error.message);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export const calculateNetworkParameters = SPUCalculation.calculateNetworkParameters;
export const validateNetwork = SPUCalculation.validateNetwork;
