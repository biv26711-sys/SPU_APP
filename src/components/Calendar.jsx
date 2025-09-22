import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar as CalendarIcon, Clock, Plus, Edit, Trash2, AlertTriangle, CheckCircle, Search, Filter, X } from 'lucide-react';
import { format, addDays, parseISO, isWeekend, differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay } from 'date-fns';
import { ru } from 'date-fns/locale';

// Российские праздники (выходные дни)
const RUSSIAN_HOLIDAYS = [
  // 2024 год
  { date: '2024-01-01', name: 'Новый год', type: 'federal' },
  { date: '2024-01-02', name: 'Новогодние каникулы', type: 'federal' },
  { date: '2024-01-03', name: 'Новогодние каникулы', type: 'federal' },
  { date: '2024-01-04', name: 'Новогодние каникулы', type: 'federal' },
  { date: '2024-01-05', name: 'Новогодние каникулы', type: 'federal' },
  { date: '2024-01-06', name: 'Новогодние каникулы', type: 'federal' },
  { date: '2024-01-07', name: 'Рождество Христово', type: 'federal' },
  { date: '2024-01-08', name: 'Новогодние каникулы', type: 'federal' },
  { date: '2024-02-23', name: 'День защитника Отечества', type: 'federal' },
  { date: '2024-03-08', name: 'Международный женский день', type: 'federal' },
  { date: '2024-04-29', name: 'Пасха', type: 'religious' },
  { date: '2024-05-01', name: 'Праздник Весны и Труда', type: 'federal' },
  { date: '2024-05-09', name: 'День Победы', type: 'federal' },
  { date: '2024-06-12', name: 'День России', type: 'federal' },
  { date: '2024-11-04', name: 'День народного единства', type: 'federal' },
  
  // 2025 год
  { date: '2025-01-01', name: 'Новый год', type: 'federal' },
  { date: '2025-01-02', name: 'Новогодние каникулы', type: 'federal' },
  { date: '2025-01-03', name: 'Новогодние каникулы', type: 'federal' },
  { date: '2025-01-04', name: 'Новогодние каникулы', type: 'federal' },
  { date: '2025-01-05', name: 'Новогодние каникулы', type: 'federal' },
  { date: '2025-01-06', name: 'Новогодние каникулы', type: 'federal' },
  { date: '2025-01-07', name: 'Рождество Христово', type: 'federal' },
  { date: '2025-01-08', name: 'Новогодние каникулы', type: 'federal' },
  { date: '2025-02-23', name: 'День защитника Отечества', type: 'federal' },
  { date: '2025-03-08', name: 'Международный женский день', type: 'federal' },
  { date: '2025-04-20', name: 'Пасха', type: 'religious' },
  { date: '2025-05-01', name: 'Праздник Весны и Труда', type: 'federal' },
  { date: '2025-05-09', name: 'День Победы', type: 'federal' },
  { date: '2025-06-12', name: 'День России', type: 'federal' },
  { date: '2025-11-04', name: 'День народного единства', type: 'federal' },
  
  // 2026 год
  { date: '2026-01-01', name: 'Новый год', type: 'federal' },
  { date: '2026-01-02', name: 'Новогодние каникулы', type: 'federal' },
  { date: '2026-01-03', name: 'Новогодние каникулы', type: 'federal' },
  { date: '2026-01-04', name: 'Новогодние каникулы', type: 'federal' },
  { date: '2026-01-05', name: 'Новогодние каникулы', type: 'federal' },
  { date: '2026-01-06', name: 'Новогодние каникулы', type: 'federal' },
  { date: '2026-01-07', name: 'Рождество Христово', type: 'federal' },
  { date: '2026-01-08', name: 'Новогодние каникулы', type: 'federal' },
  { date: '2026-02-23', name: 'День защитника Отечества', type: 'federal' },
  { date: '2026-03-08', name: 'Международный женский день', type: 'federal' },
  { date: '2026-04-12', name: 'Пасха', type: 'religious' },
  { date: '2026-05-01', name: 'Праздник Весны и Труда', type: 'federal' },
  { date: '2026-05-09', name: 'День Победы', type: 'federal' },
  { date: '2026-06-12', name: 'День России', type: 'federal' },
  { date: '2026-11-04', name: 'День народного единства', type: 'federal' }
];

