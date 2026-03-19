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

export function aonToAoa(
  aonTasks,
  { hoursPerDay = 8, createSink = true } = {}
) {
  const tasksById = new Map();
  for (const t of aonTasks || []) {
    const idNum = toNum(t.id);
    if (!Number.isFinite(idNum)) continue;

    const preds = normalizePredecessors(t.predecessors);

    const parsedPerformers = parseInt(t.numberOfPerformers, 10);
    const p = Number.isFinite(parsedPerformers) ? Math.max(0, parsedPerformers) : 0;
    const labor = Number.isFinite(+t.laborIntensity) ? +t.laborIntensity : null;
    const isDummy = p === 0;
    let dDays;
    if (isDummy) {
      dDays = Math.max(0, Number(t.duration) || 0);
    } else if (labor != null && labor > 0) {
      dDays = Math.max(0.1, calcDurationDays(labor, p, hoursPerDay));
    } else {
      dDays = Math.max(0.1, Number(t.duration) || 0);
    }

    tasksById.set(idNum, {
      id: idNum,
      name: t.name || t.title || String(t.id),
      preds,
      durationDays: dDays,
      isDummy,
      raw: t,
    });
  }

  if (tasksById.size === 0) return [];

  const order = topoSort(tasksById);
  let eventCounter = 1;
  const START_EVENT = 1;
  const taskEvents = new Map();
  const aoaEdges = [];

  function addDummyEdge(fromEvent, toEvent, name = 'Фиктивная') {
    aoaEdges.push({
      id: `${fromEvent}-${toEvent}`,
      name,
      duration: 0,
      numberOfPerformers: 0,
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
      startEvent = START_EVENT;
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
      numberOfPerformers: Number.isFinite(parseInt(t.raw?.numberOfPerformers, 10))
        ? Math.max(0, parseInt(t.raw.numberOfPerformers, 10))
        : 0,
      laborIntensity: t.isDummy === true
        ? 0
        : (Number.isFinite(+t.raw?.laborIntensity)
            ? +t.raw.laborIntensity
            : calcLaborHours(t.durationDays, t.raw?.numberOfPerformers, hoursPerDay)),
      predecessors: [],
      isDummy: t.isDummy === true,
      sourceTaskId: tid,
    });
  }

  if (createSink) {
    const allStartEvents = new Set(aoaEdges.map((e) => Number(e.id.split('-')[0])));
    const allEndEvents = new Set(aoaEdges.map((e) => Number(e.id.split('-')[1])));
    const terminalEnds = Array.from(allEndEvents).filter((e) => !allStartEvents.has(e));

    if (terminalEnds.length > 1) {
      eventCounter += 1;
      const SINK_EVENT = eventCounter;
      for (const e of terminalEnds) {
        aoaEdges.push({
          id: `${e}-${SINK_EVENT}`,
          name: 'Фиктивная (слияние в финиш)',
          duration: 0,
          numberOfPerformers: 0,
          laborIntensity: 0,
          predecessors: [],
          isDummy: true,
        });
      }
    }
  }

  return aoaEdges;
}
