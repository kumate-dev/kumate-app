import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ButtonCancel } from './ButtonCancel';
import { ButtonDelete } from './ButtonDelete';

interface ModalConfirmDeleteProps<T = unknown> {
  open: boolean;
  setOpen: (open: boolean) => void;
  items?: T[];
  onConfirm: () => void;
  title?: string;
  message?: string;
  loading?: boolean;
}

export function ModalConfirmDelete<T>({
  open,
  setOpen,
  items = [],
  onConfirm,
  title = 'Confirm Delete',
  message,
  loading = false,
}: ModalConfirmDeleteProps<T>) {
  const count = items.length;

  const handleConfirm = () => {
    if (!loading) {
      onConfirm();
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!loading) {
      setOpen(open);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-2 text-sm text-white/80">
          <p>
            {message ??
              `Are you sure you want to delete ${count} selected item${count > 1 ? 's' : ''}?`}
          </p>
          {loading && <p className="text-yellow-400">Deletion in progress, please wait...</p>}
        </div>

        <DialogFooter>
          <ButtonCancel onClick={() => setOpen(false)} disabled={loading || count === 0} />
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
