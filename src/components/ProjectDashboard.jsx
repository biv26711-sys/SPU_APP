import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Clock, 
  Target, 
  AlertTriangle,
  CheckCircle,
  Activity,
  Calendar,
  Zap,
  BarChart3,
  PieChart as PieChartIcon,
  Download,
  FileText
} from 'lucide-react';

const ProjectDashboard = ({ results, project }) => {
  const [selectedMetric, setSelectedMetric] = useState('duration');

  const dashboardData = useMemo(() => {
    if (!results || !results.tasks || results.tasks.length === 0) {
      return null;
    }

    const tasks = results.tasks;
    const criticalTasks = tasks.filter(task => task.isCritical);
    const nonCriticalTasks = tasks.filter(task => !task.isCritical);

    const durationStats = {
      total: results.projectDuration || 0,
      critical: criticalTasks.reduce((sum, task) => sum + task.duration, 0),
      nonCritical: nonCriticalTasks.reduce((sum, task) => sum + task.duration, 0),
      average: tasks.reduce((sum, task) => sum + task.duration, 0) / tasks.length,
      max: Math.max(...tasks.map(task => task.duration)),
      min: Math.min(...tasks.map(task => task.duration))
    };

    const resourceStats = {
      total: tasks.reduce((sum, task) => sum + task.numberOfPerformers, 0),
      critical: criticalTasks.reduce((sum, task) => sum + task.numberOfPerformers, 0),
      average: tasks.reduce((sum, task) => sum + task.numberOfPerformers, 0) / tasks.length,
      maxPerTask: Math.max(...tasks.map(task => task.numberOfPerformers)),
      totalWorkload: tasks.reduce((sum, task) => sum + (task.laborIntensity || task.duration), 0)
    };

    const taskDistribution = [
      { name: 'Критические', value: criticalTasks.length, color: '#ef4444' },
      { name: 'Некритические', value: nonCriticalTasks.length, color: '#22c55e' }
    ];

    const durationDistribution = tasks.map(task => ({
      name: task.id,
      duration: task.duration,
      isCritical: task.isCritical,
      resources: task.numberOfPerformers
    }));

    const resourceDistribution = {};
    tasks.forEach(task => {
      const key = `${task.numberOfPerformers} чел.`;
      if (!resourceDistribution[key]) {
        resourceDistribution[key] = { name: key, count: 0, totalDuration: 0 };
      }
      resourceDistribution[key].count++;
      resourceDistribution[key].totalDuration += task.duration;
    });

    const resourceChart = Object.values(resourceDistribution);

    const timeline = [];
    const timeSlots = Math.ceil(durationStats.total / 10);
    for (let i = 0; i < timeSlots; i++) {
      const startTime = i * 10;
      const endTime = (i + 1) * 10;
      
      const activeTasks = tasks.filter(task => 
        (task.earlyStart || 0) < endTime && (task.earlyFinish || task.duration) > startTime
      );
      
      const criticalActiveTasks = activeTasks.filter(task => task.isCritical);
      
      timeline.push({
        period: `${startTime}-${endTime}`,
        activeTasks: activeTasks.length,
        criticalTasks: criticalActiveTasks.length,
        resources: activeTasks.reduce((sum, task) => sum + task.numberOfPerformers, 0)
      });
    }

    const risks = [];
    
    if (criticalTasks.length / tasks.length > 0.5) {
      risks.push({
        level: 'high',
        title: 'Высокая доля критических работ',
        description: `${((criticalTasks.length / tasks.length) * 100).toFixed(1)}% работ находятся на критическом пути`
      });
    }

    const longTasks = tasks.filter(task => task.duration > durationStats.average * 2);
    if (longTasks.length > 0) {
      risks.push({
        level: 'medium',
        title: 'Длительные работы',
        description: `${longTasks.length} работ значительно превышают среднюю длительность`
      });
    }

    const singleResourceTasks = criticalTasks.filter(task => task.numberOfPerformers === 1);
    if (singleResourceTasks.length > 0) {
      risks.push({
        level: 'high',
        title: 'Узкие места в ресурсах',
        description: `${singleResourceTasks.length} критических работ выполняется одним исполнителем`
      });
    }

    return {
      stats: {
        duration: durationStats,
        resources: resourceStats,
        tasks: {
          total: tasks.length,
          critical: criticalTasks.length,
          nonCritical: nonCriticalTasks.length,
          criticalPercentage: (criticalTasks.length / tasks.length) * 100
        }
      },
      charts: {
        taskDistribution,
        durationDistribution,
        resourceChart,
        timeline
      },
      risks
    };
  }, [results]);

  if (!dashboardData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Дашборд проекта
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">
            Выполните расчет параметров для отображения дашборда проекта
          </p>
        </CardContent>
      </Card>
    );
  }

  const exportDashboard = () => {
    const dashboardReport = {
      projectName: project?.name || 'Проект СПУ',
      generatedAt: new Date().toISOString(),
      summary: dashboardData.stats,
      risks: dashboardData.risks,
      recommendations: [
        'Мониторинг критических работ для предотвращения задержек',
        'Оптимизация распределения ресурсов',
        'Регулярный контроль выполнения временных параметров'
      ]
    };

    const dataStr = JSON.stringify(dashboardReport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `dashboard_report_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Заголовок дашборда */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Дашборд проекта</h2>
          <p className="text-muted-foreground">
            Аналитика и ключевые показатели проекта СПУ
          </p>
        </div>
        <Button onClick={exportDashboard} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Экспорт отчета
        </Button>
      </div>

     
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Длительность проекта</p>
                <p className="text-2xl font-bold">{dashboardData.stats.duration.total.toFixed(1)} дн.</p>
                <p className="text-xs text-muted-foreground">
                  Среднее: {dashboardData.stats.duration.average.toFixed(1)} дн.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Target className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Всего работ</p>
                <p className="text-2xl font-bold">{dashboardData.stats.tasks.total}</p>
                <p className="text-xs text-muted-foreground">
                  Критических: {dashboardData.stats.tasks.critical}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Всего ресурсов</p>
                <p className="text-2xl font-bold">{dashboardData.stats.resources.total}</p>
                <p className="text-xs text-muted-foreground">
                  Среднее: {dashboardData.stats.resources.average.toFixed(1)} чел./работу
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Zap className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Критичность</p>
                <p className="text-2xl font-bold">{dashboardData.stats.tasks.criticalPercentage.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">
                  {dashboardData.stats.tasks.critical} из {dashboardData.stats.tasks.total} работ
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Анализ рисков */}
      {dashboardData.risks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Анализ рисков проекта
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboardData.risks.map((risk, index) => (
              <Alert key={index} className={
                risk.level === 'high' ? 'border-red-200 bg-red-50' :
                risk.level === 'medium' ? 'border-yellow-200 bg-yellow-50' :
                'border-blue-200 bg-blue-50'
              }>
                <AlertTriangle className={`h-4 w-4 ${
                  risk.level === 'high' ? 'text-red-600' :
                  risk.level === 'medium' ? 'text-yellow-600' :
                  'text-blue-600'
                }`} />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">{risk.title}</p>
                    <p className="text-sm">{risk.description}</p>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Распределение работ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dashboardData.charts.taskDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dashboardData.charts.taskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Длительность работ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dashboardData.charts.durationDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    `${value} дн.`, 
                    name === 'duration' ? 'Длительность' : name
                  ]}
                />
                <Bar 
                  dataKey="duration" 
                  fill={(entry) => entry.isCritical ? '#ef4444' : '#22c55e'}
                  name="Длительность"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Распределение ресурсов
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dashboardData.charts.resourceChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" name="Количество работ" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

       
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Загрузка по времени
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dashboardData.charts.timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="activeTasks" 
                  stackId="1"
                  stroke="#22c55e" 
                  fill="#22c55e" 
                  name="Активные работы"
                />
                <Area 
                  type="monotone" 
                  dataKey="criticalTasks" 
                  stackId="2"
                  stroke="#ef4444" 
                  fill="#ef4444" 
                  name="Критические работы"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

     
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Индикаторы проекта
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Критичность проекта</span>
              <span>{dashboardData.stats.tasks.criticalPercentage.toFixed(1)}%</span>
            </div>
            <Progress value={dashboardData.stats.tasks.criticalPercentage} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Эффективность ресурсов</span>
              <span>{((dashboardData.stats.resources.critical / dashboardData.stats.resources.total) * 100).toFixed(1)}%</span>
            </div>
            <Progress 
              value={(dashboardData.stats.resources.critical / dashboardData.stats.resources.total) * 100} 
              className="h-2" 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <CheckCircle className="h-6 w-6 mx-auto text-green-600 mb-2" />
              <p className="text-sm font-medium">Готовность к запуску</p>
              <p className="text-xs text-muted-foreground">Все параметры рассчитаны</p>
            </div>
            
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <Calendar className="h-6 w-6 mx-auto text-blue-600 mb-2" />
              <p className="text-sm font-medium">Планирование</p>
              <p className="text-xs text-muted-foreground">Сетевой график построен</p>
            </div>
            
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <Activity className="h-6 w-6 mx-auto text-purple-600 mb-2" />
              <p className="text-sm font-medium">Контроль</p>
              <p className="text-xs text-muted-foreground">Ресурсы распределены</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectDashboard;

