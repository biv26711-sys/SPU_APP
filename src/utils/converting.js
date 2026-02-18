import { calcDurationDays, calcLaborHours } from './time';

export function looksLikeEdgeId(id) {
  return typeof id === 'string' && /^\d+-\d+$/.test(id.trim());
}

function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function normalizePredecessors(preds) {
  if (Array.isArray(preds)) return preds.map(toNum).filter(Number.isFinite);
  if (typeof preds === 'string' && preds.trim()) {
    return preds
      .split(/[,;\s]+/)
      .map((s) => toNum(s))
      .filter(Number.isFinite);
  }
  return [];
}

function topoSort(tasksById) {
  const inDeg = new Map();
  const adj = new Map();
  const ids = Array.from(tasksById.keys());

  ids.forEach((id) => {
    inDeg.set(id, 0);
    adj.set(id, []);
  });

  ids.forEach((id) => {
    const preds = tasksById.get(id).preds;
    preds.forEach((p) => {
      if (tasksById.has(p)) {
        adj.get(p).push(id);
        inDeg.set(id, (inDeg.get(id) || 0) + 1);
      }
    });
  });

  const q = [];
  ids.forEach((id) => {
    if ((inDeg.get(id) || 0) === 0) q.push(id);
  });

  q.sort((a, b) => a - b);

  const order = [];
  while (q.length) {
    const v = q.shift();
    order.push(v);
    for (const w of adj.get(v)) {
      inDeg.set(w, inDeg.get(w) - 1);
      if (inDeg.get(w) === 0) {
        const pos = q.findIndex((x) => x > w);
        if (pos === -1) q.push(w);
        else q.splice(pos, 0, w);
      }
    }
  }

  if (order.length !== ids.length) {
    const rest = ids.filter((x) => !order.includes(x)).sort((a, b) => a - b);
    order.push(...rest);
  }

  return order;
}

function convertLegacy({
  tasksById,
  order,
  phasesSorted,
  isTerminalInPhase,
  hoursPerDay,
  createSink,
}) {
  let eventCounter = 1;
  const START_EVENT = 1;
  const taskEvents = new Map();
  const aoaEdges = [];
  const processedTasks = [];

  function addDummyEdge(fromEvent, toEvent, name = 'Фиктивная') {
    aoaEdges.push({
      id: `${fromEvent}-${toEvent}`,
      name,
      duration: 0,
      numberOfPerformers: 1,
      laborIntensity: 0,
      predecessors: [],
      isDummy: true,
    });
  }

  for (const tid of order) {
    const t = tasksById.get(tid);
    const validPreds = t.preds.filter((p) => tasksById.has(p));

    let startEvent;

    if (validPreds.length === 0) {
      const curPhase = Number.isFinite(t.phase) ? t.phase : null;

      let candidates = [];
      if (curPhase != null) {
        const prevPhaseIndex = phasesSorted.indexOf(curPhase) - 1;
        if (prevPhaseIndex >= 0) {
          const prevPhase = phasesSorted[prevPhaseIndex];

          const terminalAnchors = processedTasks
            .filter(x => x && x.phase === prevPhase && isTerminalInPhase(x.id));

          if (terminalAnchors.length === 0) {
            for (let i = prevPhaseIndex - 1; i >= 0; i--) {
              const earlierPhase = phasesSorted[i];
              const earlierAnchors = processedTasks
                .filter(x => x && x.phase === earlierPhase && isTerminalInPhase(x.id));
              if (earlierAnchors.length > 0) {
                terminalAnchors.push(...earlierAnchors);
                break;
              }
            }
          }

          candidates = terminalAnchors
            .map(x => taskEvents.get(x.id)?.endEvent)
            .filter(e => Number.isFinite(e));

          if (terminalAnchors.length === 0) {
            for (let i = prevPhaseIndex - 1; i >= 0; i--) {
              const earlierPhase = phasesSorted[i];
              const earlierAnchors = processedTasks
                .filter(x => x && x.phase === earlierPhase && isTerminalInPhase(x.id));
              if (earlierAnchors.length > 0) {
                terminalAnchors.push(...earlierAnchors);
                break;
              }
            }
          }
          candidates = terminalAnchors
            .map(x => taskEvents.get(x.id)?.endEvent)
            .filter(e => Number.isFinite(e));

          if (candidates.length === 0) {
            const anyAnchors = processedTasks.filter(x => x && x.phase === prevPhase);
            candidates = anyAnchors
              .map(x => taskEvents.get(x.id)?.endEvent)
              .filter(e => Number.isFinite(e));
          }
        }
      }

      if (candidates.length === 0) {
        startEvent = START_EVENT;
      } else if (candidates.length === 1) {
        startEvent = candidates[0];
      } else {
        eventCounter += 1;
        const mergeEvent = eventCounter;
        for (const e of candidates) {
          if (e !== mergeEvent) addDummyEdge(e, mergeEvent, 'Фиктивная (якорение фазы)');
        }
        startEvent = mergeEvent;
      }
    } else {
      const ends = validPreds
        .map((pid) => taskEvents.get(pid)?.endEvent)
        .filter((e) => Number.isFinite(e));

      const uniqEnds = Array.from(new Set(ends));

      if (uniqEnds.length === 0) {
        startEvent = START_EVENT;
      } else if (uniqEnds.length === 1) {
        startEvent = uniqEnds[0];
      } else {
        eventCounter += 1;
        const mergeEvent = eventCounter;
        for (const e of uniqEnds) {
          if (e !== mergeEvent) addDummyEdge(e, mergeEvent, 'Фиктивная (слияние предков)');
        }
        startEvent = mergeEvent;
      }
    }

    eventCounter += 1;
    const endEvent = eventCounter;

    taskEvents.set(tid, { startEvent, endEvent });

    aoaEdges.push({
      id: `${startEvent}-${endEvent}`,
      name: t.name,
      duration: t.durationDays,
      numberOfPerformers: Math.max(1, parseInt(t.raw?.numberOfPerformers, 10) || 1),
      laborIntensity: Number.isFinite(+t.raw?.laborIntensity)
        ? +t.raw.laborIntensity
        : calcLaborHours(t.durationDays, t.raw?.numberOfPerformers, hoursPerDay),
      predecessors: [],
      isDummy: false,
      sourceTaskId: tid,
    });

    processedTasks.push(t);
  }

  if (createSink) {
    const allStartEvents = new Set(aoaEdges.map(e => Number(e.id.split('-')[0])));
    const allEndEvents   = new Set(aoaEdges.map(e => Number(e.id.split('-')[1])));

    const terminalEnds = Array.from(allEndEvents).filter(e => !allStartEvents.has(e));

    if (terminalEnds.length > 1) {
      eventCounter += 1;
      const SINK_EVENT = eventCounter;

      for (const e of terminalEnds) {
        aoaEdges.push({
          id: `${e}-${SINK_EVENT}`,
          name: 'Фиктивная (слияние в финиш)',
          duration: 0,
          numberOfPerformers: 1,
          laborIntensity: 0,
          predecessors: [],
          isDummy: true,
        });
      }
    }
  }

  return aoaEdges;
}

