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
import { ButtonScale } from '@/components/common/ButtonScale';

interface ModalDeploymentScaleProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deployment: V1Deployment;
  patching: boolean;
  scale: number;
  onScaleChange: (scale: number) => void;
  onConfirm: (deployment: V1Deployment) => void;
}

export const ModalDeploymentScale: React.FC<ModalDeploymentScaleProps> = ({
  open,
  onOpenChange,
  deployment,
  patching,
  scale,
  onScaleChange,
  onConfirm,
}) => {
  const [inputValue, setInputValue] = React.useState(scale.toString());
  const [isInvalid, setIsInvalid] = React.useState(false);

  React.useEffect(() => {
    setInputValue(scale.toString());
  }, [scale]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    setIsInvalid(false);
    
    if (value === '') {
      setInputValue('');
      return;
    }

    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      setInputValue(value);
      onScaleChange(numValue);
    }
  };

  const handleBlur = () => {
    if (inputValue === '') {
      setIsInvalid(true);
      const normalizedValue = 0;
      setInputValue(normalizedValue.toString());
      onScaleChange(normalizedValue);
    } else {
      const normalizedValue = parseInt(inputValue, 10);
      if (!isNaN(normalizedValue) && normalizedValue >= 0) {
        setIsInvalid(false);
        setInputValue(normalizedValue.toString());
        onScaleChange(normalizedValue);
      } else {
        setIsInvalid(true);
      }
    }
  };

  const handleConfirm = () => {
    if (inputValue === '' || isInvalid) {
      setIsInvalid(true);
      return;
    }
    onConfirm(deployment);
  };

  const isApplyDisabled = patching || isInvalid || inputValue === '';

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
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleBlur}
              className={`w-32 ${isInvalid ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              disabled={patching}
              required
            />
            {isInvalid && (
              <span className="text-red-500 text-xs">This field is required</span>
            )}
          </div>
          {patching && <p className="text-yellow-400">Applying changes, please wait...</p>}
        </div>
        <DialogFooter>
          <ButtonCancel onClick={() => onOpenChange(false)} disabled={patching} />
          <ButtonScale 
            onClick={handleConfirm} 
            disabled={isApplyDisabled}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
