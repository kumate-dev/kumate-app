import { Dialog, DialogContent, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { ButtonCancel } from './ButtonCancel';
import { ButtonDelete } from './ButtonDelete';

interface ModalDeleteProps<T = unknown> {
  open: boolean;
  setOpen: (open: boolean) => void;
  items?: T[];
  onConfirm: () => Promise<void> | void;
  title?: string;
  message?: string;
  loading?: boolean;
}

export function ModalDelete<T>({
  open,
  setOpen,
  items = [],
  onConfirm,
  title = 'Confirm Delete',
  message,
  loading = false,
}: ModalDeleteProps<T>) {
  const count = items.length;

  const handleConfirm = async () => {
    if (!loading) {
      await onConfirm();
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!loading) {
      setOpen(v);
    }
  };

  const finalMessage =
    message ??
    (count === 0
      ? 'Are you sure you want to delete this item?'
      : `Are you sure you want to delete ${count} selected item${count > 1 ? 's' : ''}?`);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader title={title} description={finalMessage} />

        {loading && (
          <p className="text-sm text-yellow-400" aria-live="polite">
            Deletion in progress, please wait...
          </p>
        )}

        <DialogFooter>
          <ButtonCancel onClick={() => setOpen(false)} disabled={loading} />
          <ButtonDelete
            onClick={handleConfirm}
            disabled={loading || count === 0}
            loading={loading}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
