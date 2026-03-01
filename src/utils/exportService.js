import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType, TextRun, HeadingLevel, ImageRun, PageOrientation } from 'docx';
import { saveAs } from 'file-saver';

const arePlansEqual = (plan1, plan2) => {
    if (!plan1 || !plan2) return false;
    const plan1Data = { tasks: plan1.tasks, results: plan1.results };
    const plan2Data = { tasks: plan2.tasks, results: plan2.results };
    return JSON.stringify(plan1Data) === JSON.stringify(plan2Data);
};

const base64ToBuffer = (base64) => {
  const base64String = base64.split(',')[1] || base64;
  const binaryStr = atob(base64String);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes.buffer;
};

const createTaskListTable = (tasks) => {
  const tableHeaders = ["ID", "Наименование", "Длительность (дн.)", "Трудоемкость (н-ч)", "Исполнители", "Предшественники"];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: tableHeaders.map(text => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })] })), tableHeader: true }),
      ...tasks.map(task => {
        const rowData = [
          task.id,
          task.name,
          task.duration.toString(),
          (task.laborIntensity || 0).toString(),
          task.numberOfPerformers.toString(),
          Array.isArray(task.predecessors) ? task.predecessors.join(', ') : (task.predecessors || ''),
        ];
        return new TableRow({
          children: rowData.map(value => new TableCell({ children: [new Paragraph({ children: [new TextRun(String(value ?? ''))] })] }))
        });
      }),
    ],
  });
};

const createReportTable = (results) => {
  const tableHeaders = ["ID", "Наименование", "Длит.", "Трудоем.", "Исп.", "Tр i", "Ран. ок.", "Tр j", "Позд. нач.", "Tп i", "Tп j", "R j", "Полн. рез.", "Част. рез.", "Крит."];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: tableHeaders.map(text => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: true })], alignment: AlignmentType.CENTER })] })), tableHeader: true }),
      ...results.tasks.map(task => {
        const rowData = [
          task.id, task.name, task.duration.toString(), (task.laborIntensity || 0).toString(), task.numberOfPerformers.toString(),
          (task.earlyEventTimeI ?? task.earlyStart)?.toFixed(2) || '0.00',
          task.earlyFinish?.toFixed(2) || '0.00',
          task.earlyEventTimeJ?.toFixed(2) || '0.00',
          task.lateStart?.toFixed(2) || '0.00',
          task.lateEventTimeI?.toFixed(2) || '0.00',
          (task.lateEventTimeJ ?? task.lateFinish)?.toFixed(2) || '0.00',
          task.eventReserveJ?.toFixed(2) || '0.00',
          task.totalFloat?.toFixed(2) || '0.00',
          task.freeFloat?.toFixed(2) || '0.00',
          (!task.isDummy && task.isCritical) ? 'Да' : 'Нет',
        ];
        return new TableRow({
          children: rowData.map(value => new TableCell({ children: [new Paragraph({ children: [new TextRun(String(value ?? ''))], alignment: AlignmentType.CENTER })] }))
        });
      }),
    ],
  });
};

const getImageDimensions = (base64) => {
    return new Promise((resolve) => {
        if (!base64) {
            resolve({ width: 1, height: 1 });
            return;
        }
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = () => resolve({ width: 1, height: 1 });
        img.src = base64;
    });
};