const Calendar = ({ project, results, onProjectUpdate }) => {
  const [projectStartDate, setProjectStartDate] = useState(
    project?.startDate || new Date().toISOString().split('T')[0]
  );
  const [workingDays, setWorkingDays] = useState({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false
  });
  const [holidays, setHolidays] = useState(() => {
    return RUSSIAN_HOLIDAYS.map((holiday, index) => ({
      id: index + 1,
      date: holiday.date,
      name: holiday.name,
      type: holiday.type
    }));
  });
  const [newHoliday, setNewHoliday] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [taskSchedule, setTaskSchedule] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [newMilestone, setNewMilestone] = useState({ name: '', date: '', description: '' });
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [holidayFilter, setHolidayFilter] = useState('all');
  const [holidaySearch, setHolidaySearch] = useState('');

  useEffect(() => {
    if (results && results.tasks && projectStartDate) {
      calculateTaskSchedule();
    }
  }, [results, projectStartDate, workingDays, holidays]);

  const isWorkingDay = (date) => {
    const dayOfWeek = date.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    if (!workingDays[dayNames[dayOfWeek]]) {
      return false;
    }
    
    const dateString = date.toISOString().split('T')[0];
    return !holidays.some(holiday => holiday.date === dateString);
  };

  const addWorkingDays = (startDate, daysToAdd) => {
    let currentDate = new Date(startDate);
    let addedDays = 0;
    
    while (addedDays < daysToAdd) {
      currentDate = addDays(currentDate, 1);
      if (isWorkingDay(currentDate)) {
        addedDays++;
      }
    }
    
    return currentDate;
  };

  const calculateTaskSchedule = () => {
    if (!results || !results.tasks || !projectStartDate) return;

    const startDate = new Date(projectStartDate);
    const schedule = [];
    
    results.tasks.forEach(task => {
      const taskStartDate = addWorkingDays(startDate, task.earlyStart || 0);
      const taskEndDate = addWorkingDays(taskStartDate, task.duration - 1);
      
      const lateStartDate = addWorkingDays(startDate, task.lateStart || task.earlyStart || 0);
      const lateEndDate = addWorkingDays(lateStartDate, task.duration - 1);
      
      schedule.push({
        ...task,
        startDate: taskStartDate,
        endDate: taskEndDate,
        lateStartDate: lateStartDate,
        lateEndDate: lateEndDate,
        calendarDuration: differenceInDays(taskEndDate, taskStartDate) + 1,
        workingDays: task.duration
      });
    });

    setTaskSchedule(schedule);
    
    if (onProjectUpdate) {
      onProjectUpdate({
        ...project,
        startDate: projectStartDate,
        schedule: schedule,
        workingDays: workingDays,
        holidays: holidays
      });
    }
  };

  const addHoliday = () => {
    if (!newHoliday || !holidayName) return;
    
    const holiday = {
      id: Date.now(),
      date: newHoliday,
      name: holidayName,
      type: 'custom'
    };
    
    setHolidays([...holidays, holiday]);
    setNewHoliday('');
    setHolidayName('');
  };

  const removeHoliday = (holidayId) => {
    setHolidays(holidays.filter(h => h.id !== holidayId));
  };

  const addMilestone = () => {
    if (!newMilestone.name || !newMilestone.date) return;
    
    const milestone = {
      id: Date.now(),
      ...newMilestone
    };
    
    setMilestones([...milestones, milestone]);
    setNewMilestone({ name: '', date: '', description: '' });
  };

  const removeMilestone = (milestoneId) => {
    setMilestones(milestones.filter(m => m.id !== milestoneId));
  };

  const updateWorkingDay = (day, isWorking) => {
    setWorkingDays({
      ...workingDays,
      [day]: isWorking
    });
  };

  const getTaskStatus = (task) => {
    const today = new Date();
    const startDate = new Date(task.startDate);
    const endDate = new Date(task.endDate);
    
    if (today < startDate) {
      return { status: 'planned', label: 'Запланирована', color: 'blue' };
    } else if (today >= startDate && today <= endDate) {
      return { status: 'in-progress', label: 'Выполняется', color: 'yellow' };
    } else {
      return { status: 'completed', label: 'Завершена', color: 'green' };
    }
  };

  const exportCalendar = () => {
    const calendarData = {
      project: {
        name: project?.name || 'Проект СПУ',
        startDate: projectStartDate,
        duration: results?.projectDuration || 0
      },
      workingDays,
      holidays,
      milestones,
      schedule: taskSchedule.map(task => ({
        id: task.id,
        name: task.name,
        startDate: format(task.startDate, 'yyyy-MM-dd'),
        endDate: format(task.endDate, 'yyyy-MM-dd'),
        duration: task.duration,
        workingDays: task.workingDays,
        calendarDuration: task.calendarDuration,
        isCritical: task.isCritical,
        resources: task.numberOfPerformers
      }))
    };

    const dataStr = JSON.stringify(calendarData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `calendar_${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Функции для красивого календаря
  const getDaysInMonth = (date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    return eachDayOfInterval({ start, end });
  };

  const getCalendarDays = (date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const startWeek = addDays(start, -getDay(start) + 1);
    const endWeek = addDays(end, 7 - getDay(end));
    
    return eachDayOfInterval({ start: startWeek, end: endWeek });
  };

  const getDayInfo = (day) => {
    const dateString = format(day, 'yyyy-MM-dd');
    const holiday = holidays.find(h => h.date === dateString);
    const milestone = milestones.find(m => m.date === dateString);
    const tasksOnDay = taskSchedule.filter(task => 
      day >= task.startDate && day <= task.endDate
    );
    
    return {
      isHoliday: !!holiday,
      holidayName: holiday?.name,
      holidayType: holiday?.type,
      milestone,
      tasks: tasksOnDay,
      isWeekend: !isWorkingDay(day) && !holiday
    };
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentCalendarDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentCalendarDate(newDate);
  };

  const getHolidayTypeColor = (type) => {
    switch (type) {
      case 'federal': return 'bg-red-100 border-red-300 text-red-800';
      case 'religious': return 'bg-purple-100 border-purple-300 text-purple-800';
      case 'custom': return 'bg-orange-100 border-orange-300 text-orange-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getHolidayTypeLabel = (type) => {
    switch (type) {
      case 'federal': return 'Федеральный';
      case 'religious': return 'Религиозный';
      case 'custom': return 'Пользовательский';
      default: return 'Другой';
    }
  };

  const filteredHolidays = holidays.filter(holiday => {
    const matchesFilter = holidayFilter === 'all' || holiday.type === holidayFilter;
    const matchesSearch = holiday.name.toLowerCase().includes(holidaySearch.toLowerCase()) ||
                         format(parseISO(holiday.date), 'dd MMMM yyyy', { locale: ru }).toLowerCase().includes(holidaySearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const today = new Date();

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="h-6 w-6" />
            Календарное планирование
          </h2>
          <p className="text-muted-foreground">
            Управление календарем проекта и расписанием работ
          </p>
        </div>
        <Button onClick={exportCalendar} variant="outline">
          Экспорт календаря
        </Button>
      </div>

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="calendar">Календарь</TabsTrigger>
          <TabsTrigger value="settings">Настройки</TabsTrigger>
          <TabsTrigger value="schedule">Расписание</TabsTrigger>
          <TabsTrigger value="milestones">Вехи</TabsTrigger>
          <TabsTrigger value="overview">Обзор</TabsTrigger>
        </TabsList>

        {/* Красивый календарь */}
        <TabsContent value="calendar" className="space-y-4">
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold">
                  {format(currentCalendarDate, 'LLLL yyyy', { locale: ru })}
                </CardTitle>
                <div className="flex gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => navigateMonth(-1)}
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                  >
                    ←
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => setCurrentCalendarDate(new Date())}
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                  >
                    Сегодня
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => navigateMonth(1)}
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                  >
                    →
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {/* Заголовки дней недели */}
              <div className="grid grid-cols-7 gap-2 mb-4">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, index) => (
                  <div key={day} className={`p-3 text-center font-bold text-sm rounded-lg ${
                    index >= 5 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Дни календаря */}
              <div className="grid grid-cols-7 gap-2">
                {getCalendarDays(currentCalendarDate).map(day => {
                  const dayInfo = getDayInfo(day);
                  const isCurrentMonth = isSameMonth(day, currentCalendarDate);
                  const isToday = isSameDay(day, new Date());
                  
                  return (
                    <div
                      key={day.toISOString()}
                      className={`
                        min-h-[100px] p-2 rounded-xl border-2 relative transition-all duration-200 hover:shadow-md
                        ${!isCurrentMonth ? 'bg-gray-50 text-gray-400 border-gray-200' : 'bg-white border-gray-200'}
                        ${isToday ? 'ring-4 ring-blue-400 border-blue-400 bg-blue-50' : ''}
                        ${dayInfo.isHoliday ? getHolidayTypeColor(dayInfo.holidayType) : ''}
                        ${dayInfo.isWeekend && !dayInfo.isHoliday ? 'bg-gray-100 border-gray-300' : ''}
                      `}
                    >
                      {/* Номер дня */}
                      <div className={`text-lg font-bold mb-1 ${
                        isToday ? 'text-blue-700' : 
                        dayInfo.isHoliday ? 'text-current' : 
                        dayInfo.isWeekend ? 'text-gray-600' : 'text-gray-800'
                      }`}>
                        {format(day, 'd')}
                      </div>
                      
                      {/* Праздник */}
                      {dayInfo.isHoliday && (
                        <div className="text-xs font-semibold mb-1 leading-tight">
                          🎉 {dayInfo.holidayName}
                        </div>
                      )}
                      
                      {/* Веха */}
                      {dayInfo.milestone && (
                        <div className="text-xs bg-purple-200 text-purple-800 rounded-full px-2 py-1 mb-1 font-medium">
                          📍 {dayInfo.milestone.name}
                        </div>
                      )}
                      
                      {/* Задачи */}
                      {dayInfo.tasks.slice(0, 2).map(task => (
                        <div
                          key={task.id}
                          className={`
                            text-xs rounded-lg px-2 py-1 mb-1 truncate font-medium shadow-sm
                            ${task.isCritical ? 'bg-red-200 text-red-800 border border-red-300' : 'bg-blue-200 text-blue-800 border border-blue-300'}
                          `}
                          title={task.name || task.id}
                        >
                          {task.name || task.id}
                        </div>
                      ))}
                      
                      {/* Показать количество дополнительных задач */}
                      {dayInfo.tasks.length > 2 && (
                        <div className="text-xs text-gray-600 font-medium bg-gray-200 rounded px-1">
                          +{dayInfo.tasks.length - 2} еще
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Красивая легенда */}
              <div className="mt-6 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                <h4 className="font-semibold mb-3 text-gray-800">Обозначения:</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-100 border-2 border-red-300 rounded"></div>
                    <span>Федеральные праздники</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-purple-100 border-2 border-purple-300 rounded"></div>
                    <span>Религиозные праздники</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded"></div>
                    <span>Выходные дни</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-200 border-2 border-blue-300 rounded"></div>
                    <span>Обычные задачи</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-200 border-2 border-red-300 rounded"></div>
                    <span>Критические задачи</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Настройки календаря */}
        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Основные настройки */}
            <Card>
              <CardHeader>
                <CardTitle>Основные настройки</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="start-date">Дата начала проекта</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={projectStartDate}
                    min="1990-01-01"
                    max="2300-12-31"
                    onChange={(e) => setProjectStartDate(e.target.value)}
                  />
                </div>
                
                <div>
                  <Label>Рабочие дни недели</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {Object.entries(workingDays).map(([day, isWorking]) => (
                      <label key={day} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={isWorking}
                          onChange={(e) => updateWorkingDay(day, e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm capitalize">
                          {day === 'monday' ? 'Понедельник' :
                           day === 'tuesday' ? 'Вторник' :
                           day === 'wednesday' ? 'Среда' :
                           day === 'thursday' ? 'Четверг' :
                           day === 'friday' ? 'Пятница' :
                           day === 'saturday' ? 'Суббота' : 'Воскресенье'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Праздники */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Праздники и выходные
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        Просмотреть все ({holidays.length})
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
                      <DialogHeader>
                        <DialogTitle>Все праздники ({holidays.length})</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        {/* Фильтры */}
                        <div className="flex gap-4 items-center">
                          <div className="flex-1">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <Input
                                placeholder="Поиск праздников..."
                                value={holidaySearch}
                                onChange={(e) => setHolidaySearch(e.target.value)}
                                className="pl-10"
                              />
                            </div>
                          </div>
                          <select
                            value={holidayFilter}
                            onChange={(e) => setHolidayFilter(e.target.value)}
                            className="px-3 py-2 border rounded-md"
                          >
                            <option value="all">Все типы</option>
                            <option value="federal">Федеральные</option>
                            <option value="religious">Религиозные</option>
                            <option value="custom">Пользовательские</option>
                          </select>
                        </div>
                        
                        {/* Список праздников */}
                        <div className="max-h-96 overflow-y-auto space-y-2">
                          {filteredHolidays.map(holiday => (
                            <div key={holiday.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className={getHolidayTypeColor(holiday.type)}>
                                  {getHolidayTypeLabel(holiday.type)}
                                </Badge>
                                <div>
                                  <p className="font-medium">{holiday.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {format(parseISO(holiday.date), 'dd MMMM yyyy', { locale: ru })}
                                  </p>
                                </div>
                              </div>
                              {holiday.type === 'custom' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeHoliday(holiday.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Российские праздники добавлены автоматически
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="holiday-date">Дата праздника</Label>
                  <Input
                    id="holiday-date"
                    type="date"
                    value={newHoliday}
                    min="1000-01-01"
                    max="9999-12-31"
                    onChange={(e) => setNewHoliday(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="holiday-name">Название праздника</Label>
                  <Input
                    id="holiday-name"
                    placeholder="Дополнительный выходной"
                    value={holidayName}
                    onChange={(e) => setHolidayName(e.target.value)}
                  />
                </div>
                
                <Button onClick={addHoliday} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить праздник
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Расписание работ */}
        <TabsContent value="schedule" className="space-y-4">
          {taskSchedule.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Календарное расписание работ</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {taskSchedule.map(task => {
                    const status = getTaskStatus(task);
                    return (
                      <div key={task.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{task.name || task.id}</h4>
                            {task.isCritical && (
                              <Badge variant="destructive">Критическая</Badge>
                            )}
                            <Badge 
                              variant="outline"
                              className={
                                status.color === 'blue' ? 'border-blue-500 text-blue-700' :
                                status.color === 'yellow' ? 'border-yellow-500 text-yellow-700' :
                                'border-green-500 text-green-700'
                              }
                            >
                              {status.label}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {task.numberOfPerformers} исп.
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="font-medium">Начало</p>
                            <p>{format(task.startDate, 'dd.MM.yyyy')}</p>
                          </div>
                          <div>
                            <p className="font-medium">Окончание</p>
                            <p>{format(task.endDate, 'dd.MM.yyyy')}</p>
                          </div>
                          <div>
                            <p className="font-medium">Рабочих дней</p>
                            <p>{task.workingDays}</p>
                          </div>
                          <div>
                            <p className="font-medium">Календарных дней</p>
                            <p>{task.calendarDuration}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <CalendarIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">
                  Выполните расчет параметров для создания календарного расписания
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Вехи проекта */}
        <TabsContent value="milestones" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Добавить веху</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="milestone-name">Название вехи</Label>
                  <Input
                    id="milestone-name"
                    placeholder="Завершение этапа"
                    value={newMilestone.name}
                    onChange={(e) => setNewMilestone({...newMilestone, name: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="milestone-date">Дата</Label>
                  <Input
                    id="milestone-date"
                    type="date"
                    value={newMilestone.date}
                    min="1000-01-01"
                    max="9999-12-31"
                    onChange={(e) => setNewMilestone({...newMilestone, date: e.target.value})}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={addMilestone} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить
                  </Button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="milestone-description">Описание</Label>
                <Input
                  id="milestone-description"
                  placeholder="Описание вехи"
                  value={newMilestone.description}
                  onChange={(e) => setNewMilestone({...newMilestone, description: e.target.value})}
                />
              </div>
            </CardContent>
          </Card>

          {milestones.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Вехи проекта</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {milestones.map(milestone => (
                    <div key={milestone.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{milestone.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {format(parseISO(milestone.date), 'dd MMMM yyyy', { locale: ru })}
                        </p>
                        {milestone.description && (
                          <p className="text-sm text-gray-600 mt-1">{milestone.description}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeMilestone(milestone.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Обзор проекта */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Дата начала</p>
                    <p className="font-medium">
                      {projectStartDate ? 
                        format(parseISO(projectStartDate), 'dd MMMM yyyy', { locale: ru }) :
                        'Не установлена'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Длительность</p>
                    <p className="font-medium">
                      {results?.projectDuration?.toFixed(1) || 0} раб. дн.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Дата окончания</p>
                    <p className="font-medium">
                      {results?.projectDuration && projectStartDate ? 
                        format(addWorkingDays(parseISO(projectStartDate), results.projectDuration), 'dd MMMM yyyy', { locale: ru }) :
                        'Не рассчитано'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Праздников</p>
                    <p className="font-medium">{holidays.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Предупреждения */}
          <div className="space-y-3">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Российские праздники автоматически добавлены в календарь для точного планирования.
              </AlertDescription>
            </Alert>

            {Object.values(workingDays).filter(Boolean).length < 5 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Менее 5 рабочих дней в неделе может значительно увеличить календарную длительность проекта.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Calendar;

