import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  FolderTree, 
  Plus, 
  Minus, 
  Edit, 
  Trash2, 
  ChevronRight, 
  ChevronDown,
  Save,
  FolderOpen,
  Folder,
  FileText
} from 'lucide-react';

const WBSHierarchy = ({ tasks, onUpdateTasks }) => {
  const [wbsTree, setWbsTree] = useState([]);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [editingNode, setEditingNode] = useState(null);
  const [newNodeForm, setNewNodeForm] = useState({
    name: '',
    parentId: null,
    type: 'group'
  });
  const [showNewNodeForm, setShowNewNodeForm] = useState(false);

  useEffect(() => {
    if (tasks && tasks.length > 0) {
      const initialTree = buildWBSTree(tasks);
      setWbsTree(initialTree);
      const rootIds = initialTree.map(node => node.id);
      setExpandedNodes(new Set(rootIds));
    }
  }, [tasks]);

  const buildWBSTree = (taskList) => {
    const groups = new Map();
    const tree = [];

    taskList.forEach(task => {
      const parts = task.id.split('-');
      let currentLevel = tree;
      let currentPath = '';

      parts.forEach((part, index) => {
        currentPath += (index > 0 ? '-' : '') + part;
        
        if (index === parts.length - 1) {
          currentLevel.push({
            id: task.id,
            name: task.name,
            type: 'task',
            level: index,
            task: task,
            children: []
          });
        } else {
          let group = currentLevel.find(node => node.id === currentPath);
          if (!group) {
            group = {
              id: currentPath,
              name: `Группа ${currentPath}`,
              type: 'group',
              level: index,
              children: [],
              summary: {
                totalTasks: 0,
                totalDuration: 0,
                criticalTasks: 0
              }
            };
            currentLevel.push(group);
          }
          currentLevel = group.children;
        }
      });
    });

    const calculateSummary = (nodes) => {
      nodes.forEach(node => {
        if (node.type === 'group') {
          calculateSummary(node.children);
          
          node.summary = node.children.reduce((acc, child) => {
            if (child.type === 'task') {
              acc.totalTasks += 1;
              acc.totalDuration += child.task.duration;
              if (child.task.isCritical) acc.criticalTasks += 1;
            } else {
              acc.totalTasks += child.summary.totalTasks;
              acc.totalDuration += child.summary.totalDuration;
              acc.criticalTasks += child.summary.criticalTasks;
            }
            return acc;
          }, { totalTasks: 0, totalDuration: 0, criticalTasks: 0 });
        }
      });
    };

    calculateSummary(tree);
    return tree;
  };

  const toggleExpanded = (nodeId) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const renderNode = (node, depth = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const indent = depth * 20;

    return (
      <div key={node.id} className="select-none">
        <div 
          className={`flex items-center py-2 px-2 hover:bg-gray-50 rounded cursor-pointer ${
            editingNode?.id === node.id ? 'bg-blue-50' : ''
          }`}
          style={{ paddingLeft: `${indent + 8}px` }}
          onClick={() => node.type === 'group' && toggleExpanded(node.id)}
        >
          
          <div className="w-6 h-6 flex items-center justify-center">
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )
            ) : null}
          </div>

         
          <div className="w-6 h-6 flex items-center justify-center mr-2">
            {node.type === 'group' ? (
              isExpanded ? (
                <FolderOpen className="h-4 w-4 text-blue-500" />
              ) : (
                <Folder className="h-4 w-4 text-blue-500" />
              )
            ) : (
              <FileText className="h-4 w-4 text-green-500" />
            )}
          </div>

          
          <div className="flex-1">
            <span className="font-medium">{node.name}</span>
            {node.type === 'task' && node.task.isCritical && (
              <Badge variant="destructive" className="ml-2 text-xs">
                Критическая
              </Badge>
            )}
          </div>

         
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {node.type === 'group' ? (
              <>
                <span>{node.summary.totalTasks} задач</span>
                <span>{node.summary.totalDuration.toFixed(1)} дн.</span>
                {node.summary.criticalTasks > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {node.summary.criticalTasks} крит.
                  </Badge>
                )}
              </>
            ) : (
              <>
                <span>{node.task.duration} дн.</span>
                <span>{node.task.numberOfPerformers} исп.</span>
              </>
            )}
          </div>

        
          <div className="flex items-center gap-1 ml-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setEditingNode(node);
              }}
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteNode(node);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setNewNodeForm({ ...newNodeForm, parentId: node.id });
                setShowNewNodeForm(true);
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const handleAddNode = () => {
    if (!newNodeForm.name.trim()) return;

    const newNode = {
      id: generateNodeId(),
      name: newNodeForm.name,
      type: newNodeForm.type,
      level: 0,
      children: []
    };

    if (newNodeForm.type === 'task') {
      newNode.task = {
        id: newNode.id,
        name: newNode.name,
        duration: 1,
        laborIntensity: 8,
        numberOfPerformers: 1,
        predecessors: [],
        isCritical: false
      };
    } else {
      newNode.summary = {
        totalTasks: 0,
        totalDuration: 0,
        criticalTasks: 0
      };
    }

    const updatedTree = addNodeToTree(wbsTree, newNode, newNodeForm.parentId);
    setWbsTree(updatedTree);

    if (newNodeForm.type === 'task') {
      const flatTasks = flattenTreeToTasks(updatedTree);
      onUpdateTasks && onUpdateTasks(flatTasks);
    }

    setNewNodeForm({ name: '', parentId: null, type: 'group' });
    setShowNewNodeForm(false);
  };

  const generateNodeId = () => {
    const existingIds = flattenTree(wbsTree).map(node => node.id);
    let counter = 1;
    let newId;
    
    do {
      newId = newNodeForm.parentId ? `${newNodeForm.parentId}-${counter}` : `${counter}`;
      counter++;
    } while (existingIds.includes(newId));
    
    return newId;
  };

  const addNodeToTree = (tree, newNode, parentId) => {
    if (!parentId) {
      return [...tree, newNode];
    }

    return tree.map(node => {
      if (node.id === parentId) {
        return {
          ...node,
          children: [...node.children, newNode]
        };
      } else if (node.children) {
        return {
          ...node,
          children: addNodeToTree(node.children, newNode, parentId)
        };
      }
      return node;
    });
  };

  const handleDeleteNode = (nodeToDelete) => {
    if (confirm(`Удалить "${nodeToDelete.name}"${nodeToDelete.children?.length ? ' и все дочерние элементы' : ''}?`)) {
      const updatedTree = deleteNodeFromTree(wbsTree, nodeToDelete.id);
      setWbsTree(updatedTree);
      
      const flatTasks = flattenTreeToTasks(updatedTree);
      onUpdateTasks && onUpdateTasks(flatTasks);
    }
  };

  const deleteNodeFromTree = (tree, nodeId) => {
    return tree.filter(node => {
      if (node.id === nodeId) {
        return false;
      }
      if (node.children) {
        node.children = deleteNodeFromTree(node.children, nodeId);
      }
      return true;
    });
  };

  const flattenTreeToTasks = (tree) => {
    const tasks = [];
    
    const traverse = (nodes) => {
      nodes.forEach(node => {
        if (node.type === 'task' && node.task) {
          tasks.push(node.task);
        }
        if (node.children) {
          traverse(node.children);
        }
      });
    };
    
    traverse(tree);
    return tasks;
  };

  const flattenTree = (tree) => {
    const nodes = [];
    
    const traverse = (nodeList) => {
      nodeList.forEach(node => {
        nodes.push(node);
        if (node.children) {
          traverse(node.children);
        }
      });
    };
    
    traverse(tree);
    return nodes;
  };

  const handleSave = () => {
    const flatTasks = flattenTreeToTasks(wbsTree);
    onUpdateTasks && onUpdateTasks(flatTasks);
  };

  if (!tasks || tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            WBS - Иерархическая структура работ
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <FolderTree className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">
            Добавьте задачи для создания иерархической структуры работ
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
            <FolderTree className="h-5 w-5" />
            WBS - Иерархическая структура работ
          </CardTitle>
        </CardHeader>
        <CardContent>
          
          <div className="flex flex-wrap gap-2 mb-4 p-2 bg-gray-50 rounded-lg">
            <Button
              onClick={() => setShowNewNodeForm(true)}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Добавить элемент
            </Button>
            <Button
              onClick={handleSave}
              variant="outline"
              size="sm"
            >
              <Save className="h-4 w-4 mr-1" />
              Сохранить структуру
            </Button>
          </div>

         
          <div className="border rounded-lg bg-white max-h-96 overflow-y-auto">
            {wbsTree.length > 0 ? (
              wbsTree.map(node => renderNode(node))
            ) : (
              <div className="text-center py-8 text-gray-500">
                Структура WBS пуста
              </div>
            )}
          </div>

          
          {showNewNodeForm && (
            <Card className="mt-4 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg">Добавить новый элемент</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="node-name">Название</Label>
                  <Input
                    id="node-name"
                    value={newNodeForm.name}
                    onChange={(e) => setNewNodeForm({
                      ...newNodeForm,
                      name: e.target.value
                    })}
                    placeholder="Введите название"
                  />
                </div>
                
                <div>
                  <Label>Тип элемента</Label>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant={newNodeForm.type === 'group' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setNewNodeForm({ ...newNodeForm, type: 'group' })}
                    >
                      <Folder className="h-4 w-4 mr-1" />
                      Группа
                    </Button>
                    <Button
                      variant={newNodeForm.type === 'task' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setNewNodeForm({ ...newNodeForm, type: 'task' })}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Задача
                    </Button>
                  </div>
                </div>

                {newNodeForm.parentId && (
                  <div>
                    <Label>Родительский элемент</Label>
                    <div className="text-sm text-gray-600 mt-1">
                      {newNodeForm.parentId}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleAddNode}>Добавить</Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowNewNodeForm(false);
                      setNewNodeForm({ name: '', parentId: null, type: 'group' });
                    }}
                  >
                    Отмена
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

        
          {editingNode && (
            <Card className="mt-4 border-green-200">
              <CardHeader>
                <CardTitle className="text-lg">
                  Редактирование: {editingNode.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="edit-name">Название</Label>
                  <Input
                    id="edit-name"
                    value={editingNode.name}
                    onChange={(e) => setEditingNode({
                      ...editingNode,
                      name: e.target.value
                    })}
                  />
                </div>

                {editingNode.type === 'task' && editingNode.task && (
                  <>
                    <div>
                      <Label htmlFor="edit-duration">Длительность (дни)</Label>
                      <Input
                        id="edit-duration"
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={editingNode.task.duration}
                        onChange={(e) => setEditingNode({
                          ...editingNode,
                          task: {
                            ...editingNode.task,
                            duration: parseFloat(e.target.value) || 1
                          }
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-performers">Количество исполнителей</Label>
                      <Input
                        id="edit-performers"
                        type="number"
                        min="1"
                        value={editingNode.task.numberOfPerformers}
                        onChange={(e) => setEditingNode({
                          ...editingNode,
                          task: {
                            ...editingNode.task,
                            numberOfPerformers: parseInt(e.target.value) || 1
                          }
                        })}
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  <Button onClick={() => {
                    const updateNodeInTree = (tree, updatedNode) => {
                      return tree.map(node => {
                        if (node.id === updatedNode.id) {
                          return updatedNode;
                        } else if (node.children) {
                          return {
                            ...node,
                            children: updateNodeInTree(node.children, updatedNode)
                          };
                        }
                        return node;
                      });
                    };

                    const updatedTree = updateNodeInTree(wbsTree, editingNode);
                    setWbsTree(updatedTree);
                    setEditingNode(null);

                    if (editingNode.type === 'task') {
                      const flatTasks = flattenTreeToTasks(updatedTree);
                      onUpdateTasks && onUpdateTasks(flatTasks);
                    }
                  }}>
                    Сохранить
                  </Button>
                  <Button variant="outline" onClick={() => setEditingNode(null)}>
                    Отмена
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Статистика структуры:</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Всего элементов:</span>
                <div className="font-medium">{flattenTree(wbsTree).length}</div>
              </div>
              <div>
                <span className="text-gray-600">Групп:</span>
                <div className="font-medium">
                  {flattenTree(wbsTree).filter(n => n.type === 'group').length}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Задач:</span>
                <div className="font-medium">
                  {flattenTree(wbsTree).filter(n => n.type === 'task').length}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Общая длительность:</span>
                <div className="font-medium">
                  {flattenTreeToTasks(wbsTree).reduce((sum, task) => sum + task.duration, 0).toFixed(1)} дн.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WBSHierarchy;

