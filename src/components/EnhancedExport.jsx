import React, { useState} from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Download, 
  FileText, 
  Table, 
  Settings,
  FileJson,
  AreaChart,
  ImageIcon
} from 'lucide-react';
import { Document, Packer, Paragraph, Table as DocxTable, TableRow, TableCell, WidthType, AlignmentType, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { generateAndSaveWordReport } from '@/utils/exportService';

const formatNumberForCSV = (num) => {
  const number = Number(num);
  if (Number.isFinite(number)) {
    if (Math.abs(number) < 0.005) {
      return '0,00';
    }
    return number.toFixed(2).replace('.', ',');
  }
  return '0,00';
};

const formatPerformers = (value) => {
  const number = parseInt(value, 10);
  if (!Number.isFinite(number) || number < 0) return 0;
  return number;
};

const EnhancedExport = ({
  results,
  project,
  tasks = [],
  ganttChartRef,
  networkDiagramRef,
  ganttExportRef,
  networkExportRef,
  hoursPerDay = 8,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');

  const exportToJSON = () => {
    if (!project || !tasks || tasks.length === 0) {
      setExportStatus('Нет данных для экспорта');
      return;
    }
    setIsExporting(true);
    setExportStatus('Создание JSON файла...');
    try {
      const exportData = { project, calculationResults: results };
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      saveAs(blob, `spu_project_${project.name || 'export'}.json`);
      setExportStatus('Проект успешно экспортирован в JSON');
    } catch (error) {
      setExportStatus('Ошибка при создании JSON: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToWord = async () => {
   if (!results) {
    setExportStatus('Нет данных для экспорта. Сначала выполните расчет.');
    return;
  }
  setIsExporting(true);
  setExportStatus('Подготовка данных для отчета...');

  try {
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });

    const networkSource = networkExportRef?.current || networkDiagramRef.current;
    const ganttSource = ganttExportRef?.current || ganttChartRef.current;
    const networkImagePromise = networkSource?.getAsBase64();
    const ganttImagePromise = ganttSource?.getAsBase64();
    const ganttImagesPromise = ganttSource?.getPaginatedBase64?.() || [];

    const [networkImage, ganttImage, ganttImages] = await Promise.all([
      networkImagePromise,
      ganttImagePromise,
      ganttImagesPromise,
    ]);
    
    setExportStatus('Создание Word документа...');
    const baselineData = project.baselinePlan
      ? {
          tasks: project.baselinePlan.tasks,
          results: project.baselinePlan.results,
        }
      : null;

    const optimizedData = {
      tasks: project.tasks,
      results: results,
      networkImage: networkImage,
      ganttImage: ganttImage,
      ganttImages: ganttImages,
    };

    await generateAndSaveWordReport({
      baseline: baselineData,
      optimized: optimizedData,
    });

    setExportStatus('Word документ успешно создан');
  } catch (error) {
    console.error("Ошибка при экспорте в Word:", error);
    setExportStatus(`Ошибка экспорта: ${error.message}`);
  } finally {
    setIsExporting(false);
  }
};

  const exportToMSProjectXML = () => {
    setIsExporting(true);
    setExportStatus('Создание MS Project XML...');
    try {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>СПУ Проект</Name>
  <CreationDate>${new Date( ).toISOString()}</CreationDate>
  <Tasks>
    ${(results?.tasks || []).map((task, index) => `
    <Task>
      <UID>${index + 1}</UID>
      <ID>${index + 1}</ID>
      <Name>${task.name}</Name>
      <Duration>PT${task.duration * hoursPerDay}H0M0S</Duration>
      <Work>PT${(Number.isFinite(Number(task.laborIntensity)) ? Number(task.laborIntensity) : (task.duration * hoursPerDay * Math.max(Number(task.numberOfPerformers) || 0, 1)))}H0M0S</Work>
      <Start>${new Date().toISOString()}</Start>
      <Finish>${new Date(Date.now() + task.duration * 24 * 60 * 60 * 1000).toISOString()}</Finish>
      <Critical>${task.isCritical ? '1' : '0'}</Critical>
      <Summary>0</Summary>
      <Milestone>0</Milestone>
    </Task>`).join('')}
  </Tasks>
</Project>`;
      const blob = new Blob([xmlContent], { type: 'application/xml' });
      saveAs(blob, 'spu_project.xml');
      setExportStatus('MS Project XML успешно создан');
    } catch (error) {
      setExportStatus('Ошибка при создании XML: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const exportTable612 = () => {
   if (!results?.tasks || results.tasks.length === 0) {
      setExportStatus('Нет данных для экспорта');
      return;
    }
    const headers = ['№', 'Код работы', 'Наименование работы', 'Продолжительность, дни', 'Количество исполнителей', 'Трудоемкость, н-ч', 'Ранний срок наступления предшествующего события', 'Раннее окончание', 'Ранний срок наступления последующего события', 'Позднее начало', 'Поздний срок наступления предшествующего события', 'Поздний срок наступления последующего события', 'Резерв времени последующего события', 'Полный резерв времени', 'Частный резерв времени', 'Критическая работа'];
    const csvContent = [
      headers.join(';'),
      ...(results?.tasks || []).map((task, index) => {
        const taskIdAsFormula = `="${task.id}"`;
        return [
          index + 1, taskIdAsFormula, `"${task.name}"`, task.duration, formatPerformers(task.numberOfPerformers),
          task.laborIntensity || 0,
          formatNumberForCSV(task.earlyEventTimeI ?? task.earlyStart),
          formatNumberForCSV(task.earlyFinish),
          formatNumberForCSV(task.earlyEventTimeJ),
          formatNumberForCSV(task.lateStart),
          formatNumberForCSV(task.lateEventTimeI),
          formatNumberForCSV(task.lateEventTimeJ ?? task.lateFinish),
          formatNumberForCSV(task.eventReserveJ),
          formatNumberForCSV(task.totalFloat),
          formatNumberForCSV(task.freeFloat),
          task.isCritical ? 'Да' : 'Нет'
        ].join(';');
      })
    ].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'table_6_1_2.csv');
    setExportStatus('Таблица 6.1.2 успешно экспортирована');
  };

  const exportCanvasToPNG = (componentRef, fileName, errorMsg) => {
    const component = componentRef?.current;
    if (!component) {
      setExportStatus(errorMsg);
      return;
    }

    try {
      const dataUrl =
        (typeof component.getAsBase64 === 'function' && component.getAsBase64()) ||
        (typeof component.getCanvas === 'function' && component.getCanvas()?.toDataURL('image/png', 1.0));

      if (!dataUrl) {
        setExportStatus(errorMsg);
        return;
      }

      const link = document.createElement('a');
      link.download = `${fileName}_${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
      setExportStatus(`${fileName} успешно экспортирован в PNG.`);
    } catch (error) {
      setExportStatus(`Ошибка экспорта ${fileName}: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Инструкции по экспорту</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium mb-2">Форматы файлов:</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><strong>JSON:</strong> Полный экспорт проекта для резервного копирования.</li>
              <li><strong>Word/XML:</strong> Форматы для создания официальных отчетов и интеграции с MS Project.</li>
              <li><strong>CSV (Таблица 6.1.2):</strong> Табличный формат для анализа в Excel или других программах.</li>
              <li><strong>PNG:</strong> Изображения графиков для вставки в отчеты и презентации.</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Рекомендации:</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Используйте <strong>Word</strong> для финальных отчетов.</li>
              <li>Регулярно сохраняйте резервные копии в формате <strong>JSON</strong>.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Расширенный экспорт данных
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="documents" className="w-full">
   
            <TabsList className="grid w-full grid-cols-3 border-b mb-4">
              <TabsTrigger value="documents">Документы</TabsTrigger>
              <TabsTrigger value="tables">Таблицы</TabsTrigger>
              <TabsTrigger value="charts">Графики и диаграммы</TabsTrigger>
            </TabsList>

            <TabsContent value="documents" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5" />Word документ</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">Полный отчет с таблицами, критическим путем и анализом</p>
                    <Button onClick={exportToWord} disabled={isExporting || !tasks.length} className="w-full">{isExporting ? 'Создание...' : 'Экспорт в Word'}</Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><FileJson className="h-5 w-5" />JSON Проект</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">Полная копия проекта для резервного копирования.</p>
                    <Button onClick={exportToJSON} disabled={isExporting || !tasks.length} className="w-full">{isExporting ? 'Создание...' : 'Экспорт в JSON'}</Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><Settings className="h-5 w-5" />MS Project XML</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">Формат для импорта в Microsoft Project</p>
                    <Button onClick={exportToMSProjectXML} disabled={isExporting || !tasks.length} className="w-full">{isExporting ? 'Создание...' : 'Экспорт в XML'}</Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="tables" className="space-y-4">
              <div className="flex justify-center">
                <div className="w-full md:w-1/2 lg:w-1/3">
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><Table className="h-5 w-5" />Таблица 6.1.2</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 mb-4">Специальный формат для учебных целей в формате CSV</p>
                      <Button onClick={exportTable612} disabled={!tasks.length} className="w-full">Экспорт таблицы в CSV</Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="charts" className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="h-5 w-5" />Экспорт диаграммы Ганта</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">Сохранить диаграмму Ганта как изображение (PNG).</p>
                   
                    <Button 
                      onClick={() => exportCanvasToPNG(ganttChartRef, 'gantt_chart', 'Диаграмма Ганта не найдена. Сначала откройте вкладку с диаграммой.')} 
                      disabled={!results} 
                      className="w-full"
                    >
                      Экспорт в PNG
                    </Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="h-5 w-5" />Экспорт сетевого графика</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">Сохранить сетевой график как изображение (PNG).</p>
                   
                    <Button 
                      onClick={() => {
                        if (networkDiagramRef.current?.exportToPNG) {
                          networkDiagramRef.current.exportToPNG();
                          setExportStatus('Экспорт сетевого графика запущен...');
                        } else {
                          setExportStatus('Сетевой график не найден или не готов к экспорту.');
                        }
                      }} 
                      disabled={!results} 
                      className="w-full"
                    >
                      Экспорт в PNG
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {exportStatus && (
            <Alert className="mt-4">
              <AlertDescription>{exportStatus}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedExport;
