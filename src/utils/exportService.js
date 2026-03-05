import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType, TextRun, HeadingLevel, ImageRun, PageOrientation, SectionType } from 'docx';
import { saveAs } from 'file-saver';

const arePlansEqual = (plan1, plan2) => {
    if (!plan1 || !plan2) return false;
    const plan1Data = { tasks: plan1.tasks, results: plan1.results };
    const plan2Data = { tasks: plan2.tasks, results: plan2.results };
    return JSON.stringify(plan1Data) === JSON.stringify(plan2Data);
};

const base64ToImageData = (base64) => {
  const match = /^data:image\/([a-zA-Z0-9+]+);base64,/.exec(base64 || '');
  const base64String = match ? base64.slice(match[0].length) : base64;
  const binaryStr = atob(base64String);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const mimeType = (match?.[1] || 'png').toLowerCase();
  return {
    data: bytes,
    type: mimeType === 'jpeg' ? 'jpg' : mimeType,
  };
};

const formatReportNumber = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0.00';
  if (Math.abs(number) < 0.005) return '0.00';
  return number.toFixed(2);
};

const formatPerformers = (value) => {
  const number = parseInt(value, 10);
  if (!Number.isFinite(number) || number <= 0) return '1';
  return String(number);
};

const EDGE_ID_PATTERN = /^\d+-\d+$/;

const asDisplayText = (value) => {
  const text = String(value ?? '').trim();
  return text || '—';
};

const buildEdgeIdByTaskIdMap = (results) => {
  const map = {};
  const rows = Array.isArray(results?.tasks) ? results.tasks : [];

  rows.forEach((task) => {
    if (!task || task.isDummy === true) return;
    const edgeId = String(task.id ?? '').trim();
    if (!edgeId) return;
    const taskId = String(task.sourceTaskId ?? edgeId).trim();
    if (!taskId) return;
    map[taskId] = edgeId;
  });

  return map;
};

const resolveInputTaskIds = (task, edgeIdByTaskId) => {
  const taskId = String(task?.id ?? '').trim();
  const edgeId = String(edgeIdByTaskId?.[taskId] ?? '').trim()
    || (EDGE_ID_PATTERN.test(taskId) ? taskId : '');
  return {
    taskId: asDisplayText(taskId),
    edgeId: asDisplayText(edgeId),
  };
};

const resolveResultTaskIds = (task) => {
  const edgeId = String(task?.id ?? '').trim();
  const taskId = String(task?.sourceTaskId ?? edgeId).trim();
  return {
    taskId: asDisplayText(taskId),
    edgeId: asDisplayText(edgeId),
  };
};

const PORTRAIT_A4_SIZE = {
  width: 11906,
  height: 16838,
  orientation: PageOrientation.PORTRAIT,
};

const LANDSCAPE_A4_SIZE = {
  width: 16838,
  height: 11906,
  orientation: PageOrientation.LANDSCAPE,
};

const DEFAULT_PAGE_MARGIN = {
  top: 720,
  right: 720,
  bottom: 720,
  left: 720,
};

const PORTRAIT_PAGE = {
  size: PORTRAIT_A4_SIZE,
  margin: DEFAULT_PAGE_MARGIN,
};

const LANDSCAPE_PAGE = {
  size: LANDSCAPE_A4_SIZE,
  margin: DEFAULT_PAGE_MARGIN,
};

const fitImageToBox = (width, height, maxWidth, maxHeight) => {
  const safeWidth = Number(width) > 0 ? Number(width) : 1;
  const safeHeight = Number(height) > 0 ? Number(height) : 1;
  const widthRatio = maxWidth / safeWidth;
  const heightRatio = maxHeight / safeHeight;
  const scale = Math.min(widthRatio, heightRatio, 1);

  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
};

