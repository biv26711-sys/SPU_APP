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

const ExportOnly = ({ 
  project, 
  calculationResults, 
  networkDiagramRef 
}) => {
  const [exportStatus, setExportStatus] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleExportJSON = () => {
    try {
      exportProjectToJSON(project, calculationResults);
      setExportStatus({
        type: 'success',
        message: 'Проект успешно экспортирован в JSON'
      });
    } catch (error) {
      setExportStatus({
        type: 'error',
        message: `Ошибка экспорта: ${error.message}`
      });
    }
  };

  const handleExportCSV = () => {
    if (!calculationResults || !calculationResults.tasks) {
      setExportStatus({
        type: 'error',
        message: 'Нет данных для экспорта. Выполните расчет параметров.'
      });
      return;
    }

    try {
      exportResultsToCSV(calculationResults.tasks);
      setExportStatus({
        type: 'success',
        message: 'Результаты успешно экспортированы в CSV'
      });
    } catch (error) {
      setExportStatus({
        type: 'error',
        message: `Ошибка экспорта: ${error.message}`
      });
    }
  };

  const handleExportExcel = () => {
    if (!calculationResults || !calculationResults.tasks) {
      setExportStatus({
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
      setExportStatus({
        type: 'success',
        message: 'Отчет успешно экспортирован в Excel'
      });
    } catch (error) {
      setExportStatus({
        type: 'error',
        message: `Ошибка экспорта: ${error.message}`
      });
    }
  };

  const handleExportDiagram = () => {
    if (!networkDiagramRef?.current) {
      setExportStatus({
        type: 'error',
        message: 'Сетевой график не найден. Перейдите на вкладку "Сетевой график".'
      });
      return;
    }

    try {
      const svgElement = networkDiagramRef.current.querySelector('svg');
      if (svgElement) {
        exportDiagramToImage(svgElement, 'network_diagram');
        setExportStatus({
          type: 'success',
          message: 'Диаграмма успешно экспортирована в PNG'
        });
      } else {
        throw new Error('SVG элемент не найден');
      }
    } catch (error) {
      setExportStatus({
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
      setExportStatus({
        type: 'success',
        message: 'Проект успешно импортирован из JSON'
      });
    } catch (error) {
      setExportStatus({
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
      setExportStatus({
        type: 'success',
        message: `Успешно импортировано ${importedTasks.length} задач из CSV`
      });
    } catch (error) {
      setExportStatus({
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
      setExportStatus({
        type: 'success',
        message: 'Шаблон CSV успешно скачан'
      });
    } catch (error) {
      setExportStatus({
        type: 'error',
        message: `Ошибка скачивания шаблона: ${error.message}`
      });
    }
  };

  const clearStatus = () => {
    setExportStatus({ type: '', message: '' });
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
              <li><strong>JSON:</strong> Полный экспорт проекта с сохранением всех данных</li>
              <li><strong>Word/XML/CSV:</strong> Табличный формат отчета для работы в офисных программах</li>
              <li><strong>PNG:</strong> Изображение сетевого графика для отчетов</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-2">Рекомендации:</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Используйте JSON для полного сохранения проектов</li>
              <li>Word/XML/CSV подходят для создания отчетов</li>
              <li>Регулярно сохраняйте резервные копии проектов</li>
            </ul>
          </div>
        </CardContent>
      </Card>

     
      {exportStatus.message && (
        <Alert className={exportStatus.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
          {exportStatus.type === 'error' ? (
            <AlertCircle className="h-4 w-4 text-red-600" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-600" />
          )}
          <AlertDescription className={exportStatus.type === 'error' ? 'text-red-800' : 'text-green-800'}>
            {exportStatus.message}
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

     
      
    </div>
  );
};

export default ExportOnly;

