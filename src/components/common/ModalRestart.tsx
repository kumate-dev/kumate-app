import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogFooter } from '@/components/ui/dialog';
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
  hideTitle?: boolean;
  hideDescription?: boolean;
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
    ? `Are you sure you want to restart ${resourceLabel}${resourceName ? ` "${resourceName}"` : ''}?`
    : 'Are you sure you want to restart?';

  const finalMessage = message ?? defaultMessage;

  const handleOpenChange = (v: boolean) => {
    if (!patching) {
      onOpenChange(v);
    }
  };

  const handleConfirm = () => {
    if (!patching) {
      onConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader title={title} description={finalMessage} />

        {patching && (
          <p className="mt-2 text-sm text-yellow-400" aria-live="polite" aria-atomic="true">
            Processing, please wait...
          </p>
        )}

        <DialogFooter>
          <ButtonCancel onClick={() => onOpenChange(false)} disabled={patching} />
          <ButtonRestart
            onClick={handleConfirm}
            disabled={patching}
            loading={patching}
            showIcon={false}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
