import React from 'react';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { V1Deployment } from '@kubernetes/client-node';
import { ButtonCancel } from '@/components/common/ButtonCancel';
import { ButtonApply } from '@/components/common/ButtonApply';

interface ModalDeploymentScaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deployment: V1Deployment;
  patching: boolean;
  scale: number;
  onScaleChange: (scale: number) => void;
  onConfirm: (deployment: V1Deployment) => void;
}

export const ModalDeploymentScaleDialog: React.FC<ModalDeploymentScaleDialogProps> = ({
  open,
  onOpenChange,
  deployment,
  patching,
  scale,
  onScaleChange,
  onConfirm,
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(0, Number(e.target.value) || 0);
    onScaleChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Replica Count</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-3 text-sm text-white/80">
          <p>
            {`Enter the number of replicas for deployment "${deployment.metadata?.name ?? ''}"`}
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              value={scale}
              onChange={handleInputChange}
              className="w-32"
              disabled={patching}
            />
          </div>
          {patching && <p className="text-yellow-400">Applying changes, please wait...</p>}
        </div>
        <DialogFooter>
          <ButtonCancel onClick={() => onOpenChange(false)} disabled={patching} />
          <ButtonApply onClick={() => onConfirm(deployment)} disabled={patching} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
