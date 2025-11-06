import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ButtonCancel } from '@/components/common/ButtonCancel';
import { ButtonRestart } from '@/components/common/ButtonRestart';

export interface ModalRestartProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  patching?: boolean;
  title?: string;
  resourceLabel?: string;
  resourceName?: string;
  message?: string;
}

export const ModalRestart: React.FC<ModalRestartProps> = ({
  open,
  onOpenChange,
  onConfirm,
  patching = false,
  title = 'Confirm Restart',
  resourceLabel,
  resourceName,
  message,
}) => {
  const defaultMessage = resourceLabel
    ? `Are you sure you want to restart ${resourceLabel} "${resourceName ?? ''}"?`
    : 'Are you sure you want to restart?';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-2 text-sm text-white/80">
          <p>{message ?? defaultMessage}</p>
          {patching && <p className="text-yellow-400">Processing, please wait...</p>}
        </div>

        <DialogFooter>
          <ButtonCancel onClick={() => onOpenChange(false)} disabled={patching} />
          <ButtonRestart onClick={onConfirm} disabled={patching} loading={patching} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
