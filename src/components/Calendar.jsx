import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, Clock, Plus, CheckCircle, PartyPopper, Trash2, AlertTriangle } from 'lucide-react';
import { format, addDays, parseISO, differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';

const BASE_HOLIDAYS = [
  { date: '01-01', name: 'Новый год', type: 'federal' },
  { date: '01-02', name: 'Новогодние каникулы', type: 'federal' },
  { date: '01-03', name: 'Новогодние каникулы', type: 'federal' },
  { date: '01-04', name: 'Новогодние каникулы', type: 'federal' },
  { date: '01-05', name: 'Новогодние каникулы', type: 'federal' },
  { date: '01-06', name: 'Новогодние каникулы', type: 'federal' },
  { date: '01-07', name: 'Рождество Христово', type: 'federal' },
  { date: '01-08', name: 'Новогодние каникулы', type: 'federal' },
  { date: '02-23', name: 'День защитника Отечества', type: 'federal' },
  { date: '03-08', name: 'Международный женский день', type: 'federal' },
  { date: '05-01', name: 'Праздник Весны и Труда', type: 'federal' },
  { date: '05-09', name: 'День Победы', type: 'federal' },
  { date: '06-12', name: 'День России', type: 'federal' },
  { date: '11-04', name: 'День народного единства', type: 'federal' },
  { date: '01-25', name: 'День российского студенчества', type: 'professional' },
  { date: '02-14', name: 'День всех влюбленных', type: 'cultural' },
  { date: '04-12', name: 'День космонавтики', type: 'professional' },
  { date: '06-01', name: 'День защиты детей', type: 'social' },
  { date: '07-08', name: 'День семьи, любви и верности', type: 'social' },
  { date: '08-22', name: 'День Государственного флага РФ', type: 'national' },
  { date: '09-01', name: 'День знаний', type: 'educational' },
  { date: '10-01', name: 'День пожилых людей', type: 'social' },
  { date: '10-05', name: 'День учителя', type: 'professional' },
  { date: '12-12', name: 'День Конституции РФ', type: 'national' }
];

const generateHolidaysForYears = (baseHolidays, startYear = 2020, endYear = 2030) => {
  const holidays = [];
  for (let year = startYear; year <= endYear; year++) {
    baseHolidays.forEach((holiday, index) => {
      holidays.push({
        id: `${year}-${index}`,
        date: `${year}-${holiday.date}`, 
        name: holiday.name,
        type: holiday.type
      });
    });
  }
  return holidays;
};

const Calendar = ({ project, results, onProjectUpdate }) => {
  const [projectStartDate, setProjectStartDate] = useState(project?.startDate || new Date().toISOString().split('T')[0]);
  const [workingDays, setWorkingDays] = useState({
    monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false
  });
  const [holidays, setHolidays] = useState(() => generateHolidaysForYears(BASE_HOLIDAYS));
  const [newHoliday, setNewHoliday] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [holidayType, setHolidayType] = useState('custom');
  const [taskSchedule, setTaskSchedule] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [newMilestone, setNewMilestone] = useState({ name: '', date: '', description: '' });
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [holidayFilter, setHolidayFilter] = useState('all');
  const [holidaySearch, setHolidaySearch] = useState('');

  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

  const formatDate = d => format(d instanceof Date ? d : parseISO(d), 'yyyy-MM-dd');

  const isWorkingDay = date => {
    const d = date instanceof Date ? startOfDay(date) : startOfDay(parseISO(date));
    const dow = d.getDay();
    if (!workingDays[dayNames[dow]]) return false; 
    const dateString = formatDate(d);
    return !holidays.some(holiday => holiday.date === dateString);
  };

  const addWorkingDays = (startDate, daysToAdd) => {
    let current = startOfDay(startDate instanceof Date ? startDate : parseISO(startDate));
    while (!isWorkingDay(current)) current = addDays(current, 1); 
    if (!daysToAdd || daysToAdd <= 0) return current;

    let added = 0;
    while (added < daysToAdd) {
      current = addDays(current, 1);
      if (isWorkingDay(current)) added++;
    }
    return current;
  };

  useEffect(() => {
    if (results?.tasks && projectStartDate) calculateTaskSchedule();

  }, [results, projectStartDate, workingDays, holidays]);

  const calculateTaskSchedule = () => {
    if (!results?.tasks || !projectStartDate) return;
    const startDate = startOfDay(parseISO(projectStartDate));
    const schedule = [];

    results.tasks.forEach(task => {
      const taskStartDate = addWorkingDays(startDate, task.earlyStart || 0);
      const taskEndDate = addWorkingDays(taskStartDate, (task.duration || 1) - 1);

      const lateStartDate = addWorkingDays(startDate, task.lateStart ?? task.earlyStart ?? 0);
      const lateEndDate = addWorkingDays(lateStartDate, (task.duration || 1) - 1);

      schedule.push({
        ...task,
        startDate: taskStartDate,
        endDate: taskEndDate,
        lateStartDate,
        lateEndDate,
        calendarDuration: differenceInDays(taskEndDate, taskStartDate) + 1,
        workingDays: task.duration
      });
    });

    setTaskSchedule(schedule);

    if (onProjectUpdate) {
      onProjectUpdate({
        ...project,
        startDate: projectStartDate,
        schedule,
        workingDays,
        holidays
      });
    }
  };

  const getDayInfo = day => {
    const dateString = formatDate(day);
    const holiday = holidays.find(h => h.date === dateString);
    const milestone = milestones.find(m => m.date === dateString);
    const tasksOnDay = taskSchedule.filter(task => {
      const s = formatDate(task.startDate);
      const e = formatDate(task.endDate);
      return dateString >= s && dateString <= e && isWorkingDay(day); 
    });

    return {
      isHoliday: !!holiday,
      holidayName: holiday?.name,
      holidayType: holiday?.type,
      milestone,
      tasks: tasksOnDay,
      isWeekend: !workingDays[dayNames[day.getDay()]] && !holiday
    };
  };

  const navigateMonth = direction => {
    const newDate = new Date(currentCalendarDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentCalendarDate(newDate);
  };

  const getDaysInMonth = date => eachDayOfInterval({ start: startOfMonth(date), end: endOfMonth(date) });


  const addHoliday = () => {
    if (!newHoliday || !holidayName) return;

    const newHolidayDate = parseISO(newHoliday);
    const monthDay = format(newHolidayDate, 'MM-dd');
    const newHolidays = [];

    for (let year = 2020; year <= 2030; year++) {
      newHolidays.push({
        id: `custom-${year}-${Date.now()}-${year}`,
        date: `${year}-${monthDay}`, 
        name: holidayName,
        type: holidayType
      });
    }

    setHolidays(prev => [...prev, ...newHolidays]);
    setNewHoliday('');
    setHolidayName('');
    setHolidayType('custom');
  };

  const removeHoliday = (holidayToRemove) => {
    
    const monthDay = holidayToRemove.date.slice(5); 
    setHolidays(prev =>
      prev.filter(h => {
        
        return h.date.slice(5) !== monthDay || h.name !== holidayToRemove.name;
      })
    );
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
    const today = startOfDay(new Date());
    const startDate = startOfDay(task.startDate);
    const endDate = startOfDay(task.endDate);

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

 

  const getHolidayTypeColor = (type) => {
    switch (type) {
      case 'federal': return 'bg-red-100 border-red-300 text-red-800';
      case 'religious': return 'bg-purple-100 border-purple-300 text-purple-800';
      case 'professional': return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'cultural': return 'bg-pink-100 border-pink-300 text-pink-800';
      case 'social': return 'bg-green-100 border-green-300 text-green-800';
      case 'national': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'educational': return 'bg-indigo-100 border-indigo-300 text-indigo-800';
      case 'custom': return 'bg-orange-100 border-orange-300 text-orange-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getHolidayTypeLabel = (type) => {
    switch (type) {
      case 'federal': return 'Федеральный';
      case 'religious': return 'Религиозный';
      case 'professional': return 'Профессиональный';
      case 'cultural': return 'Культурный';
      case 'social': return 'Социальный';
      case 'national': return 'Национальный';
      case 'educational': return 'Образовательный';
      case 'custom': return 'Пользовательский';
      default: return 'Другой';
    }
  };

  const getUniqueHolidays = () => {
    const uniqueMap = new Map();
    holidays.forEach(holiday => {
      const key = `${holiday.name}-${holiday.date.slice(5)}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, holiday);
      }
    });
    return Array.from(uniqueMap.values());
  };

  const filteredHolidays = getUniqueHolidays().filter(holiday => {
    const matchesFilter = holidayFilter === 'all' || holiday.type === holidayFilter;
    const matchesSearch = holiday.name.toLowerCase().includes(holidaySearch.toLowerCase()) ||
                         format(parseISO(holiday.date), 'dd MMMM yyyy', { locale: ru }).toLowerCase().includes(holidaySearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const today = new Date();

  const OverviewCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card className="hover:shadow-md transition-shadow bg-gradient-to-br from-blue-50 to-blue-100">
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

      <Card className="hover:shadow-md transition-shadow bg-gradient-to-br from-green-50 to-green-100">
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

      <Card className="hover:shadow-md transition-shadow bg-gradient-to-br from-purple-50 to-purple-100">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-sm text-muted-foreground">Дата окончания</p>
              <p className="font-medium">
                {results?.projectDuration && projectStartDate ? 
                 
                  format(addWorkingDays(parseISO(projectStartDate), Math.max(0, Math.round(results.projectDuration) - 1)), 'dd MMMM yyyy', { locale: ru }) :
                  'Не рассчитано'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow bg-gradient-to-br from-red-50 to-red-100">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm text-muted-foreground">Праздников</p>
              <p className="font-medium">{getUniqueHolidays().length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="calendar">Календарь</TabsTrigger>
          <TabsTrigger value="settings">Настройки</TabsTrigger>
          <TabsTrigger value="holidays">Праздники</TabsTrigger>
          <TabsTrigger value="schedule">Расписание</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <OverviewCards />

          {Object.values(workingDays).filter(Boolean).length < 5 && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                Менее 5 рабочих дней в неделе может значительно увеличить календарную длительность проекта.
              </AlertDescription>
            </Alert>
          )}

          <Card className="bg-gradient-to-br  from-blue-50 to-indigo-100 border-0 shadow-lg">
            <CardHeader className="py-2  bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
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
              <div className="flex items-center gap-6 mb-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <PartyPopper className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Праздник</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-200 border border-gray-400 rounded"></div>
                  <span className="text-sm">Выходной</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-200 border border-blue-400 rounded"></div>
                  <span className="text-sm">Рабочий день</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-orange-400 rounded"></div>
                  <span className="text-sm">Обычная задача</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span className="text-sm">Критическая задача</span>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2 mb-4">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, index) => (
                  <div key={day} className={`p-3 text-center font-bold text-sm rounded-lg ${
                    index >= 5 ? 'bg-red-200 text-red-800' : 'bg-blue-200 text-blue-800'
                  }`}>
                    {day}
                  </div>
                ))}
              </div>
              
             <div className="grid grid-cols-7 gap-2">
                {(() => {
                  
                  const start = startOfMonth(currentCalendarDate);
                  
                  const startWeekday = (getDay(start) + 6) % 7;
                  const days = getDaysInMonth(currentCalendarDate);

                  return (
                    <>
                      
                      {Array.from({ length: startWeekday }).map((_, i) => (
                        <div key={'empty-' + i} />
                      ))}

                     
                      {days.map(day => {
                        const dayInfo = getDayInfo(day);
                        const isToday = isSameDay(day, new Date());

                        return (
                          <div
                            key={day.toISOString()}
                            className={`
                              min-h-[120px] p-3 rounded-xl border-2 relative transition-all duration-200 hover:shadow-lg hover:scale-105
                              ${isToday ? 'ring-4 ring-blue-400 border-blue-400 bg-blue-100' : ''}
                              ${dayInfo.isHoliday ? 'bg-red-100 border-red-300' : 
                                dayInfo.isWeekend ? 'bg-gray-100 border-gray-300' : 
                                'bg-blue-50 border-blue-200'}
                              shadow-sm
                            `}
                          >
                            <div className={`text-lg font-bold mb-2 ${
                              isToday ? 'text-blue-700' : 
                              dayInfo.isHoliday ? 'text-red-700' : 
                              dayInfo.isWeekend ? 'text-gray-600' : 'text-blue-700'
                            }`}>
                              {format(day, 'd')}
                            </div>

                            {dayInfo.isHoliday && (
                              <div className="mb-2 flex items-center gap-1">
                                <PartyPopper className="h-3 w-3 text-red-600" />
                                <div className="text-xs font-medium leading-tight break-words overflow-hidden text-red-800">
                                  {dayInfo.holidayName}
                                </div>
                              </div>
                            )}

                            {dayInfo.milestone && (
                              <div className="mb-2">
                                <Badge variant="outline" className="text-xs bg-yellow-100 border-yellow-300 text-yellow-800">
                                  {dayInfo.milestone.name}
                                </Badge>
                              </div>
                            )}

                            {dayInfo.tasks.length > 0 && (
                              <div className="space-y-1">
                                {dayInfo.tasks.slice(0, 2).map(task => (
                                  <div
                                    key={task.id}
                                    className={`text-xs p-1 rounded text-white font-medium leading-tight break-words ${
                                      task.isCritical ? 'bg-red-500' : 'bg-orange-500'
                                    }`}
                                  >
                                    {task.name || task.id}
                                  </div>
                                ))}
                                {dayInfo.tasks.length > 2 && (
                                  <div className="text-xs text-gray-500 font-medium">
                                    +{dayInfo.tasks.length - 2} ещё
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

       

        <TabsContent value="settings" className="space-y-4">
          <OverviewCards />
          
          <Card>
            <CardHeader>
              <CardTitle>Настройки календаря</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
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
        </TabsContent>

        <TabsContent value="holidays" className="space-y-4">
          <OverviewCards />
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Праздники и выходные
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      Просмотреть все ({getUniqueHolidays().length})
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Все праздники</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <Input
                            placeholder="Поиск праздников..."
                            value={holidaySearch}
                            onChange={(e) => setHolidaySearch(e.target.value)}
                            className="w-full"
                          />
                        </div>
                        <select
                          value={holidayFilter}
                          onChange={(e) => setHolidayFilter(e.target.value)}
                          className="px-3 py-2 border rounded-md"
                        >
                          <option value="all">Все типы</option>
                          <option value="federal">Федеральные</option>
                          <option value="religious">Религиозные</option>
                          <option value="professional">Профессиональные</option>
                          <option value="cultural">Культурные</option>
                          <option value="social">Социальные</option>
                          <option value="national">Национальные</option>
                          <option value="educational">Образовательные</option>
                          <option value="custom">Пользовательские</option>
                        </select>
                      </div>
                      
                      <div className="max-h-96 overflow-y-auto space-y-2">
                        {filteredHolidays.map(holiday => (
                          <div key={holiday.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-3">
                              <PartyPopper className="h-4 w-4 text-red-500" />
                              <Badge variant="outline" className={getHolidayTypeColor(holiday.type)}>
                                {getHolidayTypeLabel(holiday.type)}
                              </Badge>
                              <div>
                                <p className="font-medium break-words">{holiday.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {holiday.date.slice(5)} (каждый год)
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeHoliday(holiday)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardTitle>
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

              <div className="space-y-2">
                <Label htmlFor="holiday-type">Тип праздника</Label>
                <Select value={holidayType} onValueChange={setHolidayType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите тип праздника" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="federal">Федеральный</SelectItem>
                    <SelectItem value="religious">Религиозный</SelectItem>
                    <SelectItem value="professional">Профессиональный</SelectItem>
                    <SelectItem value="cultural">Культурный</SelectItem>
                    <SelectItem value="social">Социальный</SelectItem>
                    <SelectItem value="national">Национальный</SelectItem>
                    <SelectItem value="educational">Образовательный</SelectItem>
                    <SelectItem value="custom">Пользовательский</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button onClick={addHoliday} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Добавить праздник
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <OverviewCards />
          
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
                      <div key={task.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium break-words">{task.name || task.id}</h4>
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
      </Tabs>
    </div>
  );
};

export default Calendar;