const createTaskListTable = (tasks, edgeIdByTaskId = {}) => {
  const tableHeaders = ["ID задачи", "ID дуги", "Наименование", "Длительность (дн.)", "Трудоемкость (н-ч)", "Исполнители", "Предшественники"];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: tableHeaders.map(text => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })] })), tableHeader: true }),
      ...tasks.map(task => {
        const { taskId, edgeId } = resolveInputTaskIds(task, edgeIdByTaskId);
        const rowData = [
          taskId,
          edgeId,
          task.name,
          task.duration.toString(),
          (task.laborIntensity || 0).toString(),
          formatPerformers(task.numberOfPerformers),
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
  const tableHeaders = ["ID задачи", "ID дуги", "Наименование", "Длит.", "Трудоем.", "Исп.", "Tр i", "Ран. ок.", "Tр j", "Позд. нач.", "Tп i", "Tп j", "R j", "Полн. рез.", "Част. рез.", "Крит."];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: tableHeaders.map(text => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: true })], alignment: AlignmentType.CENTER })] })), tableHeader: true }),
      ...results.tasks.map(task => {
        const { taskId, edgeId } = resolveResultTaskIds(task);
        const rowData = [
          taskId, edgeId, task.name, task.duration.toString(), (task.laborIntensity || 0).toString(), formatPerformers(task.numberOfPerformers),
          formatReportNumber(task.earlyEventTimeI ?? task.earlyStart),
          formatReportNumber(task.earlyFinish),
          formatReportNumber(task.earlyEventTimeJ),
          formatReportNumber(task.lateStart),
          formatReportNumber(task.lateEventTimeI),
          formatReportNumber(task.lateEventTimeJ ?? task.lateFinish),
          formatReportNumber(task.eventReserveJ),
          formatReportNumber(task.totalFloat),
          formatReportNumber(task.freeFloat),
          task.isCritical ? 'Да' : 'Нет',
        ];
        return new TableRow({
          children: rowData.map(value => new TableCell({ children: [new Paragraph({ children: [new TextRun(String(value ?? ''))], alignment: AlignmentType.CENTER })] }))
        });
      }),
    ],
  });
};

const getImageDimensions = (imagePayload) => {
  if (!imagePayload?.data || imagePayload.type !== 'png' || imagePayload.data.byteLength < 24) {
    return { width: 1, height: 1 };
  }

  const bytes = imagePayload.data;
  const hasPngSignature =
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10;

  if (!hasPngSignature) {
    return { width: 1, height: 1 };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 1, height: 1 };
  }

  return { width, height };
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
        const edgeIdByTaskId = buildEdgeIdByTaskIdMap(planData.results);
        targetArray.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }));
        targetArray.push(new Paragraph({
          children: [new TextRun({ text: "Таблица 1. Исходные данные (список работ)", bold: true })],
        }));
        targetArray.push(createTaskListTable(planData.tasks, edgeIdByTaskId));
        targetArray.push(new Paragraph(""));
        targetArray.push(new Paragraph({
          children: [new TextRun({ text: "Таблица 6.1.2 - Расчётные параметры работ сетевого графика", bold: true })],
        }));
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
            properties: {
                type: SectionType.NEXT_PAGE,
                page: { ...PORTRAIT_PAGE },
            },
            children: mainContent,
        },
    ];

    const addImageAsNewSection = async (imageData, title, isFirstAppendix) => {
    if (!imageData) return;

    const imagePayload = base64ToImageData(imageData);
    const { width, height } = getImageDimensions(imagePayload);
    
    const isNetworkDiagram = title.includes("Сетевой график");
    const isGanttDiagram = title.includes("Диаграмма Ганта");
    const maxWidth = isGanttDiagram ? 680 : 760;
    const maxHeight = isGanttDiagram ? 380 : 320;
    const fallbackWidth = isGanttDiagram ? 680 : 760;
    const fallbackHeight = isGanttDiagram ? 380 : 320;
    const { width: newWidth, height: newHeight } =
      width > 1 && height > 1
        ? fitImageToBox(width, height, maxWidth, maxHeight)
        : { width: fallbackWidth, height: fallbackHeight };

    const appendixChildren = [];

    if (isFirstAppendix) {
        appendixChildren.push(new Paragraph({
            children: [new TextRun({ text: "Приложения", size: 32, bold: true })],
            alignment: AlignmentType.CENTER,
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
        children: [new ImageRun({
            data: imagePayload.data,
            type: imagePayload.type,
            transformation: {
                width: Math.max(1, Math.round(newWidth)),
                height: Math.max(1, Math.round(newHeight)),
            },
        })],
        alignment: AlignmentType.CENTER
    }));

    sections.push({
        properties: { 
            type: SectionType.NEXT_PAGE,
            page: { ...LANDSCAPE_PAGE },
        },
        children: appendixChildren,
    });
};

    await addImageAsNewSection(optimized.networkImage, "Приложение А. Сетевой график", true); 

    const ganttPages = Array.isArray(optimized.ganttImages) && optimized.ganttImages.length > 0
      ? optimized.ganttImages
      : (optimized.ganttImage ? [optimized.ganttImage] : []);

    for (let index = 0; index < ganttPages.length; index += 1) {
      const pageTitle = ganttPages.length > 1
        ? `Приложение Б.${index + 1}. Диаграмма Ганта`
        : "Приложение Б. Диаграмма Ганта";
      await addImageAsNewSection(ganttPages[index], pageTitle, false);
    }

    const doc = new Document({
      sections,
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `SPU_Full_Report_${new Date().toLocaleDateString('ru-RU')}.docx`);

  } catch (error) {
    console.error('Ошибка при создании полного отчета:', error);
    alert(`Произошла ошибка при экспорте: ${error.message}`);
  }
};
