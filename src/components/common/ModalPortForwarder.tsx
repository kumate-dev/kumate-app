import React, { useCallback, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ButtonCancel } from '@/components/common/ButtonCancel';
import { ButtonStart } from '@/components/common/ButtonStart';
import { usePortForward } from '@/hooks/usePortForward';
import { openUrl } from '@tauri-apps/plugin-opener';

export interface ModalPortForwarderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contextName?: string;
  namespace: string;
  resourceKind: 'pod' | 'service' | 'deployment' | 'replicaset' | 'statefulset' | 'daemonset';
  resourceName: string;
  defaultRemotePort?: number;
  defaultLocalPort?: number;
  hideTitle?: boolean;
  hideDescription?: boolean;
}

function randomEphemeralPort() {
  return Math.floor(20000 + Math.random() * 30000);
}

export const ModalPortForwarder: React.FC<ModalPortForwarderProps> = ({
  open,
  onOpenChange,
  contextName,
  namespace,
  resourceKind,
  resourceName,
  defaultRemotePort,
  defaultLocalPort,
}) => {
  const [localPortInput, setLocalPortInput] = useState<string>(
    defaultLocalPort ? String(defaultLocalPort) : ''
  );
  const [https, setHttps] = useState<boolean>(false);
  const [openBrowser, setOpenBrowser] = useState<boolean>(true);

  const pf = usePortForward({
    context: contextName || '',
    namespace,
    resourceKind,
    resourceName,
  });

  const canStart = useMemo(
    () => !!contextName && !!resourceName && !!namespace && !pf.running,
    [contextName, resourceName, namespace, pf.running]
  );

  const handleStart = useCallback(async () => {
    const parsed = Number(localPortInput);
    const local = Number.isFinite(parsed) && parsed > 0 ? parsed : randomEphemeralPort();
    const remote =
      typeof defaultRemotePort === 'number' && defaultRemotePort > 0
        ? defaultRemotePort
        : https
          ? 443
          : 80;
    await pf.start(local, remote);
    if (openBrowser) {
      const useHttps = typeof defaultRemotePort === 'number' ? defaultRemotePort === 443 : https;
      const url = `${useHttps ? 'https' : 'http'}://localhost:${local}/`;
      setTimeout(async () => {
        try {
          await openUrl(url);
        } catch {
          try {
            window.open(url, '_blank');
          } catch {}
        }
      }, 800);
    }
    onOpenChange(false);
  }, [localPortInput, https, openBrowser, pf, onOpenChange, defaultRemotePort]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          title={`Port Forwarding for ${resourceName}`}
          description="Configure local port forwarding and optionally open in your browser."
        />

        <div className="mt-2 space-y-4 text-sm">
          <div>
            <label className="mb-1 block text-white/80">Local port to forward from:</label>
            <Input
              placeholder="Random"
              inputMode="numeric"
              value={localPortInput}
              onChange={(e) => setLocalPortInput(e.target.value)}
              className="w-48"
            />
          </div>

          {typeof defaultRemotePort === 'number' ? (
            <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white/80">
              <div>
                Remote port: <span className="text-white">{defaultRemotePort}</span>
              </div>
              <label className="flex items-center gap-2">
                <Checkbox checked={openBrowser} onCheckedChange={setOpenBrowser} /> Open in Browser
              </label>
            </div>
          ) : (
            <div className="flex items-center gap-8">
              <label className="flex items-center gap-2 text-white/80">
                <Checkbox checked={https} onCheckedChange={setHttps} /> https
              </label>
              <label className="flex items-center gap-2 text-white/80">
                <Checkbox checked={openBrowser} onCheckedChange={setOpenBrowser} /> Open in Browser
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <ButtonCancel onClick={() => onOpenChange(false)} />
          <ButtonStart onClick={handleStart} disabled={!canStart} useIcon={false} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
