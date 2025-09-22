import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Download, 
  Upload, 
  FileText, 
  FileSpreadsheet, 
  Image, 
  Save,
  AlertCircle,
  CheckCircle,
  FileJson
} from 'lucide-react';
import {
  exportProjectToJSON,
  exportResultsToCSV,
  exportResultsToExcel,
  importProjectFromJSON,
  importTasksFromCSV,
  downloadCSVTemplate,
  exportDiagramToImage
} from '../utils/fileOperations.js';

const ImportExport = ({ 
  project, 
  calculationResults, 
  onProjectImport, 
  onTasksImport,
  networkDiagramRef 
}) => {
  const [importStatus, setImportStatus] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);
  const csvInputRef = useRef(null);

  const handleExportJSON = () => {
    try {
      exportProjectToJSON(project, calculationResults);
      setImportStatus({
        type: 'success',
        message: 'Проект успешно экспортирован в JSON'
      });
    } catch (error) {
      setImportStatus({
        type: 'error',
        message: `Ошибка экспорта: ${error.message}`
      });
    }
  };

  const handleExportCSV = () => {
    if (!calculationResults || !calculationResults.tasks) {
      setImportStatus({
        type: 'error',
        message: 'Нет данных для экспорта. Выполните расчет параметров.'
      });
      return;
    }

    try {
      exportResultsToCSV(calculationResults.tasks);
      setImportStatus({
        type: 'success',
        message: 'Результаты успешно экспортированы в CSV'
      });
    } catch (error) {
      setImportStatus({
        type: 'error',
        message: `Ошибка экспорта: ${error.message}`
      });
    }
  };

  const handleExportExcel = () => {
    if (!calculationResults || !calculationResults.tasks) {
      setImportStatus({
        type: 'error',
        message: 'Нет данных для экспорта. Выполните расчет параметров.'
      });
      return;
    }

    try {
      exportResultsToExcel(calculationResults.tasks, {
        name: project.name,
        projectDuration: calculationResults.projectDuration,
        criticalPath: calculationResults.criticalPath
      });
      setImportStatus({
        type: 'success',
        message: 'Отчет успешно экспортирован в Excel'
      });
    } catch (error) {
      setImportStatus({
        type: 'error',
        message: `Ошибка экспорта: ${error.message}`
      });
    }
  };

  const handleExportDiagram = () => {
    if (!networkDiagramRef?.current) {
      setImportStatus({
        type: 'error',
        message: 'Сетевой график не найден. Перейдите на вкладку "Сетевой график".'
      });
      return;
    }

    try {
      const svgElement = networkDiagramRef.current.querySelector('svg');
      if (svgElement) {
        exportDiagramToImage(svgElement, 'network_diagram');
        setImportStatus({
          type: 'success',
          message: 'Диаграмма успешно экспортирована в PNG'
        });
      } else {
        throw new Error('SVG элемент не найден');
      }
    } catch (error) {
      setImportStatus({
        type: 'error',
        message: `Ошибка экспорта диаграммы: ${error.message}`
      });
    }
  };

  const handleImportJSON = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const importedData = await importProjectFromJSON(file);
      onProjectImport(importedData.project, importedData.calculationResults);
      setImportStatus({
        type: 'success',
        message: 'Проект успешно импортирован из JSON'
      });
    } catch (error) {
      setImportStatus({
        type: 'error',
        message: error.message
      });
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  const handleImportCSV = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const importedTasks = await importTasksFromCSV(file);
      onTasksImport(importedTasks);
      setImportStatus({
        type: 'success',
        message: `Успешно импортировано ${importedTasks.length} задач из CSV`
      });
    } catch (error) {
      setImportStatus({
        type: 'error',
        message: error.message
      });
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    try {
      downloadCSVTemplate();
      setImportStatus({
        type: 'success',
        message: 'Шаблон CSV успешно скачан'
      });
    } catch (error) {
      setImportStatus({
        type: 'error',
        message: `Ошибка скачивания шаблона: ${error.message}`
      });
    }
  };

  const clearStatus = () => {
    setImportStatus({ type: '', message: '' });
  };

  return (
    <div className="space-y-6">
      {/* Статус операций */}
      {importStatus.message && (
        <Alert className={importStatus.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
          {importStatus.type === 'error' ? (
            <AlertCircle className="h-4 w-4 text-red-600" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-600" />
          )}
          <AlertDescription className={importStatus.type === 'error' ? 'text-red-800' : 'text-green-800'}>
            {importStatus.message}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearStatus}
              className="ml-2 h-auto p-1"
            >
              ×
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Экспорт данных */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Экспорт данных
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Экспорт проекта */}
            <div className="space-y-3">
              <h4 className="font-medium">Экспорт проекта</h4>
              <Button 
                onClick={handleExportJSON}
                className="w-full justify-start"
                variant="outline"
              >
                <FileJson className="h-4 w-4 mr-2" />
                Экспорт в JSON
              </Button>
              <p className="text-xs text-muted-foreground">
                Сохраняет весь проект с задачами и результатами расчетов
              </p>
            </div>

            {/* Экспорт отчета */}
            <div className="space-y-3">
              <h4 className="font-medium">Экспорт отчета</h4>
              <Button 
                onClick={handleExportExcel}
                className="w-full justify-start"
                variant="outline"
                disabled={!calculationResults}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Экспорт в Word/Excel/CSV
              </Button>
              <p className="text-xs text-muted-foreground">
                Экспортирует отчет с параметрами всех работ в выбранном формате
              </p>
            </div>
          </div>

          <Separator />

          {/* Экспорт диаграммы */}
          <div className="space-y-3">
            <h4 className="font-medium">Экспорт диаграммы</h4>
            <Button 
              onClick={handleExportDiagram}
              className="w-full justify-start"
              variant="outline"
              disabled={!calculationResults}
            >
              <Image className="h-4 w-4 mr-2" />
              Экспорт сетевого графика в PNG
            </Button>
            <p className="text-xs text-muted-foreground">
              Сохраняет изображение сетевого графика
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Импорт данных */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Импорт данных
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Импорт проекта */}
            <div className="space-y-3">
              <h4 className="font-medium">Импорт проекта</h4>
              <div className="space-y-2">
                <Label htmlFor="json-import">Выберите JSON файл</Label>
                <Input
                  id="json-import"
                  type="file"
                  accept=".json"
                  ref={fileInputRef}
                  onChange={handleImportJSON}
                  disabled={isLoading}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Загружает проект, сохраненный в формате JSON
              </p>
            </div>

            {/* Импорт задач */}
            <div className="space-y-3">
              <h4 className="font-medium">Импорт задач</h4>
              <div className="space-y-2">
                <Label htmlFor="csv-import">Выберите CSV файл</Label>
                <Input
                  id="csv-import"
                  type="file"
                  accept=".csv"
                  ref={csvInputRef}
                  onChange={handleImportCSV}
                  disabled={isLoading}
                />
                <Button 
                  onClick={handleDownloadTemplate}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Скачать шаблон CSV
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Импортирует задачи из CSV файла
              </p>
            </div>
          </div>

          {isLoading && (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                Обработка файла...
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Инструкции */}
      <Card>
        <CardHeader>
          <CardTitle>Инструкции по импорту/экспорту</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium mb-2">Форматы файлов:</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><strong>JSON:</strong> Полный экспорт/импорт проекта с сохранением всех данных</li>
              <li><strong>CSV:</strong> Табличный формат для работы с задачами в Excel</li>
              <li><strong>PNG:</strong> Изображение сетевого графика для отчетов</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Структура CSV файла:</h4>
            <p className="text-muted-foreground">
              ID работы, Название, Продолжительность (дни), Трудоемкость (н-ч), 
              Количество исполнителей, Предшественники (через запятую)
            </p>
          </div>

          <div>
            <h4 className="font-medium mb-2">Рекомендации:</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Используйте JSON для полного сохранения проектов</li>
              <li>CSV подходит для обмена данными с другими программами</li>
              <li>Экспортируйте диаграммы для включения в отчеты</li>
              <li>Регулярно сохраняйте резервные копии проектов</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ImportExport;

