import React from 'react';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ButtonCancel } from '@/components/common/ButtonCancel';
import { ButtonScale } from '@/components/common/ButtonScale';

export interface ModalScaleProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patching?: boolean;
  title?: string;
  resourceLabel?: string;
  resourceName?: string;
  message?: string;
  scale: number;
  onScaleChange: (scale: number) => void;
  onConfirm: () => void;
}

export const ModalScale: React.FC<ModalScaleProps> = ({
  open,
  onOpenChange,
  patching = false,
  title = 'Adjust Replica Count',
  resourceLabel,
  resourceName,
  message,
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
    const val = e.target.value;
    setInputValue(val);
    const numVal = Number(val);
    const invalid = val === '' || Number.isNaN(numVal) || numVal < 0 || !/^\d*$/.test(val);
    setIsInvalid(invalid);
    if (!invalid) onScaleChange(numVal);
  };

  const handleBlur = () => {
    if (inputValue === '') setIsInvalid(true);
  };

  const handleConfirm = () => {
    if (inputValue === '' || isInvalid) {
      setIsInvalid(true);
      return;
    }
    onConfirm();
  };

  const isApplyDisabled = patching || isInvalid || inputValue === '';

  const defaultMessage = resourceLabel
    ? `Enter the number of replicas for ${resourceLabel} "${resourceName ?? ''}"`
    : 'Enter the number of replicas';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-3 text-sm text-white/80">
          <p>{message ?? defaultMessage}</p>
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
            {isInvalid && <span className="text-xs text-red-500">This field is required</span>}
          </div>
          {patching && <p className="text-yellow-400">Applying changes, please wait...</p>}
        </div>
        <DialogFooter>
          <ButtonCancel onClick={() => onOpenChange(false)} disabled={patching} />
          <ButtonScale onClick={handleConfirm} disabled={isApplyDisabled} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
