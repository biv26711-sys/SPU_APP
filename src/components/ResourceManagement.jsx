import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  BarChart3,
  Calendar,
  Target,
  Activity,
  Zap
} from 'lucide-react';
import { calcLaborHours } from '../utils/time.js';

function getTaskWorkloadHours(task, hoursPerDay) {
  const labor = Number(task.laborIntensity);
  if (Number.isFinite(labor)) return labor;
  return calcLaborHours(task.duration, task.numberOfPerformers, hoursPerDay);
}

const ResourceManagement = ({ results, project, hoursPerDay = 8 }) => {
  const [selectedResource, setSelectedResource] = useState(null);
  const [timeFilter, setTimeFilter] = useState('all');

  const analysis = useMemo(() => {
    if (!results || !results.tasks || results.tasks.length === 0) {
      return null;
    }

    const tasks = results.tasks;
    
    const criticalTasks = tasks.filter(task => task.isCritical);
    const criticalPathAnalysis = {
      tasks: criticalTasks,
      totalDuration: results.projectDuration || 0,
      path: results.criticalPath || [],
      bottlenecks: criticalTasks.filter(task => task.numberOfPerformers === 1),
      highRiskTasks: criticalTasks.filter(task => task.duration > 20)
    };

    const resourceAnalysis = {};
    const timelineAnalysis = [];
    
    tasks.forEach(task => {
      const resourceKey = `Исполнители (${task.numberOfPerformers} чел.)`;
      if (!resourceAnalysis[resourceKey]) {
        resourceAnalysis[resourceKey] = {
          name: resourceKey,
          totalTasks: 0,
          totalDuration: 0,
          totalWorkload: 0,
          criticalTasks: 0,
          tasks: []
        };
      }
      
      resourceAnalysis[resourceKey].totalTasks++;
      resourceAnalysis[resourceKey].totalDuration += task.duration;
      resourceAnalysis[resourceKey].totalWorkload += getTaskWorkloadHours(task, hoursPerDay);
      if (task.isCritical) {
        resourceAnalysis[resourceKey].criticalTasks++;
      }
      resourceAnalysis[resourceKey].tasks.push(task);
    });

    const maxTime = Math.max(...tasks.map(t => t.earlyFinish || t.duration));
    const timeSlots = Math.ceil(maxTime / 10); 
    
    for (let i = 0; i < timeSlots; i++) {
      const startTime = i * 10;
      const endTime = (i + 1) * 10;
      
      const activeTasks = tasks.filter(task => 
        (task.earlyStart || 0) < endTime && (task.earlyFinish || task.duration) > startTime
      );
      
      const totalResources = activeTasks.reduce((sum, task) => sum + task.numberOfPerformers, 0);
      const criticalResources = activeTasks
        .filter(task => task.isCritical)
        .reduce((sum, task) => sum + task.numberOfPerformers, 0);
      
      timelineAnalysis.push({
        period: `${startTime}-${endTime} дн.`,
        startTime,
        endTime,
        activeTasks: activeTasks.length,
        totalResources,
        criticalResources,
        utilization: totalResources > 0 ? (criticalResources / totalResources) * 100 : 0
      });
    }

    const recommendations = [];
    
    if (criticalPathAnalysis.bottlenecks.length > 0) {
      recommendations.push({
        type: 'warning',
        title: 'Узкие места в критическом пути',
        description: `Обнаружено ${criticalPathAnalysis.bottlenecks.length} работ с одним исполнителем на критическом пути`,
        action: 'Рассмотрите возможность добавления дополнительных ресурсов'
      });
    }

    if (criticalPathAnalysis.highRiskTasks.length > 0) {
      recommendations.push({
        type: 'error',
        title: 'Длительные критические работы',
        description: `${criticalPathAnalysis.highRiskTasks.length} критических работ длительностью более 20 дней`,
        action: 'Разбейте длительные работы на более мелкие этапы'
      });
    }

    const maxUtilization = Math.max(...timelineAnalysis.map(t => t.utilization));
    if (maxUtilization > 80) {
      recommendations.push({
        type: 'warning',
        title: 'Высокая загрузка ресурсов',
        description: `Пиковая загрузка ресурсов достигает ${maxUtilization.toFixed(1)}%`,
        action: 'Рассмотрите перераспределение нагрузки между периодами'
      });
    }

    return {
      criticalPath: criticalPathAnalysis,
      resources: Object.values(resourceAnalysis),
      timeline: timelineAnalysis,
      recommendations,
      summary: {
        totalTasks: tasks.length,
        criticalTasks: criticalTasks.length,
        totalResources: tasks.reduce((sum, task) => sum + task.numberOfPerformers, 0),
        averageUtilization: timelineAnalysis.reduce((sum, t) => sum + t.utilization, 0) / timelineAnalysis.length
      }
    };
  }, [results, hoursPerDay]);

  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Управление ресурсами и анализ критического пути
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">
            Выполните расчет параметров для анализа ресурсов и критического пути
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Сводная информация */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Всего работ</p>
                <p className="text-2xl font-bold">{analysis.summary.totalTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Критических</p>
                <p className="text-2xl font-bold text-red-600">{analysis.summary.criticalTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Всего ресурсов</p>
                <p className="text-2xl font-bold">{analysis.summary.totalResources}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Средняя загрузка</p>
                <p className="text-2xl font-bold">{analysis.summary.averageUtilization.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Рекомендации */}
      {analysis.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Рекомендации по оптимизации
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.recommendations.map((rec, index) => (
              <Alert key={index} className={
                rec.type === 'error' ? 'border-red-200 bg-red-50' :
                rec.type === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                'border-blue-200 bg-blue-50'
              }>
                <AlertTriangle className={`h-4 w-4 ${
                  rec.type === 'error' ? 'text-red-600' :
                  rec.type === 'warning' ? 'text-yellow-600' :
                  'text-blue-600'
                }`} />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">{rec.title}</p>
                    <p className="text-sm">{rec.description}</p>
                    <p className="text-sm font-medium">💡 {rec.action}</p>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="critical-path" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="critical-path">Критический путь</TabsTrigger>
          <TabsTrigger value="resources">Ресурсы</TabsTrigger>
          <TabsTrigger value="timeline">Временная шкала</TabsTrigger>
        </TabsList>

        {/* Анализ критического пути */}
        <TabsContent value="critical-path">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Анализ критического пути
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Длительность проекта</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {analysis.criticalPath.totalDuration.toFixed(1)} дней
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Критических работ</p>
                  <p className="text-2xl font-bold text-red-600">
                    {analysis.criticalPath.tasks.length}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Узких мест</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {analysis.criticalPath.bottlenecks.length}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-medium">Путь:</p>
                <div className="flex flex-wrap gap-2">
                  {analysis.criticalPath.path.map((node, index) => (
                    <React.Fragment key={node}>
                      <Badge variant="destructive">{node}</Badge>
                      {index < analysis.criticalPath.path.length - 1 && (
                        <span className="text-muted-foreground">→</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="font-medium">Критические работы:</p>
                <div className="space-y-2">
                  {analysis.criticalPath.tasks.map((task) => (
                    <div key={task.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{task.id} - {task.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Длительность: {task.duration} дн., Исполнители: {task.numberOfPerformers} чел.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="destructive">Критическая</Badge>
                          {task.numberOfPerformers === 1 && (
                            <Badge variant="outline">Узкое место</Badge>
                          )}
                          {task.duration > 20 && (
                            <Badge variant="secondary">Длительная</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Анализ ресурсов */}
        <TabsContent value="resources">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Анализ ресурсов
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.resources.map((resource, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{resource.name}</h4>
                    <Badge variant="outline">
                      {resource.totalTasks} работ
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Общая длительность</p>
                      <p className="font-medium">{resource.totalDuration.toFixed(1)} дн.</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Трудозатраты</p>
                      <p className="font-medium">{resource.totalWorkload.toFixed(1)} н-ч</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Критических работ</p>
                      <p className="font-medium text-red-600">{resource.criticalTasks}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Загрузка</p>
                      <p className="font-medium">
                        {((resource.criticalTasks / resource.totalTasks) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Работы:</p>
                    <div className="flex flex-wrap gap-1">
                      {resource.tasks.map((task) => (
                        <Badge 
                          key={task.id} 
                          variant={task.isCritical ? "destructive" : "outline"}
                          className="text-xs"
                        >
                          {task.id}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Временная шкала */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Анализ временной шкалы
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {analysis.timeline.map((period, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{period.period}</h4>
                      <Badge variant={period.utilization > 80 ? "destructive" : period.utilization > 60 ? "secondary" : "outline"}>
                        {period.utilization.toFixed(1)}% загрузка
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <Progress value={period.utilization} className="h-2" />
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Активных работ</p>
                          <p className="font-medium">{period.activeTasks}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Всего ресурсов</p>
                          <p className="font-medium">{period.totalResources}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">На критическом пути</p>
                          <p className="font-medium text-red-600">{period.criticalResources}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ResourceManagement;
