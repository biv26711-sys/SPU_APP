import logger from './logger.js';

export const exportProjectToJSON = (project, calculationResults = null) => {
  try {
    const exportData = {
      project: {
        id: project.id,
        name: project.name,
        startDate: project.startDate,
        tasks: project.tasks,
        criticalPath: project.criticalPath,
        projectDuration: project.projectDuration
      },
      calculationResults,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `${project.name || 'project'}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    logger.logFileOperation('EXPORT_JSON', link.download, true);
    return true;
  } catch (error) {
    logger.logFileOperation('EXPORT_JSON', 'unknown', false, error);
    throw error;
  }
};

export const exportResultsToCSV = (tasks) => {
  try {
    const headers = [
      'ID работы',
      'Название',
      'Продолжительность (дни)',
      'Трудоемкость (н-ч)',
      'Количество исполнителей',
      'Предшественники',
      'Раннее начало',
      'Раннее окончание',
      'Позднее начало',
      'Позднее окончание',
      'Полный резерв',
      'Частный резерв',
      'Критическая работа'
    ];

    const csvContent = [
      headers.join(','),
      ...tasks.map(task => [
        task.id,
        `"${task.name}"`,
        task.duration,
        task.laborIntensity,
        task.numberOfPerformers,
        `"${task.predecessors.join(', ')}"`,
        task.earlyStart?.toFixed(2) || '',
        task.earlyFinish?.toFixed(2) || '',
        task.lateStart?.toFixed(2) || '',
        task.lateFinish?.toFixed(2) || '',
        task.totalFloat?.toFixed(2) || '',
        task.freeFloat?.toFixed(2) || '',
        task.isCritical ? 'Да' : 'Нет'
      ].join(','))
    ].join('\n');

    const dataBlob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `spu_results_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    logger.logFileOperation('EXPORT_CSV', link.download, true);
    return true;
  } catch (error) {
    logger.logFileOperation('EXPORT_CSV', 'unknown', false, error);
    throw error;
  }
};

export const exportResultsToExcel = (tasks, projectInfo) => {
  try {
    const worksheetData = [
      ['Отчет по сетевому планированию и управлению'],
      [''],
      ['Информация о проекте:'],
      ['Название проекта:', projectInfo.name || 'Без названия'],
      ['Дата создания:', new Date().toLocaleDateString('ru-RU')],
      ['Общая длительность:', `${projectInfo.projectDuration || 0} дней`],
      ['Количество работ:', tasks.length],
      ['Критический путь:', projectInfo.criticalPath?.join(' → ') || 'Не определен'],
      [''],
      ['Параметры работ:'],
      [
        'ID работы',
        'Название',
        'Продолжительность (дни)',
        'Трудоемкость (н-ч)',
        'Количество исполнителей',
        'Предшественники',
        'Раннее начало',
        'Раннее окончание',
        'Позднее начало',
        'Позднее окончание',
        'Полный резерв',
        'Частный резерв',
        'Критическая работа'
      ],
      ...tasks.map(task => [
        task.id,
        task.name,
        task.duration,
        task.laborIntensity,
        task.numberOfPerformers,
        task.predecessors.join(', '),
        task.earlyStart?.toFixed(2) || '',
        task.earlyFinish?.toFixed(2) || '',
        task.lateStart?.toFixed(2) || '',
        task.lateFinish?.toFixed(2) || '',
        task.totalFloat?.toFixed(2) || '',
        task.freeFloat?.toFixed(2) || '',
        task.isCritical ? 'Да' : 'Нет'
      ])
    ];

    const csvContent = worksheetData.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    const dataBlob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `spu_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    logger.logFileOperation('EXPORT_EXCEL', link.download, true);
    return true;
  } catch (error) {
    logger.logFileOperation('EXPORT_EXCEL', 'unknown', false, error);
    throw error;
  }
};

export const importProjectFromJSON = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (!data.project || !data.project.tasks) {
          throw new Error('Неверная структура файла проекта');
        }

        const tasks = data.project.tasks;
        if (!Array.isArray(tasks)) {
          throw new Error('Задачи должны быть массивом');
        }

        for (const task of tasks) {
          if (!task.id || !task.name || typeof task.duration !== 'number' || typeof task.numberOfPerformers !== 'number') {
            throw new Error(`Неверная структура задачи: ${task.id || 'без ID'}`);
          }
        }

        logger.logFileOperation('IMPORT_JSON', file.name, true);
        resolve({
          project: data.project,
          calculationResults: data.calculationResults,
          importDate: new Date().toISOString()
        });
      } catch (error) {
        logger.logFileOperation('IMPORT_JSON', file.name, false, error);
        reject(new Error(`Ошибка при импорте файла: ${error.message}`));
      }
    };
    
    reader.onerror = () => {
      const error = new Error('Ошибка при чтении файла');
      logger.logFileOperation('IMPORT_JSON', file.name, false, error);
      reject(error);
    };
    
    reader.readAsText(file);
  });
};

export const importTasksFromCSV = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const csvData = e.target.result;
        const lines = csvData.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          throw new Error('Файл должен содержать заголовки и хотя бы одну строку данных');
        }

        const dataLines = lines.slice(1);
        const tasks = [];

        for (let i = 0; i < dataLines.length; i++) {
          const line = dataLines[i].trim();
          if (!line) continue;

          const columns = line.split(',').map(col => col.replace(/"/g, '').trim());
          
          if (columns.length < 6) {
            console.warn(`Строка ${i + 2}: недостаточно данных, пропускаем`);
            continue;
          }

          const task = {
            id: columns[0],
            name: columns[1],
            duration: parseFloat(columns[2]) || 0,
            laborIntensity: parseFloat(columns[3]) || parseFloat(columns[2]) || 0,
            numberOfPerformers: parseInt(columns[4]) || 1,
            predecessors: columns[5] ? columns[5].split(',').map(p => p.trim()).filter(p => p) : []
          };

          if (task.id && task.name && task.duration > 0 && task.numberOfPerformers > 0) {
            tasks.push(task);
          } else {
            console.warn(`Строка ${i + 2}: некорректные данные, пропускаем`);
          }
        }

        if (tasks.length === 0) {
          throw new Error('Не найдено корректных задач в файле');
        }

        logger.logFileOperation('IMPORT_CSV', file.name, true);
        resolve(tasks);
      } catch (error) {
        logger.logFileOperation('IMPORT_CSV', file.name, false, error);
        reject(new Error(`Ошибка при импорте CSV: ${error.message}`));
      }
    };
    
    reader.onerror = () => {
      const error = new Error('Ошибка при чтении файла');
      logger.logFileOperation('IMPORT_CSV', file.name, false, error);
      reject(error);
    };
    
    reader.readAsText(file, 'utf-8');
  });
};

export const downloadCSVTemplate = () => {
  try {
    const template = [
      'ID работы,Название,Продолжительность (дни),Трудоемкость (н-ч),Количество исполнителей,Предшественники',
      '1-2,"Работа 1-2",10,20,2,',
      '2-3,"Работа 2-3",15,30,1,"1-2"',
      '2-4,"Работа 2-4",8,16,1,"1-2"',
      '3-5,"Работа 3-5",12,24,2,"2-3"',
      '4-5,"Работа 4-5",6,12,1,"2-4"'
    ].join('\n');

    const dataBlob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'spu_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    logger.logFileOperation('DOWNLOAD_TEMPLATE', 'spu_template.csv', true);
    return true;
  } catch (error) {
    logger.logFileOperation('DOWNLOAD_TEMPLATE', 'spu_template.csv', false, error);
    throw error;
  }
};

export const exportDiagramToImage = (canvasElement, filename = 'network_diagram') => {
  try {
    if (!canvasElement) {
      throw new Error('Canvas элемент не найден');
    }

    canvasElement.toBlob((blob) => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}_${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      logger.logFileOperation('EXPORT_DIAGRAM', link.download, true);
    });
    
    return true;
  } catch (error) {
    logger.logFileOperation('EXPORT_DIAGRAM', filename, false, error);
    throw error;
  }
};

export const exportSVGToImage = (svgElement, filename = 'gantt_chart') => {
  try {
    if (!svgElement) {
      throw new Error('SVG элемент не найден');
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const svgRect = svgElement.getBoundingClientRect();
    canvas.width = svgRect.width || 800;
    canvas.height = svgRect.height || 600;
    
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob((blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}_${new Date().toISOString().split('T')[0]}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(svgUrl);
        
        logger.logFileOperation('EXPORT_SVG_DIAGRAM', link.download, true);
      });
    };
    
    img.onerror = () => {
      const error = new Error('Ошибка при конвертации SVG в изображение');
      logger.logFileOperation('EXPORT_SVG_DIAGRAM', filename, false, error);
      throw error;
    };
    
    img.src = svgUrl;
    return true;
  } catch (error) {
    logger.logFileOperation('EXPORT_SVG_DIAGRAM', filename, false, error);
    throw error;
  }
};

export const saveLogsToFile = () => {
  try {
    const logs = logger.getLogs();
    const logsData = {
      logs,
      exportDate: new Date().toISOString(),
      totalCount: logs.length,
      statistics: logger.getStatistics()
    };

    const dataStr = JSON.stringify(logsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `spu_logs_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    logger.logFileOperation('SAVE_LOGS', link.download, true);
    return true;
  } catch (error) {
    logger.logFileOperation('SAVE_LOGS', 'unknown', false, error);
    throw error;
  }
};

