import { Document, Packer, Paragraph, Table as DocxTable, TableRow, TableCell, WidthType, AlignmentType, TextRun, HeadingLevel } from 'docx';

const formatPerformers = (value) => {
  const number = parseInt(value, 10);
  if (!Number.isFinite(number) || number < 0) return '0';
  return String(number);
};

export const exportToWord = async (tasks, results) => {
  try {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
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
            new Paragraph({
              text: "2. Критический путь",
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
              text: results?.criticalPath ? results.criticalPath.join(' → ') : 'Не определен',
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
              text: "3. Список задач",
              heading: HeadingLevel.HEADING_1,
            }),
          ],
        },
      ],
    });

    if (tasks.length > 0) {
      const table = new DocxTable({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: ["ID", "Название", "Длительность", "Исполнители", "Критическая"].map(
              text => new TableCell({
                children: [new Paragraph({ text, alignment: AlignmentType.CENTER })],
              })
            ),
          }),
          ...tasks.map(task => new TableRow({
            children: [
              task.id,
              task.name,
              task.duration.toString(),
              formatPerformers(task.numberOfPerformers),
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

    const blob = await Packer.toBlob(doc);
    

    if (window.electronAPI && window.electronAPI.showSaveDialog && window.electronAPI.writeFile) {
      const defaultPath = `SPU_Project_Report_${new Date().toLocaleDateString('ru-RU')}.docx`;
      const filePath = await window.electronAPI.showSaveDialog({
        defaultPath: defaultPath,
        filters: [
          { name: 'Word Documents', extensions: ['docx'] }
        ]
      });

      if (filePath) {
        const arrayBuffer = await blob.arrayBuffer();
        await window.electronAPI.writeFile(filePath, Buffer.from(arrayBuffer));
        return { success: true };
      } else {
       
        return { success: false, error: 'Сохранение отменено пользователем' };
      }
    } else {
      
      const { saveAs } = await import('file-saver'); 
      saveAs(blob, `SPU_Project_Report_${new Date().toLocaleDateString('ru-RU')}.docx`);
      return { success: true }; 
    }

  } catch (error) {
    console.error('Ошибка при создании Word документа:', error);
    return { success: false, error: error.message };
  }
};
