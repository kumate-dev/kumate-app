import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { V1Deployment } from '@kubernetes/client-node';
import { ButtonRestart } from '@/components/common/ButtonRestart';
import { ButtonCancel } from '@/components/common/ButtonCancel';

interface ModalDeploymentRestartProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deployment: V1Deployment;
  patching: boolean;
  onConfirm: (deployment: V1Deployment) => void;
}

export const ModalDeploymentRestart: React.FC<ModalDeploymentRestartProps> = ({
  open,
  onOpenChange,
  deployment,
  patching,
  onConfirm,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Restart Deployment</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-2 text-sm text-white/80">
          <p>
            {`Are you sure you want to restart deployment "${deployment.metadata?.name ?? ''}"?`}
          </p>
          {patching && <p className="text-yellow-400">Processing, please wait...</p>}
        </div>
        <DialogFooter>
          <ButtonCancel onClick={() => onOpenChange(false)} disabled={patching} />
          <ButtonRestart onClick={() => onConfirm(deployment)} disabled={patching} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