function convertTwoPass({
  tasksById,
  order,
  phasesSorted,
  isTerminalInPhase,
  hoursPerDay,
  createSink,
}) {
  let eventCounter = 1;
  const START_EVENT = 1;
  const taskEvents = new Map();
  const aoaEdges = [];
  const allTasks = Array.from(tasksById.values());
  const terminalCache = new Map();

  function addDummyEdge(fromEvent, toEvent, name = 'Фиктивная') {
    aoaEdges.push({
      id: `${fromEvent}-${toEvent}`,
      name,
      duration: 0,
      numberOfPerformers: 1,
      laborIntensity: 0,
      predecessors: [],
      isDummy: true,
    });
  }

  function getTerminalAnchorsForPhase(phase) {
    if (!Number.isFinite(phase)) return [];
    if (terminalCache.has(phase)) return terminalCache.get(phase);
    const anchors = allTasks.filter(t => t && t.phase === phase && isTerminalInPhase(t.id));
    terminalCache.set(phase, anchors);
    return anchors;
  }

  for (const tid of order) {
    eventCounter += 1;
    taskEvents.set(tid, { endEvent: eventCounter });
  }

  for (const tid of order) {
    const t = tasksById.get(tid);
    const validPreds = t.preds.filter((p) => tasksById.has(p));

    let startEvent;

    if (validPreds.length === 0) {
      const curPhase = Number.isFinite(t.phase) ? t.phase : null;

      let candidates = [];
      if (curPhase != null) {
        const prevPhaseIndex = phasesSorted.indexOf(curPhase) - 1;
        if (prevPhaseIndex >= 0) {
          const prevPhase = phasesSorted[prevPhaseIndex];
          let terminalAnchors = getTerminalAnchorsForPhase(prevPhase);
          if (terminalAnchors.length === 0) {
            for (let i = prevPhaseIndex - 1; i >= 0; i--) {
              const earlierPhase = phasesSorted[i];
              const earlierAnchors = getTerminalAnchorsForPhase(earlierPhase);
              if (earlierAnchors.length > 0) {
                terminalAnchors = earlierAnchors;
                break;
              }
            }
          }
          candidates = terminalAnchors
            .map(x => taskEvents.get(x.id)?.endEvent)
            .filter(e => Number.isFinite(e));
        }
      }

      if (candidates.length === 0) {
        startEvent = START_EVENT;
      } else if (candidates.length === 1) {
        startEvent = candidates[0];
      } else {
        eventCounter += 1;
        const mergeEvent = eventCounter;
        for (const e of candidates) {
          if (e !== mergeEvent) addDummyEdge(e, mergeEvent, 'Фиктивная (якорение фазы)');
        }
        startEvent = mergeEvent;
      }
    } else {
      const ends = validPreds
        .map((pid) => taskEvents.get(pid)?.endEvent)
        .filter((e) => Number.isFinite(e));

      const uniqEnds = Array.from(new Set(ends));

      if (uniqEnds.length === 0) {
        startEvent = START_EVENT;
      } else if (uniqEnds.length === 1) {
        startEvent = uniqEnds[0];
      } else {
        eventCounter += 1;
        const mergeEvent = eventCounter;
        for (const e of uniqEnds) {
          if (e !== mergeEvent) addDummyEdge(e, mergeEvent, 'Фиктивная (слияние предков)');
        }
        startEvent = mergeEvent;
      }
    }

    const endEvent = taskEvents.get(tid)?.endEvent;

    taskEvents.set(tid, { startEvent, endEvent });

    aoaEdges.push({
      id: `${startEvent}-${endEvent}`,
      name: t.name,
      duration: t.durationDays,
      numberOfPerformers: Math.max(1, parseInt(t.raw?.numberOfPerformers, 10) || 1),
      laborIntensity: Number.isFinite(+t.raw?.laborIntensity)
        ? +t.raw.laborIntensity
        : calcLaborHours(t.durationDays, t.raw?.numberOfPerformers, hoursPerDay),
      predecessors: [],
      isDummy: false,
      sourceTaskId: tid,
    });
  }

  if (createSink) {
    const allStartEvents = new Set(aoaEdges.map(e => Number(e.id.split('-')[0])));
    const allEndEvents   = new Set(aoaEdges.map(e => Number(e.id.split('-')[1])));

    const terminalEnds = Array.from(allEndEvents).filter(e => !allStartEvents.has(e));

    if (terminalEnds.length > 1) {
      eventCounter += 1;
      const SINK_EVENT = eventCounter;

      for (const e of terminalEnds) {
        aoaEdges.push({
          id: `${e}-${SINK_EVENT}`,
          name: 'Фиктивная (слияние в финиш)',
          duration: 0,
          numberOfPerformers: 1,
          laborIntensity: 0,
          predecessors: [],
          isDummy: true,
        });
      }
    }
  }

  return aoaEdges;
}

