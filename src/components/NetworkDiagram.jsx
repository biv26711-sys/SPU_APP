import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { aonToAoa as converting, looksLikeEdgeId } from '@/utils/converting';
import {
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Network,
  Info,
  Settings,
  Eye,
  EyeOff,
  Palette
} from 'lucide-react';

const NetworkDiagram = forwardRef(({ results, hoursPerDay = 8 }, ref) => {
  const canvasRef = useRef(null);
  
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showTimes, setShowTimes] = useState(true);
  const [showRegularLabels, setShowRegularLabels] = useState(true);
  const [showDummyLabels, setShowDummyLabels] = useState(true);
  const [renderMode, setRenderMode] = useState('aoa');
  const [colorScheme, setColorScheme] = useState('modern');
  const [selectedNode, setSelectedNode] = useState(null);
 

  const colorSchemes = {
    modern: {
      background: '#f8fafc',
      grid: '#e2e8f0',
      criticalNode: '#ef4444',
      normalNode: '#3b82f6',
      criticalEdge: '#dc2626',
      normalEdge: '#64748b',
      text: '#1e293b',
      highlight: '#fbbf24'
    },
    classic: {
      background: '#ffffff',
      grid: '#d1d5db',
      criticalNode: '#dc2626',
      normalNode: '#2563eb',
      criticalEdge: '#991b1b',
      normalEdge: '#374151',
      text: '#111827',
      highlight: '#f59e0b'
    },
    dark: {
      background: '#0f172a',
      grid: '#334155',
      criticalNode: '#f87171',
      normalNode: '#60a5fa',
      criticalEdge: '#ef4444',
      normalEdge: '#94a3b8',
      text: '#f1f5f9',
      highlight: '#fbbf24'
    }
  };

  const colors = colorSchemes[colorScheme];

const drawFullDiagramOnContext = (ctx, width, height, nodes, edges, bgColor) => {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    const minX = Math.min(...nodes.map(n => n.x));
    const minY = Math.min(...nodes.map(n => n.y));
    const padding = 150;

    ctx.save();
    ctx.translate(-minX + padding, -minY + padding);

    edges.forEach(edge => drawEdge(ctx, edge));
    nodes.forEach(node => drawNode(ctx, node));
    nodes.forEach(node => drawNodeLabel(ctx, node));
    
    ctx.restore();
};

const exportDiagram = () => {
    if (!results || !results.tasks || !results.tasks.length === 0) return;

    const offscreenCanvas = document.createElement('canvas');
    const ctx = offscreenCanvas.getContext('2d');

    const sourceTasks = Array.isArray(results.tasks) ? results.tasks : [];
    const aoaTasks = sourceTasks.some(t => !looksLikeEdgeId(String(t.id)))
      ? converting(sourceTasks, { hoursPerDay })
      : sourceTasks;
    const nodes = createNodes(aoaTasks);
    const edges = createEdges(aoaTasks, nodes);

    const minX = Math.min(...nodes.map(n => n.x));
    const maxX = Math.max(...nodes.map(n => n.x));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxY = Math.max(...nodes.map(n => n.y));

    const padding = 150;
    const fullWidth = (maxX - minX) + padding * 2;
    const fullHeight = (maxY - minY) + padding * 2;
    
    const exportScale = 1.5;
    offscreenCanvas.width = fullWidth * exportScale;
    offscreenCanvas.height = fullHeight * exportScale;
    ctx.scale(exportScale, exportScale);


    drawFullDiagramOnContext(ctx, fullWidth, fullHeight, nodes, edges, colors.background);

    const link = document.createElement('a');
    link.download = `network_diagram_${new Date().toISOString().split('T')[0]}.png`;
    link.href = offscreenCanvas.toDataURL('image/png', 1.0);
    link.click();
};


useImperativeHandle(ref, () => ({
  exportToPNG: exportDiagram,
  getAsBase64: () => {
    if (!results || !results.tasks || !results.tasks.length === 0) return null;

    try {
        const offscreenCanvas = document.createElement('canvas');
        const ctx = offscreenCanvas.getContext('2d');

        const sourceTasks = Array.isArray(results.tasks) ? results.tasks : [];
        const aoaTasks = sourceTasks.some(t => !looksLikeEdgeId(String(t.id)))
          ? converting(sourceTasks, { hoursPerDay })
          : sourceTasks;
        const nodes = createNodes(aoaTasks);
        const edges = createEdges(aoaTasks, nodes);

        const minX = Math.min(...nodes.map(n => n.x));
        const maxX = Math.max(...nodes.map(n => n.x));
        const minY = Math.min(...nodes.map(n => n.y));
        const maxY = Math.max(...nodes.map(n => n.y));

        const padding = 150;
        const fullWidth = (maxX - minX) + padding * 2;
        const fullHeight = (maxY - minY) + padding * 2;
        const exportScale = 2; 
        offscreenCanvas.width = fullWidth * exportScale;
        offscreenCanvas.height = fullHeight * exportScale;
        ctx.scale(exportScale, exportScale);

        drawFullDiagramOnContext(ctx, fullWidth, fullHeight, nodes, edges, '#FFFFFF');

        return offscreenCanvas.toDataURL('image/png', 1.0);

    } catch (e) {
        console.error("Ошибка при получении base64 из сетевого графика:", e);
        return null;
    }
  }
}));


  useEffect(() => {
    if (results && results.tasks) {
      drawNetwork();
    }
  }, [results, scale, offset, showTimes, colorScheme, renderMode, showRegularLabels, showDummyLabels]);

  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - offset.x * scale) / scale;
        const worldY = (mouseY - offset.y * scale) / scale;

        const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(Math.max(scale * scaleFactor, 0.2), 5);

        const newOffsetX = (mouseX - worldX * newScale) / newScale;
        const newOffsetY = (mouseY - worldY * newScale) / newScale;

        setScale(newScale);
        setOffset({ x: newOffsetX, y: newOffsetY });
      }
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => canvas.removeEventListener('wheel', handleWheel);
    }
  }, [scale, offset]);

  const drawNetwork = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, rect.width, rect.height);
    drawGrid(ctx, rect.width, rect.height);

    if (!results || !results.tasks || results.tasks.length === 0) {
      drawEmptyState(ctx, rect.width, rect.height);
      return;
    }

    const sourceTasks = Array.isArray(results.tasks) ? results.tasks : [];

    const needsAdapt = sourceTasks.some(t => !looksLikeEdgeId(String(t.id)));
    const aoaTasks = needsAdapt
      ? converting(sourceTasks, { hoursPerDay })
      : sourceTasks;

    const tasksForRender = aoaTasks.map(t => ({
      ...t,
      duration: Number(t.duration ?? 0),
      isDummy: t.isDummy === true || Number(t.duration ?? 0) === 0
    }));

    if (renderMode === 'aon') {
      const { aonNodes, aonEdges } = buildAONGraph(tasksForRender);
      positionAONNodes(aonNodes, aonEdges);
      measureAONNodes(ctx, aonNodes);

      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.scale(scale, scale);

      const edgeObjs = aonEdges.map(e => ({
        ...e,
        fromNode: aonNodes.find(n => n.id === e.from),
        toNode: aonNodes.find(n => n.id === e.to),
      }));
      prepareAonFinishRoutes(edgeObjs);
      edgeObjs.forEach(e => drawAonEdge(ctx, e));
      aonNodes.forEach(n => drawAonNode(ctx, n));

      ctx.restore();
    } else {
      const nodes = createNodes(tasksForRender);
      const edges = createEdges(tasksForRender, nodes).map(e => ({
        ...e,
        isDummy: e.task?.isDummy === true
      }));

      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.scale(scale, scale);

      edges.forEach(edge => drawEdge(ctx, edge));
      nodes.forEach(node => drawNode(ctx, node));
      nodes.forEach(node => drawNodeLabel(ctx, node));

      ctx.restore();
    }

    drawLegend(ctx, rect.width, rect.height);
  };

  const drawGrid = (ctx, width, height) => {
    const gridSize = 20 * scale;
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.3;

    for (let x = (offset.x % gridSize); x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = (offset.y % gridSize); y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  };

  const createNodes = (tasks) => {
    const nodeMap = new Map();
    const criticalPath = results.criticalPath || [];

    tasks.forEach(task => {
      const [from, to] = task.id.split('-').map(Number);
      
      if (!nodeMap.has(from)) {
        nodeMap.set(from, {
          id: from,
          x: 0,
          y: 0,
          isCritical: criticalPath.includes(from),
          tasks: [],
          earlyTime: 0,
          lateTime: 0
        });
      }
      
      if (!nodeMap.has(to)) {
        nodeMap.set(to, {
          id: to,
          x: 0,
          y: 0,
          isCritical: criticalPath.includes(to),
          tasks: [],
          earlyTime: 0,
          lateTime: 0
        });
      }

      nodeMap.get(from).tasks.push(task);
      nodeMap.get(to).tasks.push(task);
    });

    const nodes = Array.from(nodeMap.values());

    const incidentCritical = new Set();
    tasks.forEach(t => {
      if (t?.isCritical) {
        const [from, to] = String(t.id).split('-').map(Number);
        incidentCritical.add(from);
        incidentCritical.add(to);
      }
    });
    nodes.forEach(n => {
      n.isCritical = incidentCritical.has(n.id);
    });

    positionNodes(nodes, tasks);
    return nodes;
  };

  const positionNodes = (nodes, tasks) => {
    const levels = new Map(nodes.map(node => [node.id, 0]));
    const inDeg = new Map(nodes.map(node => [node.id, 0]));
    const outAdj = new Map(nodes.map(node => [node.id, []]));
    const edgeList = [];

    tasks.forEach(task => {
      const [from, to] = String(task.id).split('-').map(Number);
      if (!Number.isFinite(from) || !Number.isFinite(to)) return;
      edgeList.push({ from, to });
      if (outAdj.has(from)) outAdj.get(from).push(to);
      if (inDeg.has(to)) inDeg.set(to, (inDeg.get(to) || 0) + 1);
    });

    const queue = Array.from(inDeg.entries())
      .filter(([, deg]) => deg === 0)
      .map(([id]) => id)
      .sort((a, b) => a - b);

    while (queue.length > 0) {
      const current = queue.shift();
      const currentLevel = levels.get(current) || 0;
      const outgoing = (outAdj.get(current) || []).slice().sort((a, b) => a - b);

      outgoing.forEach(next => {
        levels.set(next, Math.max(levels.get(next) || 0, currentLevel + 1));
        inDeg.set(next, (inDeg.get(next) || 0) - 1);
        if (inDeg.get(next) === 0) {
          const pos = queue.findIndex(x => x > next);
          if (pos === -1) queue.push(next);
          else queue.splice(pos, 0, next);
        }
      });
    }

    const levelGroups = new Map();
    nodes.forEach(node => {
      const level = levels.get(node.id) || 0;
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level).push(node);
    });

    const baseX = 120;
    const baseY = 150;
    const levelSpacing = 300;
    const nodeSpacing = 160;  

    levelGroups.forEach((levelNodes, level) => {
      levelNodes.sort((a, b) => a.id - b.id);
      
      const totalHeight = (levelNodes.length - 1) * nodeSpacing;
      const startY = baseY - totalHeight / 2;
      
      levelNodes.forEach((node, index) => {
        node.x = baseX + level * levelSpacing;
        node.y = startY + index * nodeSpacing;

        const relatedTasks = tasks.filter(task => {
          const [from, to] = task.id.split('-').map(Number);
          return from === node.id || to === node.id;
        });
        
        if (relatedTasks.length > 0) {
          node.earlyTime = Math.max(...relatedTasks.map(task => task.earlyStart || 0));
          node.lateTime = Math.min(...relatedTasks.map(task => task.lateFinish || task.duration));
        }
      });
    });

    const sinkTargets = tasks
      .filter(task =>
        typeof task?.name === 'string' &&
        task.name.toLowerCase().includes('слияние в финиш')
      )
      .map(task => {
        const [, to] = String(task.id).split('-').map(Number);
        return to;
      })
      .filter(Number.isFinite);
    const sinkNodeId = sinkTargets.length > 0 ? Math.max(...sinkTargets) : null;
    if (Number.isFinite(sinkNodeId)) {
      const sinkNode = nodes.find(n => n.id === sinkNodeId);
      if (sinkNode) {
        const maxLevel = Math.max(...Array.from(levelGroups.keys()), 0);
        const lastLevel = maxLevel + 1;
        sinkNode.x = baseX + lastLevel * levelSpacing;
      }
    }

    optimizeNodePositions(nodes, tasks, levelGroups);
  };

  const optimizeNodePositions = (nodes, tasks, levelGroups) => {
    levelGroups.forEach((levelNodes, level) => {
      if (levelNodes.length <= 1) return;
      
      levelNodes.forEach(node => {
        const connectedNodes = [];
        
        tasks.forEach(task => {
          const [from, to] = task.id.split('-').map(Number);
          if (from === node.id) {
            const toNode = nodes.find(n => n.id === to);
            if (toNode) connectedNodes.push(toNode);
          }
          if (to === node.id) {
            const fromNode = nodes.find(n => n.id === from);
            if (fromNode) connectedNodes.push(fromNode);
          }
        });
        
        if (connectedNodes.length > 0) {
          const avgY = connectedNodes.reduce((sum, n) => sum + n.y, 0) / connectedNodes.length;
          node.y = (node.y + avgY) / 2;
        }
      });
      
      levelNodes.sort((a, b) => a.y - b.y);
      for (let i = 1; i < levelNodes.length; i++) {
        const minDistance = 120; 
        if (levelNodes[i].y - levelNodes[i-1].y < minDistance) {
          levelNodes[i].y = levelNodes[i-1].y + minDistance;
        }
      }
    });
  };

  const createEdges = (tasks, nodes) => {
    const edges = tasks.map(task => {
      const [from, to] = task.id.split('-').map(Number);
      const fromNode = nodes.find(n => n.id === from);
      const toNode = nodes.find(n => n.id === to);

      const isCriticalVisual = task.isDummy ? false : !!task.isCritical;
      
      return {
        from: fromNode,
        to: toNode,
        task,
        isCritical: isCriticalVisual,
        isDummy: task.isDummy === true,
      };
    });
    return addEdgeLanes(edges);
  };

  const addEdgeLanes = (edges) => {
    const pairGroups = new Map();
    const outgoingGroups = new Map();
    const incomingGroups = new Map();

    edges.forEach(edge => {
      if (!edge?.from || !edge?.to) return;
      const pairKey = `${edge.from.id}->${edge.to.id}`;
      if (!pairGroups.has(pairKey)) pairGroups.set(pairKey, []);
      pairGroups.get(pairKey).push(edge);

      if (!outgoingGroups.has(edge.from.id)) outgoingGroups.set(edge.from.id, []);
      outgoingGroups.get(edge.from.id).push(edge);

      if (!incomingGroups.has(edge.to.id)) incomingGroups.set(edge.to.id, []);
      incomingGroups.get(edge.to.id).push(edge);
    });

    const rankInGroup = (group, edge, sorter) => {
      const arr = group.slice().sort(sorter);
      const idx = arr.findIndex(x => x === edge);
      const mid = (arr.length - 1) / 2;
      return (idx - mid);
    };

    edges.forEach(edge => {
      if (!edge?.from || !edge?.to) {
        edge._laneOffset = 0;
        return;
      }
      const pairKey = `${edge.from.id}->${edge.to.id}`;
      const pair = pairGroups.get(pairKey) || [edge];
      const pairRank = rankInGroup(pair, edge, (a, b) => {
        const dummyA = a.isDummy ? 0 : 1;
        const dummyB = b.isDummy ? 0 : 1;
        if (dummyA !== dummyB) return dummyA - dummyB;
        return String(a.task?.name || '').localeCompare(String(b.task?.name || ''));
      });

      const outgoing = outgoingGroups.get(edge.from.id) || [edge];
      const outgoingRank = rankInGroup(outgoing, edge, (a, b) => {
        if ((a.to?.y || 0) !== (b.to?.y || 0)) return (a.to?.y || 0) - (b.to?.y || 0);
        return (a.to?.id || 0) - (b.to?.id || 0);
      });

      const incoming = incomingGroups.get(edge.to.id) || [edge];
      const incomingRank = rankInGroup(incoming, edge, (a, b) => {
        if ((a.from?.y || 0) !== (b.from?.y || 0)) return (a.from?.y || 0) - (b.from?.y || 0);
        return (a.from?.id || 0) - (b.from?.id || 0);
      });

      const pairStep = 18;
      const fanStep = 7;
      edge._laneOffset = pairRank * pairStep + (outgoingRank + incomingRank) * fanStep;
    });

    return edges;
  };

  const drawNode = (ctx, node) => {
    const radius = 25;
    const x = node.x;
    const y = node.y;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = node.isCritical ? colors.criticalNode : colors.normalNode;
    ctx.fill();

    ctx.strokeStyle = node.id === selectedNode ? colors.highlight : 
                     node.isCritical ? colors.criticalEdge : colors.normalEdge;
    ctx.lineWidth = node.id === selectedNode ? 3 : 2;
    ctx.stroke();

    ctx.restore();

    if (node.isCritical) {
      ctx.beginPath();
      ctx.arc(x, y, radius - 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fill();
    }

    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.id.toString(), x, y);

    if (showTimes && (node.earlyTime !== undefined || node.lateTime !== undefined)) {
      ctx.font = '10px Arial';
      ctx.fillStyle = colors.text;
      
      if (node.earlyTime !== undefined) {
        ctx.textAlign = 'center';
        ctx.fillText(`ES: ${node.earlyTime.toFixed(1)}`, x, y - radius - 20);
      }
      
      if (node.lateTime !== undefined) {
        ctx.textAlign = 'center';
        ctx.fillText(`LS: ${node.lateTime.toFixed(1)}`, x, y + radius + 25);
      }
    }
  };

  const drawEdge = (ctx, edge) => {
    if (!edge.from || !edge.to) return;

    const fromX = edge.from.x;
    const fromY = edge.from.y;
    const toX = edge.to.x;
    const toY = edge.to.y;

    const angle = Math.atan2(toY - fromY, toX - fromX);
    const radius = 25;

    const laneOffset = Number(edge._laneOffset || 0);
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    const startX = fromX + Math.cos(angle) * radius + nx * laneOffset;
    const startY = fromY + Math.sin(angle) * radius + ny * laneOffset;
    const endX   = toX   - Math.cos(angle) * radius + nx * laneOffset;
    const endY   = toY   - Math.sin(angle) * radius + ny * laneOffset;

    const isCrit = edge.isCritical === true;
    const isDummy = edge.isDummy === true;

    ctx.save();
    if (isDummy) {
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = colors.normalEdge;
      ctx.globalAlpha = 0.9;
    } else {
      ctx.setLineDash([]);
      ctx.lineWidth = isCrit ? 3 : 2;
      ctx.strokeStyle = isCrit ? colors.criticalEdge : colors.normalEdge;
    }

    const drawCurved = isDummy || Math.abs(laneOffset) > 4;
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const curveAmount = laneOffset * 1.2 + (isDummy ? 10 : 0);
    const controlX = midX + nx * curveAmount;
    const controlY = midY + ny * curveAmount;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    if (drawCurved) {
      ctx.quadraticCurveTo(controlX, controlY, endX, endY);
    } else {
      ctx.lineTo(endX, endY);
    }
    ctx.stroke();

    const arrowLength = 12;
    const arrowAngle = Math.PI / 6;
    const arrowAngleBase = drawCurved
      ? Math.atan2(endY - controlY, endX - controlX)
      : angle;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrowLength * Math.cos(arrowAngleBase - arrowAngle),
      endY - arrowLength * Math.sin(arrowAngleBase - arrowAngle)
    );
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrowLength * Math.cos(arrowAngleBase + arrowAngle),
      endY - arrowLength * Math.sin(arrowAngleBase + arrowAngle)
    );
    ctx.stroke();

    if (edge.task) {
      const shouldDrawLabel = isDummy ? showDummyLabels : showRegularLabels;
      if (!shouldDrawLabel) {
        ctx.restore();
        return;
      }
      const labelMidX = drawCurved
        ? 0.25 * startX + 0.5 * controlX + 0.25 * endX
        : (startX + endX) / 2;
      const labelMidY = drawCurved
        ? 0.25 * startY + 0.5 * controlY + 0.25 * endY
        : (startY + endY) / 2;

      const lineAngle = drawCurved
        ? Math.atan2(endY - controlY, endX - controlX)
        : Math.atan2(endY - startY, endX - startX);
      const isHorizontal = Math.abs(lineAngle) < Math.PI / 4 || Math.abs(lineAngle) > 3 * Math.PI / 4;

      const offsetDistance = 30;
      const offsetX = isHorizontal ? 0 : Math.cos(lineAngle + Math.PI / 2) * offsetDistance;
      const offsetY = isHorizontal ? -offsetDistance : Math.sin(lineAngle + Math.PI / 2) * offsetDistance;

      const textX = labelMidX + offsetX;
      const textY = labelMidY + offsetY;

      const taskName = edge.task.name || edge.task.id;
      const durationText = isDummy ? '(фикт.)' : `(${edge.task.duration}д)`;

      ctx.font = '10px Arial';
      const nameWidth = ctx.measureText(taskName).width;
      const durationWidth = ctx.measureText(durationText).width;
      const maxWidth = Math.max(nameWidth, durationWidth);

      const padding = 8;
      const lineHeight = 14; 
      const bgHeight = lineHeight * 2 + padding * 2;
      const bgWidth = maxWidth + padding * 2;

      ctx.setLineDash([]);
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fillRect(textX - bgWidth / 2, textY - bgHeight / 2, bgWidth, bgHeight);

      ctx.lineWidth = 1;
      ctx.strokeRect(textX - bgWidth / 2, textY - bgHeight / 2, bgWidth, bgHeight);

      ctx.fillStyle = colors.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.font = 'bold 10px Arial';
      ctx.fillText(taskName, textX, textY - lineHeight / 2);

      ctx.font = '9px Arial';
      ctx.fillStyle = isDummy ? colors.normalEdge : (isCrit ? colors.criticalEdge : colors.normalEdge);
      ctx.fillText(durationText, textX, textY + lineHeight / 2);
    }

    ctx.restore();
  };

  const parseEdge = (task) => {
    const [from, to] = String(task.id).split('-').map(Number);
    return {
      ...task,
      from,
      to,
      isDummy: task.isDummy === true || Number(task.duration ?? 0) === 0,
      isCritical: task.isDummy ? false : !!task.isCritical,
    };
  };

  const indexByEvents = (edges) => {
    const outByEvent = new Map();
    edges.forEach(e => {
      if (!outByEvent.has(e.from)) outByEvent.set(e.from, []);
      outByEvent.get(e.from).push(e);
    });
    return { outByEvent };
  };

  const findRealSuccessors = (startEvent, outByEvent) => {
    const successors = new Set();
    const queue = [startEvent];
    const seen = new Set([startEvent]);

    while (queue.length) {
      const event = queue.shift();
      const outgoing = outByEvent.get(event) || [];
      outgoing.forEach(e => {
        if (e.isDummy) {
          if (!seen.has(e.to)) {
            seen.add(e.to);
            queue.push(e.to);
          }
        } else {
          successors.add(e);
        }
      });
    }
    return Array.from(successors);
  };

  const buildAONGraph = (aoaTasks) => {
    const edges = aoaTasks.map(parseEdge);
    const real = edges.filter(e => !e.isDummy);
    const { outByEvent } = indexByEvents(edges);

    const aonNodes = real.map(e => ({
      id: String(e.id),
      name: e.name || String(e.id),
      duration: Number(e.duration) || 0,
      isCritical: !!e.isCritical,
      _ES: Number(e.earlyStart ?? e.ES ?? e.earlyStart),
      _EF: Number(e.earlyFinish ?? e.EF ?? e.earlyFinish),
      x: 0,
      y: 0,
    }));
    const nodeById = new Map(aonNodes.map(n => [n.id, n]));

    const aonEdgesRaw = [];
    real.forEach(r => {
      const nextReal = findRealSuccessors(r.to, outByEvent);
      nextReal.forEach(n => {
        aonEdgesRaw.push({ from: String(r.id), to: String(n.id) });
      });
    });

    const seen = new Set();
    const aonEdgesDedup = aonEdgesRaw.filter(e => {
      const key = `${e.from}->${e.to}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let aonEdges = aonEdgesDedup;

    const inDeg = new Map(aonNodes.map(n => [n.id, 0]));
    const outDeg = new Map(aonNodes.map(n => [n.id, 0]));
    aonEdges.forEach(e => {
      inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);
      outDeg.set(e.from, (outDeg.get(e.from) || 0) + 1);
    });

    const sources = aonNodes.filter(n => (inDeg.get(n.id) || 0) === 0);
    if (sources.length > 0) {
      const startId = '__START__';
      const startNode = {
        id: startId,
        name: 'Старт',
        duration: 0,
        isCritical: sources.some(n => n.isCritical),
        x: 0,
        y: 0,
      };
      aonNodes.push(startNode);
      nodeById.set(startId, startNode);
      sources.forEach(n => {
        if (n.id !== startId) aonEdges.push({ from: startId, to: n.id });
      });
    }

    const outDegAfterStart = new Map(aonNodes.map(n => [n.id, 0]));
    aonEdges.forEach(e => {
      outDegAfterStart.set(e.from, (outDegAfterStart.get(e.from) || 0) + 1);
    });

    const terminal = aonNodes.filter(n => (outDegAfterStart.get(n.id) || 0) === 0);
    if (terminal.length > 0) {
      const finishId = '__FINISH__';
      const finishNode = {
        id: finishId,
        name: 'Финиш',
        duration: 0,
        isCritical: terminal.some(n => n.isCritical),
        x: 0,
        y: 0,
      };
      aonNodes.push(finishNode);
      nodeById.set(finishId, finishNode);
      terminal.forEach(n => {
        if (n.id !== finishId) aonEdges.push({ from: n.id, to: finishId });
      });
    }

    aonEdges = aonEdges.map(e => {
      const fromNode = nodeById.get(e.from);
      const toNode = nodeById.get(e.to);
      return {
        ...e,
        isCritical: !!(fromNode?.isCritical && toNode?.isCritical),
      };
    });

    return { aonNodes, aonEdges };
  };

  const positionAONNodes = (nodes, edges) => {
    const inDeg = new Map(nodes.map(n => [n.id, 0]));
    const outAdj = new Map(nodes.map(n => [n.id, []]));
    edges.forEach(e => {
      inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);
      outAdj.get(e.from).push(e.to);
    });

    const level = new Map(nodes.map(n => [n.id, 0]));
    const queue = [];
    nodes.forEach(n => {
      if ((inDeg.get(n.id) || 0) === 0) queue.push(n.id);
    });

    while (queue.length) {
      const u = queue.shift();
      const current = level.get(u) || 0;
      for (const v of outAdj.get(u)) {
        level.set(v, Math.max(level.get(v) || 0, current + 1));
        inDeg.set(v, (inDeg.get(v) || 0) - 1);
        if (inDeg.get(v) === 0) queue.push(v);
      }
    }

    const groups = new Map();
    nodes.forEach(n => {
      const l = level.get(n.id) || 0;
      if (!groups.has(l)) groups.set(l, []);
      groups.get(l).push(n);
    });

    const baseX = 120;
    const baseY = 150;
    const levelSpacing = 320;
    const nodeSpacing = 110;

    groups.forEach((arr, levelId) => {
      arr.sort((a, b) => a.name.localeCompare(b.name));
      const totalHeight = (arr.length - 1) * nodeSpacing;
      const startY = baseY - totalHeight / 2;
      arr.forEach((n, index) => {
        n.x = baseX + levelId * levelSpacing;
        n.y = startY + index * nodeSpacing;
      });
    });

    const finishNode = nodes.find(n => n.id === '__FINISH__');
    if (finishNode) {
      const nonFinishNodes = nodes.filter(n => n.id !== '__FINISH__');
      const maxX = nonFinishNodes.length > 0 ? Math.max(...nonFinishNodes.map(n => n.x)) : finishNode.x;
      finishNode.x = maxX + levelSpacing * 0.9;

      const incoming = edges
        .filter(e => e.to === '__FINISH__')
        .map(e => nodes.find(n => n.id === e.from))
        .filter(Boolean);
      if (incoming.length > 0) {
        finishNode.y = incoming.reduce((sum, n) => sum + n.y, 0) / incoming.length;
      }
    }
  };

  const prepareAonFinishRoutes = (edges) => {
    const finishEdges = (Array.isArray(edges) ? edges : [])
      .filter(e => e?.to === '__FINISH__' && e?.fromNode && e?.toNode)
      .sort((a, b) => a.fromNode.y - b.fromNode.y);

    if (finishEdges.length === 0) return;

    const laneGap = 22;
    const laneMid = (finishEdges.length - 1) / 2;
    finishEdges.forEach((edge, index) => {
      const laneOffset = (index - laneMid) * laneGap;
      edge._finishLaneOffset = laneOffset;
      edge._finishBendDistance = 90 + Math.abs(laneOffset) * 0.7;
    });
  };

  const drawArrow = (ctx, endX, endY, angle) => {
    const arrowLength = 10;
    const arrowAngle = Math.PI / 6;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrowLength * Math.cos(angle - arrowAngle),
      endY - arrowLength * Math.sin(angle - arrowAngle)
    );
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrowLength * Math.cos(angle + arrowAngle),
      endY - arrowLength * Math.sin(angle + arrowAngle)
    );
    ctx.stroke();
  };

  const drawAonNode = (ctx, node) => {
    const radius = 8;
    const width = Number(node._w) || 160;
    const height = Number(node._h) || 50;
    const x = node.x - width / 2;
    const y = node.y - height / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = node.isCritical ? colors.criticalNode : colors.normalNode;
    ctx.strokeStyle = node.isCritical ? colors.criticalEdge : colors.normalEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const lineHeight = 14;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px Arial';
    const lines = Array.isArray(node._lines) && node._lines.length ? node._lines : [node.name];
    const totalTitleHeight = lines.length * lineHeight;
    const startY = node.y - totalTitleHeight / 2;
    lines.forEach((line, index) => {
      ctx.fillText(line, node.x, startY + index * lineHeight);
    });
    ctx.font = '11px Arial';
    ctx.fillText(node._durationText || `(${Number(node.duration) || 0}д)`, node.x, node.y + totalTitleHeight / 2 + 10);
  };

  const drawAonEdge = (ctx, edge) => {
    const from = edge.fromNode;
    const to = edge.toNode;
    if (!from || !to) return;

    const isCriticalEdge = edge.isCritical === true;

    ctx.save();
    ctx.setLineDash([]);
    ctx.lineWidth = isCriticalEdge ? 3 : 2;
    ctx.strokeStyle = isCriticalEdge ? colors.criticalEdge : colors.normalEdge;

    if (to.id === '__FINISH__') {
      const fromWidth = (Number(from._w) || 160) / 2 + 12;
      const toWidth = (Number(to._w) || 160) / 2 + 12;
      const toHeight = Number(to._h) || 50;

      const startX = from.x + fromWidth;
      const startY = from.y;
      const laneOffset = Number(edge._finishLaneOffset || 0);
      const maxEndYOffset = Math.max(8, toHeight / 2 - 8);
      const endY = to.y + Math.max(-maxEndYOffset, Math.min(maxEndYOffset, laneOffset * 0.35));
      const endX = to.x - toWidth;
      const bendX = endX - Number(edge._finishBendDistance || 90);
      const controlX = bendX + 36;
      const controlY = startY;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(bendX, startY);
      ctx.quadraticCurveTo(controlX, controlY, endX, endY);
      ctx.stroke();

      const tangentAngle = Math.atan2(endY - controlY, endX - controlX);
      drawArrow(ctx, endX, endY, tangentAngle);
    } else {
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const fromPad = (Number(from._w) || 160) / 2 + 12;
      const toPad = (Number(to._w) || 160) / 2 + 12;
      const startX = from.x + Math.cos(angle) * fromPad;
      const startY = from.y + Math.sin(angle) * fromPad;
      const endX = to.x - Math.cos(angle) * toPad;
      const endY = to.y - Math.sin(angle) * toPad;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      drawArrow(ctx, endX, endY, angle);
    }

    ctx.restore();
  };

  const wrapText = (ctx, text, maxLineWidth) => {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';

    const pushCurrent = () => {
      if (current) {
        lines.push(current.trim());
        current = '';
      }
    };

    words.forEach(word => {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width <= maxLineWidth) {
        current = test;
      } else if (!current) {
        let chunk = '';
        for (const ch of word) {
          const candidate = chunk + ch;
          if (ctx.measureText(candidate).width <= maxLineWidth) {
            chunk = candidate;
          } else {
            if (chunk) lines.push(chunk);
            chunk = ch;
          }
        }
        current = chunk;
      } else {
        pushCurrent();
        current = word;
      }
    });
    pushCurrent();
    return lines.length ? lines : [''];
  };

  const measureAONNodes = (ctx, nodes) => {
    const minWidth = 140;
    const maxWidth = 280;
    const padding = 10;
    const lineHeight = 14;

    nodes.forEach(node => {
      const durationText = `(${Number(node.duration) || 0}д)`;
      ctx.font = 'bold 12px Arial';
      const titleLines = wrapText(ctx, String(node.name || ''), maxWidth - padding * 2);
      const titleMaxWidth = Math.max(...titleLines.map(line => ctx.measureText(line).width), 0);
      ctx.font = '11px Arial';
      const durationWidth = ctx.measureText(durationText).width;
      const contentWidth = Math.max(titleMaxWidth, durationWidth);

      node._w = Math.max(minWidth, Math.min(maxWidth, contentWidth + padding * 2));
      node._h = padding * 2 + titleLines.length * lineHeight + 20;
      node._lines = titleLines;
      node._durationText = durationText;
    });
  };

const drawNodeLabel = (ctx, node) => {
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = colors.text;

  const label = ``;
  ctx.fillText(label, node.x, node.y - 40);
};

  const drawLegend = (ctx, width, height) => {
    const legendX = width - 220;
    const legendY = 20;
    const legendWidth = 200;
    const legendHeight = 140; 
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);
    
    ctx.fillStyle = colors.text;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Легенда', legendX + 10, legendY + 20);
    
    const items = renderMode === 'aon'
      ? [
          { color: colors.criticalNode, text: 'Критический узел', type: 'node' },
          { color: colors.normalNode,   text: 'Обычный узел',      type: 'node' },
          { color: colors.criticalEdge, text: 'Критический путь',  type: 'edge' },
        ]
      : [
          { color: colors.criticalNode, text: 'Критический узел', type: 'node' },
          { color: colors.normalNode,   text: 'Обычный узел',      type: 'node' },
          { color: colors.criticalEdge, text: 'Критическая работа',type: 'edge' },
          { color: colors.normalEdge,   text: 'Обычная работа',    type: 'edge' },
          { color: colors.normalEdge,   text: 'Фиктивная работа',  type: 'dummy', secondLine: '(пунктир)' }
        ];
    
    items.forEach((item, index) => {
      const y = legendY + 40 + index * 20;
      if (item.type === 'node') {
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(legendX + 15, y, 6, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 2;
        if (item.type === 'dummy') ctx.setLineDash([6, 6]); else ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(legendX + 8, y);
        ctx.lineTo(legendX + 24, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = colors.text;
      ctx.font = '11px Arial';
      ctx.fillText(item.text, legendX + 30, y + 3);
      
      if (item.secondLine) {
        ctx.fillText(item.secondLine, legendX + 30, y + 15);
      }
    });
  };

  const drawEmptyState = (ctx, width, height) => {
    ctx.fillStyle = colors.text;
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Выполните расчет для построения сетевого графика', width / 2, height / 2);
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
  };

  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Network className="h-5 w-5" />
            Сетевой график
          </h3>
          <p className="text-sm text-muted-foreground">
            Интерактивная диаграмма сетевого планирования
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={() => setScale(prev => prev * 1.2)} size="sm" variant="outline">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button onClick={() => setScale(prev => prev * 0.8)} size="sm" variant="outline">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button onClick={resetView} size="sm" variant="outline">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button onClick={exportDiagram} size="sm" variant="outline">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={showTimes ? "default" : "outline"}
                onClick={() => setShowTimes(!showTimes)}
              >
                {showTimes ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                Времена
              </Button>

              <Button
                size="sm"
                variant={showRegularLabels ? "default" : "outline"}
                onClick={() => setShowRegularLabels(!showRegularLabels)}
              >
                {showRegularLabels ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                Подписи обычных
              </Button>

              <Button
                size="sm"
                variant={showDummyLabels ? "default" : "outline"}
                onClick={() => setShowDummyLabels(!showDummyLabels)}
              >
                {showDummyLabels ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                Подписи фиктивных
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <select 
                value={colorScheme} 
                onChange={(e) => setColorScheme(e.target.value)}
                className="px-2 py-1 border rounded text-sm"
              >
                <option value="modern">Современная</option>
                <option value="classic">Классическая</option>
                <option value="dark">Темная</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Режим:</span>
              <select
                value={renderMode}
                onChange={(e) => setRenderMode(e.target.value)}
                className="px-2 py-1 border rounded text-sm"
              >
                <option value="aoa">AOA (работа=ребро)</option>
                <option value="aon">AON (работа=узел)</option>
              </select>
            </div>
            
            <div className="text-sm text-muted-foreground">
              Масштаб: {(scale * 100).toFixed(0)}%
            </div>
          </div>
        </CardContent>
      </Card>

      {results && results.criticalPath && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Критический путь:</strong> {results.criticalPath.join(' → ')}
            <br />
            <strong>Длительность проекта:</strong> {results.projectDuration?.toFixed(2)} дней
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          <canvas
            ref={canvasRef}
            className="w-full h-[600px] cursor-move border-0"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          />
        </CardContent>
      </Card>

      {results && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {results.tasks?.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Всего работ</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {results.tasks?.filter(t => !t.isDummy && t.isCritical).length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Критических работ</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {results.projectDuration?.toFixed(1) || 0}
              </div>
              <div className="text-sm text-muted-foreground">Дней проекта</div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
});

export default NetworkDiagram;
