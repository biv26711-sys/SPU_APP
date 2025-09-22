import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Network, 
  Plus, 
  Trash2, 
  Save,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Move
} from 'lucide-react';

const DragDropNetworkDiagram = ({ results, onUpdateTasks }) => {
  const canvasRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState(null);
  const [mode, setMode] = useState('move'); 

  useEffect(() => {
    if (results && results.tasks) {
      const initialNodes = results.tasks.map((task, index) => ({
        id: task.id,
        name: task.name,
        duration: task.duration,
        isCritical: task.isCritical,
        x: 100 + (index % 4) * 200,
        y: 100 + Math.floor(index / 4) * 150,
        width: 120,
        height: 80
      }));
      
      const initialConnections = [];
      results.tasks.forEach(task => {
        task.predecessors.forEach(predId => {
          initialConnections.push({
            from: predId,
            to: task.id,
            id: `${predId}-${task.id}`
          });
        });
      });

      setNodes(initialNodes);
      setConnections(initialConnections);
    }
  }, [results]);

  const drawDiagram = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(offset.x, offset.y);

    connections.forEach(conn => {
      const fromNode = nodes.find(n => n.id === conn.from);
      const toNode = nodes.find(n => n.id === conn.to);
      
      if (fromNode && toNode) {
        ctx.beginPath();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        
        const fromX = fromNode.x + fromNode.width;
        const fromY = fromNode.y + fromNode.height / 2;
        const toX = toNode.x;
        const toY = toNode.y + toNode.height / 2;
        
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
        
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const arrowLength = 10;
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(
          toX - arrowLength * Math.cos(angle - Math.PI / 6),
          toY - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(toX, toY);
        ctx.lineTo(
          toX - arrowLength * Math.cos(angle + Math.PI / 6),
          toY - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      }
    });

    nodes.forEach(node => {
      ctx.fillStyle = node.isCritical ? '#fee2e2' : '#f3f4f6';
      ctx.strokeStyle = node.isCritical ? '#dc2626' : '#6b7280';
      ctx.lineWidth = 2;
      
      if (selectedNode && selectedNode.id === node.id) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
      }
      
      ctx.fillRect(node.x, node.y, node.width, node.height);
      ctx.strokeRect(node.x, node.y, node.width, node.height);
      
      ctx.fillStyle = '#1f2937';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      
      ctx.fillText(node.id, node.x + node.width / 2, node.y + 20);
      
      const maxLength = 15;
      const displayName = node.name.length > maxLength 
        ? node.name.substring(0, maxLength) + '...' 
        : node.name;
      ctx.fillText(displayName, node.x + node.width / 2, node.y + 40);
      
      ctx.fillText(`${node.duration} дн.`, node.x + node.width / 2, node.y + 60);
    });

    ctx.restore();
  }, [nodes, connections, scale, offset, selectedNode]);

  useEffect(() => {
    drawDiagram();
  }, [drawDiagram]);

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x * scale) / scale;
    const y = (e.clientY - rect.top - offset.y * scale) / scale;

    const clickedNode = nodes.find(node =>
      x >= node.x && x <= node.x + node.width &&
      y >= node.y && y <= node.y + node.height
    );

    if (mode === 'connect' && clickedNode) {
      if (!isConnecting) {
        setIsConnecting(true);
        setConnectionStart(clickedNode);
      } else {
        if (connectionStart && connectionStart.id !== clickedNode.id) {
          const newConnection = {
            from: connectionStart.id,
            to: clickedNode.id,
            id: `${connectionStart.id}-${clickedNode.id}`
          };
          
          if (!connections.find(c => c.id === newConnection.id)) {
            setConnections([...connections, newConnection]);
          }
        }
        setIsConnecting(false);
        setConnectionStart(null);
      }
    } else if (mode === 'delete' && clickedNode) {
      setNodes(nodes.filter(n => n.id !== clickedNode.id));
      setConnections(connections.filter(c => c.from !== clickedNode.id && c.to !== clickedNode.id));
    } else if (mode === 'move') {
      if (clickedNode) {
        setSelectedNode(clickedNode);
        setIsDragging(true);
        setDragStart({ x: x - clickedNode.x, y: y - clickedNode.y });
      } else {
        setSelectedNode(null);
      }
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !selectedNode) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x * scale) / scale;
    const y = (e.clientY - rect.top - offset.y * scale) / scale;

    const updatedNodes = nodes.map(node =>
      node.id === selectedNode.id
        ? { ...node, x: x - dragStart.x, y: y - dragStart.y }
        : node
    );
    
    setNodes(updatedNodes);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setScale(prev => Math.min(prev * 1.2, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev / 1.2, 0.3));
  const handleReset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleSave = () => {
    if (onUpdateTasks) {
      const updatedTasks = results.tasks.map(task => {
        const taskConnections = connections.filter(c => c.to === task.id);
        const predecessors = taskConnections.map(c => c.from);
        return { ...task, predecessors };
      });
      onUpdateTasks(updatedTasks);
    }
  };

  if (!results || !results.tasks || results.tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Интерактивный сетевой график
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Network className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">
            Выполните расчет параметров для создания интерактивного сетевого графика
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Интерактивный сетевой график
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Панель инструментов */}
          <div className="flex flex-wrap gap-2 mb-4 p-2 bg-gray-50 rounded-lg">
            <Button
              variant={mode === 'move' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('move')}
            >
              <Move className="h-4 w-4 mr-1" />
              Перемещение
            </Button>
            <Button
              variant={mode === 'connect' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('connect')}
            >
              <Plus className="h-4 w-4 mr-1" />
              Соединение
            </Button>
            <Button
              variant={mode === 'delete' ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setMode('delete')}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Удаление
            </Button>
            
            <div className="border-l mx-2"></div>
            
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            
            <div className="border-l mx-2"></div>
            
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-1" />
              Сохранить
            </Button>
          </div>

          {/* Статус */}
          <div className="flex items-center gap-4 mb-4 text-sm">
            <span>Режим: <Badge variant="outline">{
              mode === 'move' ? 'Перемещение' :
              mode === 'connect' ? 'Соединение' :
              'Удаление'
            }</Badge></span>
            {isConnecting && (
              <span className="text-blue-600">
                Выберите узел для создания соединения...
              </span>
            )}
            <span>Масштаб: {Math.round(scale * 100)}%</span>
          </div>

          {/* Холст */}
          <div className="border rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>

          {/* Легенда */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Управление:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div>• <strong>Перемещение:</strong> Кликните и перетащите узел</div>
              <div>• <strong>Соединение:</strong> Кликните на два узла подряд</div>
              <div>• <strong>Удаление:</strong> Кликните на узел для удаления</div>
              <div>• <strong>Масштаб:</strong> Используйте кнопки + и -</div>
            </div>
          </div>

          {/* Информация о выбранном узле */}
          {selectedNode && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg">Свойства узла</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div><strong>ID:</strong> {selectedNode.id}</div>
                <div><strong>Название:</strong> {selectedNode.name}</div>
                <div><strong>Длительность:</strong> {selectedNode.duration} дн.</div>
                <div><strong>Критический путь:</strong> {selectedNode.isCritical ? 'Да' : 'Нет'}</div>
                <div><strong>Позиция:</strong> ({Math.round(selectedNode.x)}, {Math.round(selectedNode.y)})</div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DragDropNetworkDiagram;

