import { useState, useImperativeHandle, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const GUIDE_PDF_RELATIVE_PATH = 'help/user-guide.pdf';

const UserGuide = forwardRef((props, ref) => {
  const [open, setOpen] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const guidePdfUrl = new URL(GUIDE_PDF_RELATIVE_PATH, window.location.href).toString();

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
  }));

  if (!open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Руководство пользователя - СПУ</DialogTitle>
          <DialogDescription>
            Встроенный просмотр PDF-руководства.
          </DialogDescription>
        </DialogHeader>

        <div className="w-full">
          <iframe
            src={guidePdfUrl}
            title="PDF-руководство пользователя"
            className="h-[75vh] w-full rounded-md border"
            onError={() => setPdfError('Не удалось встроить PDF. Проверьте файл public/help/user-guide.pdf.')}
          />
        </div>

        {pdfError && (
          <p className="text-sm text-destructive">{pdfError}</p>
        )}

        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default UserGuide;
