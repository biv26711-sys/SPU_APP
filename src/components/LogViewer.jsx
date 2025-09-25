import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  Download, 
  Trash2, 
  Search, 
  Filter,
  Clock,
  User,
  AlertTriangle,
  Info,
  CheckCircle,
  FileText,
  BarChart3,
  ArrowLeft
} from 'lucide-react';
import logger from '../utils/logger';

const LogViewer = ({ onBack }) => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [statistics, setStatistics] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 5000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let filtered = [...logs];

    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => log.level === levelFilter);
    }

    if (actionFilter !== 'all') {
      filtered = filtered.filter(log => 
        log.action.toLowerCase().includes(actionFilter.toLowerCase())
      );
    }

    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm, levelFilter, actionFilter]);

  const loadLogs = () => {
    try {
      const allLogs = logger.getLogs();
      const stats = logger.getStatistics();
      
      setLogs(allLogs);
      setStatistics(stats);
      
      saveLogsToFile(allLogs);
    } catch (error) {
      console.error('Ошибка загрузки логов:', error);
    }
  };

  const saveLogsToFile = (logsData) => {
    try {
      const logContent = logsData.map(log => {
        const timestamp = new Date(log.timestamp).toLocaleString('ru-RU');
        const details = JSON.stringify(log.details, null, 2);
        return `[${timestamp}] [${log.level.toUpperCase()}] ${log.action}\nДетали: ${details}\nСессия: ${log.sessionId}\nURL: ${log.url}\n${'='.repeat(80)}`;
      }).join('\n\n');

      localStorage.setItem('spu_detailed_logs', logContent);
      localStorage.setItem('spu_logs_last_updated', new Date().toISOString());
    } catch (error) {
      console.error('Ошибка сохранения логов в файл:', error);
    }
  };

  const exportLogs = () => {
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        totalLogs: logs.length,
        statistics,
        logs: filteredLogs.map(log => ({
          timestamp: new Date(log.timestamp).toLocaleString('ru-RU'),
          level: log.level,
          action: log.action,
          details: log.details,
          sessionId: log.sessionId
        }))
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `spu_logs_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      logger.logUserAction('EXPORT_LOGS', { exportedCount: filteredLogs.length });
    } catch (error) {
      logger.logError('EXPORT_LOGS_ERROR', { error: error.message });
    }
  };

  const exportDetailedLogs = () => {
    try {
      const detailedContent = filteredLogs.map(log => {
        const timestamp = new Date(log.timestamp).toLocaleString('ru-RU');
        const details = JSON.stringify(log.details, null, 2);
        return `Время: ${timestamp}
Уровень: ${log.level.toUpperCase()}
Действие: ${log.action}
Детали: ${details}
Сессия: ${log.sessionId}
URL: ${log.url}
${'='.repeat(80)}`;
      }).join('\n\n');

      const header = `ЛОГИ СИСТЕМЫ СПУ
Дата экспорта: ${new Date().toLocaleString('ru-RU')}
Всего записей: ${filteredLogs.length}
Фильтры: Уровень=${levelFilter}, Действие=${actionFilter}, Поиск="${searchTerm}"

${'='.repeat(80)}

`;

      const fullContent = header + detailedContent;
      const dataBlob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `spu_detailed_logs_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      logger.logUserAction('EXPORT_DETAILED_LOGS', { exportedCount: filteredLogs.length });
    } catch (error) {
      logger.logError('EXPORT_DETAILED_LOGS_ERROR', { error: error.message });
    }
  };

  const clearLogs = () => {
    try {
      const clearedCount = logger.clearLogs();
      setLogs([]);
      setFilteredLogs([]);
      logger.logUserAction('CLEAR_LOGS', { clearedCount });
    } catch (error) {
      logger.logError('CLEAR_LOGS_ERROR', { error: error.message });
    }
  };

  const getLevelIcon = (level) => {
    switch (level) {
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getLevelBadgeVariant = (level) => {
    switch (level) {
      case 'error':
        return 'destructive';
      case 'warn':
        return 'secondary';
      case 'info':
        return 'outline';
      default:
        return 'default';
    }
  };

  const actionGroups = useMemo(() => {
    const groups = {};
    logs.forEach(log => {
      const actionType = log.action.split(':')[0] || log.action.split('_')[0] || 'OTHER';
      if (!groups[actionType]) {
        groups[actionType] = 0;
      }
      groups[actionType]++;
    });
    return groups;
  }, [logs]);

  if (!logs.length && !statistics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Activity className="h-5 w-5" />
            Просмотр логов
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Activity className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">Логи загружаются...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
    
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-bold">Логи системы</h2>
            <p className="text-muted-foreground">
              Журнал действий пользователя и системных событий
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportLogs} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            JSON
          </Button>
          <Button onClick={exportDetailedLogs} variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Детальный отчет
          </Button>
          <Button onClick={clearLogs} variant="outline" size="sm">
            <Trash2 className="h-4 w-4 mr-2" />
            Очистить
          </Button>
        </div>
      </div>

     
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Всего записей</p>
                  <p className="text-2xl font-bold">{statistics.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Сегодня</p>
                  <p className="text-2xl font-bold">{statistics.today}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Ошибки</p>
                  <p className="text-2xl font-bold">{statistics.levelCounts.error || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Сессии</p>
                  <p className="text-2xl font-bold">{statistics.sessions}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="logs" className="w-full">
        <TabsList>
          <TabsTrigger value="logs">Журнал событий</TabsTrigger>
          <TabsTrigger value="stats">Статистика</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Поиск по действиям и деталям..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Уровень" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все уровни</SelectItem>
                    <SelectItem value="info">Информация</SelectItem>
                    <SelectItem value="warn">Предупреждения</SelectItem>
                    <SelectItem value="error">Ошибки</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Действие" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все действия</SelectItem>
                    <SelectItem value="USER_ACTION">Пользователь</SelectItem>
                    <SelectItem value="SYSTEM_EVENT">Система</SelectItem>
                    <SelectItem value="CALCULATION">Расчеты</SelectItem>
                    <SelectItem value="FILE_OPERATION">Файлы</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="mt-2 text-sm text-muted-foreground">
                Показано {filteredLogs.length} из {logs.length} записей
              </div>
            </CardContent>
          </Card>

          
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto">
                {filteredLogs.length > 0 ? (
                  <div className="space-y-1">
                    {filteredLogs.map((log, index) => (
                      <div 
                        key={log.id || index}
                        className={`p-3 border-b hover:bg-gray-50 cursor-pointer ${
                          selectedLog === log.id ? 'bg-blue-50 border-blue-200' : ''
                        }`}
                        onClick={() => setSelectedLog(selectedLog === log.id ? null : log.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            {getLevelIcon(log.level)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{log.action}</span>
                                <Badge variant={getLevelBadgeVariant(log.level)}>
                                  {log.level}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {new Date(log.timestamp).toLocaleString('ru-RU')}
                              </p>
                              {selectedLog === log.id && (
                                <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                                  <pre className="whitespace-pre-wrap">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                  <div className="mt-2 text-muted-foreground">
                                    Сессия: {log.sessionId}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Activity className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">Логи не найдены</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  По уровням
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(statistics?.levelCounts || {}).map(([level, count]) => (
                    <div key={level} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getLevelIcon(level)}
                        <span className="capitalize">{level}</span>
                      </div>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  По типам действий
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(actionGroups).slice(0, 10).map(([action, count]) => (
                    <div key={action} className="flex items-center justify-between">
                      <span className="text-sm">{action}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

         
          <Card>
            <CardHeader>
              <CardTitle>Информация о сессии</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">Первая запись:</p>
                  <p className="text-muted-foreground">
                    {statistics?.firstLog ? new Date(statistics.firstLog).toLocaleString('ru-RU') : 'Нет данных'}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Последняя запись:</p>
                  <p className="text-muted-foreground">
                    {statistics?.lastLog ? new Date(statistics.lastLog).toLocaleString('ru-RU') : 'Нет данных'}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Активных сессий:</p>
                  <p className="text-muted-foreground">{statistics?.sessions || 0}</p>
                </div>
                <div>
                  <p className="font-medium">За эту неделю:</p>
                  <p className="text-muted-foreground">{statistics?.thisWeek || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LogViewer;

