import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const GostContent = () => (
  <div className="prose prose-sm max-w-none dark:prose-invert">
    <p>
      Настоящий стандарт устанавливает виды программ и программных документов для вычислительных машин, комплексов и систем независимо от их назначения и области применения.
    </p>

    <h3>1. ВИДЫ ПРОГРАММ</h3>
    <p>1.1. В зависимости от стадии разработки, функционального назначения и представления программы подразделяют на виды, приведенные в табл. 1.</p>
    
    <h4>Таблица 1</h4>
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Вид программы</th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Определение</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
          <tr>
            <td className="px-4 py-2 align-top">Компонент</td>
            <td className="px-4 py-2">Программа, рассматриваемая как единое целое, выполняющая законченную функцию и применяемая самостоятельно или в составе комплекса.</td>
          </tr>
          <tr>
            <td className="px-4 py-2 align-top">Комплекс</td>
            <td className="px-4 py-2">Программа, состоящая из двух или более компонентов, выполняющих взаимосвязанные функции, и применяемая самостоятельно.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h3 className="mt-6">2. ВИДЫ ПРОГРАММНЫХ ДОКУМЕНТОВ</h3>
    <p>2.1. Программные документы в зависимости от назначения подразделяют на виды, приведенные в табл. 2.</p>

    <h4>Таблица 2</h4>
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Наименование документа</th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Код</th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Назначение документа</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
          <tr><td className="px-4 py-2">Спецификация</td><td className="px-4 py-2"></td><td className="px-4 py-2">Документ, содержащий состав программы и документации на нее.</td></tr>
          <tr><td className="px-4 py-2">Ведомость держателей подлинников</td><td className="px-4 py-2">ВД</td><td className="px-4 py-2">Документ, содержащий перечень предприятий, в которых хранят подлинники программных документов.</td></tr>
          <tr><td className="px-4 py-2">Текст программы</td><td className="px-4 py-2"></td><td className="px-4 py-2">Запись программы с необходимыми комментариями.</td></tr>
          <tr><td className="px-4 py-2">Описание программы</td><td className="px-4 py-2"></td><td className="px-4 py-2">Сведения о логической структуре и функционировании программы.</td></tr>
          <tr><td className="px-4 py-2">Программа и методика испытаний</td><td className="px-4 py-2">ПМ</td><td className="px-4 py-2">Требования к программе и методы ее испытаний.</td></tr>
          <tr><td className="px-4 py-2">Техническое задание</td><td className="px-4 py-2">ТЗ</td><td className="px-4 py-2">Назначение, требования и основные исходные данные для разработки программы.</td></tr>
          <tr><td className="px-4 py-2">Пояснительная записка</td><td className="px-4 py-2">ПЗ</td><td className="px-4 py-2">Описание схемы, принципа действия и обоснование принятых при разработке технических и технико-экономических решений.</td></tr>
          <tr><td className="px-4 py-2">Руководство пользователя</td><td className="px-4 py-2"></td><td className="px-4 py-2">Сведения для обеспечения функционирования и эксплуатации программы.</td></tr>
        </tbody>
      </table>
    </div>
  </div>
);


const GostViewer = ({ open, onOpenChange }) => {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>ГОСТ 19.101-77. Единая система программной документации</DialogTitle>
          <DialogDescription>
            Виды программ и программных документов
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-grow overflow-y-auto pr-2">
            <GostContent />
        </div>

        <DialogFooter className="pt-4">
          <Button onClick={() => onOpenChange(false)}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GostViewer;

