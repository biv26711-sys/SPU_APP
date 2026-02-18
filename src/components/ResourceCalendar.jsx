import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Users, 
  Clock,
  AlertTriangle,
  CheckCircle,
  Settings,
  Edit,
  Save,
  X
} from 'lucide-react';

const ResourceCalendar = ({ project, results, hoursPerDay = 8 }) => {
  const [holidays, setHolidays] = useState([
    { id: 1, date: '2025-01-01', name: 'Новый год', type: 'national' },
    { id: 2, date: '2025-01-07', name: 'Рождество', type: 'national' },
    { id: 3, date: '2025-02-23', name: 'День защитника Отечества', type: 'national' },
    { id: 4, date: '2025-03-08', name: 'Международный женский день', type: 'national' },
    { id: 5, date: '2025-05-01', name: 'Праздник Весны и Труда', type: 'national' },
    { id: 6, date: '2025-05-09', name: 'День Победы', type: 'national' },
    { id: 7, date: '2025-06-12', name: 'День России', type: 'national' },
    { id: 8, date: '2025-11-04', name: 'День народного единства', type: 'national' },
  ]);

  const [workingHours, setWorkingHours] = useState({
    monday: { start: '09:00', end: '18:00', enabled: true },
    tuesday: { start: '09:00', end: '18:00', enabled: true },
    wednesday: { start: '09:00', end: '18:00', enabled: true },
    thursday: { start: '09:00', end: '18:00', enabled: true },
    friday: { start: '09:00', end: '18:00', enabled: true },
    saturday: { start: '10:00', end: '16:00', enabled: false },
    sunday: { start: '10:00', end: '16:00', enabled: false },
  });

  const [newHoliday, setNewHoliday] = useState({
    date: '',
    name: '',
    type: 'company'
  });

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editingHours, setEditingHours] = useState(null);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const isHoliday = (date) => {
    if (!date) return false;
    const dateStr = date.toISOString().split('T')[0];
    return holidays.some(holiday => holiday.date === dateStr);
  };

  const isWeekend = (date) => {
    if (!date) return false;
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const isWorkingDay = (date) => {
    if (!date) return false;
    if (isHoliday(date)) return false;
    
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    return workingHours[dayName]?.enabled || false;
  };

  const getWorkingDaysInMonth = (date) => {
    const days = getDaysInMonth(date);
    return days.filter(day => day && isWorkingDay(day)).length;
  };

  const calculateResourceAvailability = () => {
    if (!project?.tasks || !results) return null;

    const tasks = project.tasks;
    const totalWorkload = tasks.reduce((sum, task) => sum + (task.workload || 0), 0);
    const totalResources = tasks.reduce((sum, task) => sum + task.numberOfPerformers, 0);
    const workingDays = getWorkingDaysInMonth(currentMonth);
    const availableHours = workingDays * hoursPerDay * totalResources;
    const utilization = totalWorkload / availableHours * 100;

    return {
      totalWorkload,
      totalResources,
      workingDays,
      availableHours,
      utilization: Math.min(utilization, 100)
    };
  };

  const addHoliday = () => {
    if (!newHoliday.date || !newHoliday.name) return;

    const holiday = {
      id: Date.now(),
      ...newHoliday
    };

    setHolidays(prev => [...prev, holiday]);
    setNewHoliday({ date: '', name: '', type: 'company' });
  };

  const removeHoliday = (id) => {
    setHolidays(prev => prev.filter(h => h.id !== id));
  };

  const updateWorkingHours = (day, field, value) => {
    setWorkingHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  const availability = calculateResourceAvailability();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Календарь ресурсов
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="calendar" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="calendar">Календарь</TabsTrigger>
              <TabsTrigger value="holidays">Праздники</TabsTrigger>
              <TabsTrigger value="schedule">Расписание</TabsTrigger>
              <TabsTrigger value="analysis">Анализ</TabsTrigger>
            </TabsList>

            <TabsContent value="calendar" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                >
                  ←
                </Button>
                <h3 className="text-xl font-semibold">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h3>
                <Button
                  variant="outline"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                >
                  →
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map(day => (
                  <div key={day} className="p-2 text-center font-medium text-gray-600">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {getDaysInMonth(currentMonth).map((date, index) => {
                  if (!date) {
                    return <div key={index} className="p-2 h-12"></div>;
                  }

                  const holiday = isHoliday(date);
                  const weekend = isWeekend(date);
                  const working = isWorkingDay(date);

                  return (
                    <div
                      key={index}
                      className={`p-2 h-12 border rounded text-center text-sm ${
                        holiday ? 'bg-red-100 text-red-800' :
                        weekend ? 'bg-gray-100 text-gray-600' :
                        working ? 'bg-green-100 text-green-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {date.getDate()}
                      {holiday && <div className="text-xs">🎉</div>}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  🟢 Рабочие дни
                </Badge>
                <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                  ⚫ Выходные
                </Badge>
                <Badge variant="secondary" className="bg-red-100 text-red-800">
                  🎉 Праздники
                </Badge>
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  ⚠️ Нерабочие
                </Badge>
              </div>

              {availability && (
                <Alert className="mt-4">
                  <Users className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Анализ месяца:</strong> {getWorkingDaysInMonth(currentMonth)} рабочих дней, 
                    загрузка ресурсов {availability.utilization.toFixed(1)}%
                    {availability.utilization > 100 && ' (перегрузка!)'}
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="holidays" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Добавить праздник</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="holiday-date">Дата</Label>
                      <Input
                        id="holiday-date"
                        type="date"
                        value={newHoliday.date}
                        onChange={(e) => setNewHoliday({...newHoliday, date: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="holiday-name">Название</Label>
                      <Input
                        id="holiday-name"
                        value={newHoliday.name}
                        onChange={(e) => setNewHoliday({...newHoliday, name: e.target.value})}
                        placeholder="Название праздника"
                      />
                    </div>
                    <div>
                      <Label htmlFor="holiday-type">Тип</Label>
                      <select
                        id="holiday-type"
                        className="w-full p-2 border rounded-md"
                        value={newHoliday.type}
                        onChange={(e) => setNewHoliday({...newHoliday, type: e.target.value})}
                      >
                        <option value="national">Государственный</option>
                        <option value="company">Корпоративный</option>
                        <option value="personal">Личный</option>
                      </select>
                    </div>
                  </div>
                  <Button onClick={addHoliday} disabled={!newHoliday.date || !newHoliday.name}>
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить праздник
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Список праздников</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {holidays.map(holiday => (
                      <div key={holiday.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <span className="font-medium">{holiday.name}</span>
                          <span className="ml-2 text-gray-600">{holiday.date}</span>
                          <Badge variant="outline" className="ml-2">
                            {holiday.type === 'national' ? 'Государственный' :
                             holiday.type === 'company' ? 'Корпоративный' : 'Личный'}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeHoliday(holiday.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Рабочее расписание</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(workingHours).map(([day, hours]) => (
                      <div key={day} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <input
                            type="checkbox"
                            checked={hours.enabled}
                            onChange={(e) => updateWorkingHours(day, 'enabled', e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="font-medium capitalize w-24">
                            {day === 'monday' ? 'Понедельник' :
                             day === 'tuesday' ? 'Вторник' :
                             day === 'wednesday' ? 'Среда' :
                             day === 'thursday' ? 'Четверг' :
                             day === 'friday' ? 'Пятница' :
                             day === 'saturday' ? 'Суббота' : 'Воскресенье'}
                          </span>
                        </div>
                        
                        {hours.enabled && (
                          <div className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={hours.start}
                              onChange={(e) => updateWorkingHours(day, 'start', e.target.value)}
                              className="w-24"
                            />
                            <span>—</span>
                            <Input
                              type="time"
                              value={hours.end}
                              onChange={(e) => updateWorkingHours(day, 'end', e.target.value)}
                              className="w-24"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analysis" className="space-y-4">
              {availability ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="text-sm text-gray-600">Рабочих дней</p>
                          <p className="text-2xl font-bold">{availability.workingDays}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="text-sm text-gray-600">Всего ресурсов</p>
                          <p className="text-2xl font-bold">{availability.totalResources}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-purple-600" />
                        <div>
                          <p className="text-sm text-gray-600">Доступно часов</p>
                          <p className="text-2xl font-bold">{availability.availableHours}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        {availability.utilization > 100 ? 
                          <AlertTriangle className="h-5 w-5 text-red-600" /> :
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        }
                        <div>
                          <p className="text-sm text-gray-600">Загрузка</p>
                          <p className={`text-2xl font-bold ${
                            availability.utilization > 100 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {availability.utilization.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Нет данных проекта для анализа. Добавьте задачи и выполните расчеты.
                  </AlertDescription>
                </Alert>
              )}

              {availability && availability.utilization > 100 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Предупреждение:</strong> Обнаружена перегрузка ресурсов на {(availability.utilization - 100).toFixed(1)}%. 
                    Рекомендуется пересмотреть планирование или увеличить количество ресурсов.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResourceCalendar;
