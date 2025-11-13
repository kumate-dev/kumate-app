import React from 'react';
import { ButtonSecondary } from '@/components/common/ButtonSecondary';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { ButtonCancel } from '@/components/common/ButtonCancel';
import { ButtonSave } from '@/components/common/ButtonSave';
import { ButtonClear } from '@/components/common/ButtonClear';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';

export interface ModalEditContextProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patching?: boolean;
  contextName: string;
  currentDisplayName?: string;
  currentAvatarBase64?: string;
  currentAvatarMime?: string;
  onConfirm: (displayName: string, avatarBase64?: string | null) => void;
}

export const ModalEditContext: React.FC<ModalEditContextProps> = ({
  open,
  onOpenChange,
  patching = false,
  contextName,
  currentDisplayName,
  currentAvatarBase64,
  currentAvatarMime,
  onConfirm,
}) => {
  const [displayName, setDisplayName] = React.useState<string>(currentDisplayName ?? contextName);
  const [avatarB64, setAvatarB64] = React.useState<string | undefined>(currentAvatarBase64);
  const [avatarMime, setAvatarMime] = React.useState<string | undefined>(currentAvatarMime);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setDisplayName(currentDisplayName ?? contextName);
      setAvatarB64(currentAvatarBase64);
      setAvatarMime(currentAvatarMime);
      setError(null);
    }
  }, [open, currentDisplayName, currentAvatarBase64, currentAvatarMime, contextName]);

  const pickAvatarWithSystemDialog = async () => {
    try {
      setError(null);
      const selected = await openDialog({
        multiple: false,
        directory: false,
        filters: [
          {
            name: 'Images',
            extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
          },
        ],
      });
      if (!selected || Array.isArray(selected)) return;
      const bytes = await readFile(selected);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);
      // detect mime from extension
      const ext = selected.split('.').pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
      };
      setAvatarB64(b64);
      setAvatarMime((ext && mimeMap[ext]) || 'image/png');
    } catch (err) {
      setError('Cannot open image. Please try again.');
    }
  };

  const clearAvatar = () => {
    setAvatarB64('');
    setAvatarMime(undefined);
  };

  const disabled = patching || !!error || !displayName.trim();

  return (
    <Dialog open={open} onOpenChange={(v) => !patching && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader title={`Edit Cluster "${contextName}"`} />

        <div className="mt-2 space-y-4 text-sm text-white/80">
          <div className="space-y-2">
            <label className="block text-xs text-white/60" htmlFor="ctx-display-name">
              Display name
            </label>
            <Input
              id="ctx-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={patching}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs text-white/60" htmlFor="ctx-avatar">
              Avatar
            </label>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-full border border-white/20 bg-white/10">
                {avatarB64 ? (
                  <img
                    src={`data:${avatarMime ?? 'image/png'};base64,${avatarB64}`}
                    alt="avatar preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-white/50">
                    No image
                  </div>
                )}
              </div>

              <ButtonSecondary id="ctx-avatar" type="button" onClick={pickAvatarWithSystemDialog} disabled={patching}>
                Choose image...
              </ButtonSecondary>

              {avatarB64 && (
                <ButtonClear onClick={clearAvatar} disabled={patching} text="Remove avatar" />
              )}
            </div>
            {error && (
              <p className="text-xs text-red-500" role="alert">
                {error}
              </p>
            )}
          </div>

          {patching && (
            <p className="text-sm text-yellow-400" aria-live="polite" aria-atomic="true">
              Saving changes, please wait...
            </p>
          )}
        </div>

        <DialogFooter>
          <ButtonCancel onClick={() => onOpenChange(false)} disabled={patching} />
          <ButtonSave
            onClick={() => onConfirm(displayName.trim(), avatarB64 ?? null)}
            disabled={disabled}
            loading={patching}
            text="Save"
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