export const generateAndSaveWordReport = async ({ baseline, optimized }) => {
  try {
    if (!optimized || !optimized.results) {
      alert('Нет данных для экспорта. Сначала выполните расчет.');
      return;
    }
    const plansAreEqual = arePlansEqual(baseline, optimized);
    const hasComparison = baseline && baseline.results && !plansAreEqual;
    const mainContent = [];
 
    mainContent.push(
      new Paragraph({ text: "Отчет по сетевому планированию и управлению", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: `Дата создания: ${new Date().toLocaleDateString('ru-RU')}`, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: "" })
    );



    if (hasComparison) {
        const durBaseline = baseline.results.projectDuration;
        const durOptimized = optimized.results.projectDuration;
        const durDiff = durOptimized - durBaseline;
        const laborBaseline = baseline.tasks.reduce((s, t) => s + (t.laborIntensity || 0), 0) || 1;
        const laborOptimized = optimized.tasks.reduce((s, t) => s + (t.laborIntensity || 0), 0);
        const laborDiff = laborOptimized - laborBaseline;

        mainContent.push(
            new Paragraph({ text: "Ключевые выводы по оптимизации плана", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: `• Длительность проекта: ${durDiff > 0 ? 'увеличилась на' : 'сократилась на'} ${Math.abs(durDiff).toFixed(2)} дн. (изменение на ${durDiff >= 0 ? '+' : ''}${((durDiff / (durBaseline || 1)) * 100).toFixed(1)}%)` }),
            new Paragraph({ text: `• Общая трудоемкость: ${laborDiff > 0 ? 'увеличилась на' : 'сократилась на'} ${Math.abs(laborDiff).toFixed(0)} н-ч. (изменение на ${laborDiff >= 0 ? '+' : ''}${((laborDiff / laborBaseline) * 100).toFixed(1)}%)` }),
            new Paragraph({ text: "" })
        );
    }

    const createTablesForSection = (planData, title, targetArray) => {
        if (!planData || !planData.tasks || !planData.results) return;
        targetArray.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }));
        targetArray.push(new Paragraph({ text: "Таблица 1. Исходные данные (список работ)", style: "strong" }));
        targetArray.push(createTaskListTable(planData.tasks));
        targetArray.push(new Paragraph(""));
        targetArray.push(new Paragraph({ text: "Таблица 2. Ведомость рассчитанных параметров работ (таблица 6.1.2)", style: "strong" }));
        targetArray.push(createReportTable(planData.results));
    };

    
    if (hasComparison) {
        createTablesForSection(baseline, "Раздел 1. Базовый план проекта", mainContent);
        mainContent.push(new Paragraph({ text: "", pageBreakBefore: true }));
        createTablesForSection(optimized, "Раздел 2. Оптимизированный план проекта", mainContent);
    } else {
        createTablesForSection(optimized, "Раздел 1. Параметры проекта", mainContent);
    }

    const sections = [

        {
            properties: { page: { size: { orientation: PageOrientation.PORTRAIT } } },
            children: mainContent,
        },
    ];

    const addImageAsNewSection = async (imageData, title, isFirstAppendix) => {
    if (!imageData) return;

    const { width, height } = await getImageDimensions(imageData);
    const buffer = base64ToBuffer(imageData);
    
    const maxWidth = 840; 
    const maxHeight = 500;
    let newWidth, newHeight;
    
    if (title.includes("Сетевой график")) {
        newWidth = maxWidth; 
        newHeight = 150;    
    } else { 
        const aspectRatio = width / height;
        if (width / maxWidth > height / maxHeight) {
            newWidth = maxWidth;
            newHeight = newWidth / aspectRatio;
        } else {
            newHeight = maxHeight;
            newWidth = newHeight * aspectRatio;
        }
    }

    const appendixChildren = [];

    if (isFirstAppendix) {
        appendixChildren.push(new Paragraph({
            children: [new TextRun({ text: "Приложения", size: 32, bold: true })],
            alignment: AlignmentType.CENTER,
            pageBreakBefore: true,
        }));
        if (hasComparison) {

            appendixChildren.push(new Paragraph({
                children: [new TextRun({ text: "Визуализация итогового (оптимизированного) плана:", size: 22 })],
                alignment: AlignmentType.CENTER
            }));
        }
    }

    appendixChildren.push(new Paragraph({
        children: [new TextRun({ text: title, size: 26, bold: true })],
        alignment: AlignmentType.CENTER
    }));

    appendixChildren.push(new Paragraph({
        children: [new ImageRun({ data: buffer, transformation: { width: newWidth, height: newHeight } })],
        alignment: AlignmentType.CENTER
    }));

    sections.push({
        properties: { 
            page: { 
                size: { orientation: PageOrientation.LANDSCAPE },
            } 
        },
        children: appendixChildren,
    });
};

    await addImageAsNewSection(optimized.networkImage, "Приложение А. Сетевой график", true); 
    await addImageAsNewSection(optimized.ganttImage, "Приложение Б. Диаграмма Ганта", false);  

    const doc = new Document({
      sections: sections,
      styles: {
        paragraphStyles: [
            
             { id: "strong", name: "Strong", basedOn: "Normal", next: "Normal", run: { bold: true } },
      { id: "Normal", name: "Normal", basedOn: "Normal", next: "Normal", run: { size: 22 } },
     
      { id: "main-heading", name: "Main Heading", basedOn: "Normal", next: "Normal", run: { size: 32, bold: true } }, 
      { id: "sub-heading", name: "Sub Heading", basedOn: "Normal", next: "Normal", run: { size: 26, bold: true } },  
    ],
  },
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `SPU_Full_Report_${new Date().toLocaleDateString('ru-RU')}.docx`);

  } catch (error) {
    console.error('Ошибка при создании полного отчета:', error);
    alert(`Произошла ошибка при экспорте: ${error.message}`);
  }
};

