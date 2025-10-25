import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ModalConfirmDeleteProps<T = unknown> {
  open: boolean;
  setOpen: (open: boolean) => void;
  items?: T[];
  onConfirm: () => void;
  title?: string;
  message?: string;
}

export function ModalConfirmDelete<T>({
  open,
  setOpen,
  items = [],
  onConfirm,
  title = 'Confirm Delete',
  message,
}: ModalConfirmDeleteProps<T>) {
  const count = items.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-2 text-sm text-white/80">
          <p>
            {message ??
              `Are you sure you want to delete ${count} selected item${count > 1 ? 's' : ''}?`}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              setOpen(false);
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
