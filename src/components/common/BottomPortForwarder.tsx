import { useCallback, useEffect, useMemo, useState } from 'react';
import { startResizing } from '@/utils/resizing';
import { ButtonCancel } from './ButtonCancel';
import { ButtonStop } from './ButtonStop';
import { ButtonStart } from './ButtonStart';
import { ButtonClear } from './ButtonClear';
import { usePortForward } from '@/hooks/usePortForward';

export interface BottomPortForwarderProps {
  open: boolean;
  title: string;
  contextName: string;
  namespace: string;
  resourceKind: 'pod' | 'service';
  resourceName: string;
  defaultLocalPort?: number;
  defaultRemotePort?: number;
  onClose: () => void;
}

export default function BottomPortForwarder({
  open,
  title,
  contextName,
  namespace,
  resourceKind,
  resourceName,
  defaultLocalPort = 8080,
  defaultRemotePort = 8080,
  onClose,
}: BottomPortForwarderProps) {
  const [panelHeight, setPanelHeight] = useState(() => window.innerHeight * 0.3);
  const [isResizing, setIsResizing] = useState(false);
  const [localPort, setLocalPort] = useState<number>(defaultLocalPort);
  const [remotePort, setRemotePort] = useState<number>(defaultRemotePort);

  const { running, output, error, start, stop, clear } = usePortForward({
    context: contextName,
    namespace,
    resourceKind,
    resourceName,
  });

  const onResize = useCallback(
    (e: React.MouseEvent) => {
      startResizing(
        e,
        {
          getCurrentSize: () => panelHeight,
          setSize: setPanelHeight,
          minSize: 160,
          maxSize: window.innerHeight * 0.9,
          axis: 'vertical',
        },
        setIsResizing
      );
    },
    [panelHeight]
  );

  const handleStart = useCallback(() => {
    start(localPort, remotePort);
  }, [start, localPort, remotePort]);

  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  const handleClose = useCallback(() => {
    try {
      stop();
    } catch {}
    onClose();
  }, [stop, onClose]);

  useEffect(() => {
    if (!open) {
      try {
        stop();
      } catch {}
      clear();
      setLocalPort(defaultLocalPort);
      setRemotePort(defaultRemotePort);
    }
  }, [open, stop, clear, defaultLocalPort, defaultRemotePort]);

  const toolbar = useMemo(
    () => (
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-white/70">
          <span>Local</span>
          <input
            type="number"
            value={localPort}
            min={1}
            max={65535}
            onChange={(e) => setLocalPort(parseInt(e.target.value || '0', 10))}
            className="w-24 rounded bg-white/10 px-2 py-1 text-white"
          />
        </label>
        <label className="flex items-center gap-1 text-white/70">
          <span>Remote</span>
          <input
            type="number"
            value={remotePort}
            min={1}
            max={65535}
            onChange={(e) => setRemotePort(parseInt(e.target.value || '0', 10))}
            className="w-24 rounded bg-white/10 px-2 py-1 text-white"
          />
        </label>
        {running ? <ButtonStop onClick={handleStop} /> : <ButtonStart onClick={handleStart} />}
        <ButtonClear onClick={clear} />
        <ButtonCancel onClick={handleClose} />
      </div>
    ),
    [running, localPort, remotePort, handleStart, handleStop, clear, handleClose]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40" onClick={handleClose}>
      <div className="absolute inset-0 bg-neutral-900/60" />
      <div
        className="absolute right-0 bottom-0 left-0 border-t border-white/10 bg-neutral-900"
        style={{ height: panelHeight }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-2">
          <div className="font-medium text-white/90">{title}</div>
          <div className="flex flex-1 justify-end">{toolbar}</div>
        </div>
        <div className="h-px bg-white/10" />
        <div className="h-[calc(100%-56px)] overflow-auto px-3 py-2 text-xs text-white/80">
          {error && <div className="mb-2 text-red-400">{error}</div>}
          {output.length === 0 ? (
            <div className="text-white/60">No output yet</div>
          ) : (
            output.map((line, idx) => (
              <div key={idx} className="leading-5">
                {line}
              </div>
            ))
          )}
        </div>
        <div
          className={`absolute top-0 right-0 left-0 h-2 cursor-row-resize ${isResizing ? 'bg-white/20' : ''}`}
          onMouseDown={onResize}
        />
      </div>
    </div>
  );
}
