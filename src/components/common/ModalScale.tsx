import React from 'react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogFooter } from '@/components/ui/dialog';
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
  hideTitle?: boolean;
  hideDescription?: boolean;
  minScale?: number;
  maxScale?: number;
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

  minScale = 0,
  maxScale = 100,
}) => {
  const [inputValue, setInputValue] = React.useState(scale.toString());
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setInputValue(scale.toString());
      setError(null);
    }
  }, [scale, open]);

  const validateInput = (value: string): string | null => {
    if (value === '') return 'This field is required';

    const numVal = Number(value);
    if (Number.isNaN(numVal)) return 'Please enter a valid number';
    if (!Number.isInteger(numVal)) return 'Please enter a whole number';
    if (numVal < minScale) return `Minimum value is ${minScale}`;
    if (numVal > maxScale) return `Maximum value is ${maxScale}`;

    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    const err = validateInput(val);
    setError(err);
    if (!err) onScaleChange(Number(val));
  };

  const handleBlur = () => {
    const trimmed = inputValue.trim();
    if (trimmed !== inputValue) setInputValue(trimmed);
    setError(validateInput(trimmed));
  };

  const handleConfirm = () => {
    const err = validateInput(inputValue);
    if (err) return setError(err);
    onConfirm();
  };

  const handleOpenChange = (v: boolean) => {
    if (!patching) onOpenChange(v);
  };

  const finalMessage =
    message ??
    (resourceLabel
      ? `Enter the number of replicas for ${resourceLabel}${resourceName ? ` "${resourceName}"` : ''}`
      : 'Enter the number of replicas');

  const disabled = patching || !!error || inputValue === '';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader title={title} description={finalMessage} />

        <div className="mt-2 space-y-3 text-sm text-white/80">
          <div className="space-y-2">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleBlur}
              className={`w-32 ${error ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              disabled={patching}
              aria-invalid={!!error}
              aria-describedby={error ? 'scale-error' : undefined}
            />

            {error && (
              <p id="scale-error" className="text-xs text-red-500" role="alert" aria-live="polite">
                {error}
              </p>
            )}

            <p className="text-xs text-gray-400">
              Valid range: {minScale} to {maxScale}
            </p>
          </div>

          {patching && (
            <p className="text-sm text-yellow-400" aria-live="polite" aria-atomic="true">
              Applying changes, please wait...
            </p>
          )}
        </div>

        <DialogFooter>
          <ButtonCancel onClick={() => onOpenChange(false)} disabled={patching} />
          <ButtonScale
            onClick={handleConfirm}
            disabled={disabled}
            loading={patching}
            showIcon={false}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