export function aonToAoa(
  aonTasks,
  { hoursPerDay = 8, createSink = true, anchoringMode = 'legacy' } = {}
) {
  const tasksById = new Map();
  for (const t of aonTasks || []) {
    const idNum = toNum(t.id);
    if (!Number.isFinite(idNum)) continue;

    const preds = normalizePredecessors(t.predecessors);

    const p = Math.max(1, parseInt(t.numberOfPerformers, 10) || 1);
    const labor = Number.isFinite(+t.laborIntensity) ? +t.laborIntensity : null;
    let dDays;
    if (labor != null && labor > 0) {
      dDays = Math.max(0.1, calcDurationDays(labor, p, hoursPerDay));
    } else {
      dDays = Math.max(0.1, Number(t.duration) || 0);
    }

    tasksById.set(idNum, {
      id: idNum,
      name: t.name || t.title || String(t.id),
      preds,
      durationDays: dDays,
      phase: toNum(t.phase),
      raw: t,
    });
  }

  if (tasksById.size === 0) return [];

  const successorsSamePhase = new Map();
  for (const [id] of tasksById) successorsSamePhase.set(id, new Set());

  for (const [id, t] of tasksById) {
    for (const p of t.preds) {
      if (tasksById.has(p)) {
        const tp = tasksById.get(p);
        if (Number.isFinite(t.phase) && t.phase === tp.phase) {
          successorsSamePhase.get(p).add(id);
        }
      }
    }
  }

  function isTerminalInPhase(taskId) {
    const succ = successorsSamePhase.get(taskId);
    return !succ || succ.size === 0;
  }

  const phasesSorted = Array.from(
    new Set(Array.from(tasksById.values()).map(t => t.phase).filter(Number.isFinite))
  ).sort((a, b) => a - b);

  const order = topoSort(tasksById);
  const mode = anchoringMode === 'two-pass' ? 'two-pass' : 'legacy';

  if (mode === 'two-pass') {
    return convertTwoPass({
      tasksById,
      order,
      phasesSorted,
      isTerminalInPhase,
      hoursPerDay,
      createSink,
    });
  }

  return convertLegacy({
    tasksById,
    order,
    phasesSorted,
    isTerminalInPhase,
    hoursPerDay,
    createSink,
  });
}
