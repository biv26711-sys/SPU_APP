import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Download, 
  FileText, 
  Table, 
  FileSpreadsheet,
  Calendar,
  BarChart3,
  Settings
} from 'lucide-react';
import { Document, Packer, Paragraph, Table as DocxTable, TableRow, TableCell, WidthType, AlignmentType, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

const EnhancedExport = ({ results, project, tasks = [] }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');

  const exportToCSV = () => {
    if (!tasks || tasks.length === 0) {
      setExportStatus('Нет данных для экспорта');
      return;
    }

    const headers = ['ID', 'Название', 'Длительность', 'Трудоемкость', 'Исполнители', 'Предшественники', 'Раннее начало', 'Раннее окончание', 'Позднее начало', 'Позднее окончание', 'Резерв времени', 'Критическая'];
    
    const csvContent = [
      headers.join(','),
      ...tasks.map(task => [
        task.id,
        `"${task.name}"`,
        task.duration,
        task.workload || 0,
        task.numberOfPerformers,
        `"${task.predecessors || ''}"`,
        task.earlyStart || 0,
        task.earlyFinish || 0,
        task.lateStart || 0,
        task.lateFinish || 0,
        task.totalFloat || 0,
        task.isCritical ? 'Да' : 'Нет'
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'spu_project.csv');
    setExportStatus('CSV файл успешно экспортирован');
  };

const exportToWord = async () => {
  setIsExporting(true);
  setExportStatus('Создание Word документа...');
  console.log("tasks:", tasks);
console.log("Критических работ:", tasks.filter(t => t.isCritical).length);
console.log("Общая трудоемкость:", tasks.reduce((sum, t) => sum + (t.workload || 0), 0));
  try {
    // Создаём документ
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            // Заголовок
            new Paragraph({
              text: "Отчет по сетевому планированию и управлению",
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: `Дата создания: ${new Date().toLocaleDateString('ru-RU')}`,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: "" }),

            // 1. Общая информация
            new Paragraph({
              text: "1. Общая информация о проекте",
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Общее количество задач: ", bold: true }),
                new TextRun({ text: tasks.length.toString() }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Длительность проекта: ", bold: true }),
                new TextRun({ text: `${results?.projectDuration || 0} дней` }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Критических работ: ", bold: true }),
                new TextRun({
                  text: tasks.filter(t => t.isCritical).length.toString(),
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Общая трудоемкость: ", bold: true }),
                new TextRun({
                  text: `${tasks.reduce((sum, t) => sum + (t.workload || 0), 0)} н-ч`,
                }),
              ],
            }),
            
            new Paragraph({ text: "" }),

            // 2. Критический путь
            new Paragraph({
              text: "2. Критический путь",
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
              text: results?.criticalPath ? results.criticalPath.join(' → ') : 'Не определен',
            }),
            new Paragraph({ text: "" }),

            // 3. Список задач
            new Paragraph({
              text: "3. Список задач",
              heading: HeadingLevel.HEADING_1,
            }),
          ],
        },
      ],
    });

    // Таблица задач
    if (tasks.length > 0) {
      const table = new DocxTable({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          // Заголовок таблицы
          new TableRow({
            children: ["ID", "Название", "Длительность", "Исполнители", "Критическая"].map(
              text => new TableCell({
                children: [new Paragraph({ text, alignment: AlignmentType.CENTER })],
              })
            ),
          }),
          // Данные задач
          ...tasks.map(task => new TableRow({
            children: [
              task.id,
              task.name,
              task.duration.toString(),
              task.numberOfPerformers.toString(),
              task.isCritical ? 'Да' : 'Нет',
            ].map(value => new TableCell({
              children: [new Paragraph({ text: value, alignment: AlignmentType.CENTER })],
            })),
          })),
        ],
      });

      doc.addSection({
        children: [table],
      });
    }

    // Генерация и скачивание документа в браузере
    const blob = await Packer.toBlob(doc); // <- главное исправление
    saveAs(blob, `SPU_Project_Report_${new Date().toLocaleDateString('ru-RU')}.docx`);
    setExportStatus('Word документ успешно создан');
  } catch (error) {
    setExportStatus('Ошибка при создании Word документа: ' + error.message);
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
  <CreationDate>${new Date().toISOString()}</CreationDate>
  <Tasks>
    ${tasks.map((task, index) => `
    <Task>
      <UID>${index + 1}</UID>
      <ID>${index + 1}</ID>
      <Name>${task.name}</Name>
      <Duration>PT${task.duration * 8}H0M0S</Duration>
      <Work>PT${(task.workload || task.duration * 8)}H0M0S</Work>
      <Start>${new Date().toISOString()}</Start>
      <Finish>${new Date(Date.now() + task.duration * 24 * 60 * 60 * 1000).toISOString()}</Finish>
      <Critical>${task.isCritical ? '1' : '0'}</Critical>
      <Summary>0</Summary>
      <Milestone>0</Milestone>
    </Task>`).join('')}
  </Tasks>
  <Resources>
    <Resource>
      <UID>1</UID>
      <ID>1</ID>
      <Name>Исполнители</Name>
      <Type>1</Type>
      <MaxUnits>1</MaxUnits>
    </Resource>
  </Resources>
  <Assignments>
    ${tasks.map((task, index) => `
    <Assignment>
      <UID>${index + 1}</UID>
      <TaskUID>${index + 1}</TaskUID>
      <ResourceUID>1</ResourceUID>
      <Units>${task.numberOfPerformers}</Units>
      <Work>PT${(task.workload || task.duration * 8)}H0M0S</Work>
    </Assignment>`).join('')}
  </Assignments>
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
    if (!tasks || tasks.length === 0) {
      setExportStatus('Нет данных для экспорта');
      return;
    }

    const headers = ['№', 'Код работы', 'Наименование работы', 'Продолжительность, дни', 'Количество исполнителей', 'Трудоемкость, н-ч', 'Раннее начало', 'Раннее окончание', 'Позднее начало', 'Позднее окончание', 'Полный резерв времени', 'Свободный резерв времени'];
    
    const csvContent = [
      headers.join(';'),
      ...tasks.map((task, index) => [
        index + 1,
        task.id,
        `"${task.name}"`,
        task.duration,
        task.numberOfPerformers,
        task.workload || (task.duration * task.numberOfPerformers * 8),
        task.earlyStart || 0,
        task.earlyFinish || 0,
        task.lateStart || 0,
        task.lateFinish || 0,
        task.totalFloat || 0,
        task.freeFloat || 0
      ].join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'table_6_1_2.csv');
    setExportStatus('Таблица 6.1.2 успешно экспортирована');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Расширенный экспорт данных
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="documents" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="documents">Документы</TabsTrigger>
              <TabsTrigger value="tables">Таблицы</TabsTrigger>
              <TabsTrigger value="formats">Форматы</TabsTrigger>
            </TabsList>

            <TabsContent value="documents" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Word документ
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Полный отчет с таблицами, критическим путем и анализом проекта
                    </p>
                    <Button 
                      onClick={exportToWord}
                      disabled={isExporting || !tasks.length}
                      className="w-full"
                    >
                      {isExporting ? 'Создание...' : 'Экспорт в Word'}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      MS Project XML
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Формат для импорта в Microsoft Project
                    </p>
                    <Button 
                      onClick={exportToMSProjectXML}
                      disabled={isExporting || !tasks.length}
                      className="w-full"
                      variant="outline"
                    >
                      {isExporting ? 'Создание...' : 'Экспорт в XML'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="tables" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5" />
                      CSV файл
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Данные в формате CSV для Excel и других программ
                    </p>
                    <Button 
                      onClick={exportToCSV}
                      disabled={!tasks.length}
                      className="w-full"
                    >
                      Экспорт в CSV
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Table className="h-5 w-5" />
                      Таблица 6.1.2
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Специальный формат для учебных целей
                    </p>
                    <Button 
                      onClick={exportTable612}
                      disabled={!tasks.length}
                      className="w-full"
                      variant="outline"
                    >
                      Экспорт таблицы
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="formats" className="space-y-4">
              <Alert>
                <BarChart3 className="h-4 w-4" />
                <AlertDescription>
                  <strong>Поддерживаемые форматы:</strong>
                  <ul className="mt-2 space-y-1">
                    <li>• <strong>DOCX</strong> - Microsoft Word документ с полным отчетом</li>
                    <li>• <strong>XML</strong> - Microsoft Project XML для импорта</li>
                    <li>• <strong>CSV</strong> - Таблица данных для Excel</li>
                    <li>• <strong>Таблица 6.1.2</strong> - Специальный учебный формат</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <Badge variant="secondary" className="mb-2">Задач</Badge>
                  <p className="text-2xl font-bold">{tasks.length}</p>
                </div>
                <div className="text-center">
                  <Badge variant="secondary" className="mb-2">Критических</Badge>
                  <p className="text-2xl font-bold">{tasks.filter(t => t.isCritical).length}</p>
                </div>
                <div className="text-center">
                  <Badge variant="secondary" className="mb-2">Длительность</Badge>
                  <p className="text-2xl font-bold">{results?.projectDuration || 0}</p>
                </div>
                <div className="text-center">
                  <Badge variant="secondary" className="mb-2">Трудоемкость</Badge>
                  <p className="text-2xl font-bold">{tasks.reduce((sum, t) => sum + (t.workload || 0), 0)}</p>
                </div>
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

