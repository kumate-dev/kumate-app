import { useCallback, useEffect, useMemo, useState } from 'react';
import { startResizing } from '@/utils/resizing';
import { ButtonCancel } from '../../../../components/common/ButtonCancel';
import { ButtonStop } from '../../../../components/common/ButtonStop';
import { ButtonStart } from '../../../../components/common/ButtonStart';
import { ButtonClear } from '../../../../components/common/ButtonClear';
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
  const [https, setHttps] = useState<boolean>(false);
  const [openBrowser, setOpenBrowser] = useState<boolean>(true);

  const { running, output, error, sessionId, start, stop, clear } = usePortForward({
    context: contextName,
    namespace,
    resourceKind,
    resourceName,
  });

  const previewUrl = useMemo(
    () => `${https ? 'https' : 'http'}://localhost:${localPort}/`,
    [https, localPort]
  );

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

  const handleStart = useCallback(async () => {
    await start(localPort, remotePort);
    if (openBrowser) {
      const url = previewUrl;
      setTimeout(() => {
        try {
          window.open(url, '_blank');
        } catch {}
      }, 800);
    }
  }, [start, localPort, remotePort, openBrowser, previewUrl]);

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
        <div className="mr-4 flex items-center gap-2">
          <span className="text-white/70">URL</span>
          <span className="rounded bg-white/10 px-2 py-1 text-xs break-all text-white">
            {previewUrl}
          </span>
          <button
            className="rounded bg-white/10 px-2 py-1 text-white/80 hover:bg-white/20"
            onClick={() => {
              try {
                navigator.clipboard.writeText(previewUrl);
              } catch {}
            }}
          >
            Copy
          </button>
          <button
            className="rounded bg-white/10 px-2 py-1 text-white/80 hover:bg-white/20"
            onClick={() => {
              try {
                window.open(previewUrl, '_blank');
              } catch {}
            }}
          >
            Open
          </button>
        </div>
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
        <label className="ml-2 flex items-center gap-2 text-white/70">
          <input type="checkbox" checked={https} onChange={(e) => setHttps(e.target.checked)} />
          https
        </label>
        <label className="ml-2 flex items-center gap-2 text-white/70">
          <input
            type="checkbox"
            checked={openBrowser}
            onChange={(e) => setOpenBrowser(e.target.checked)}
          />
          Open in Browser
        </label>
        {running ? <ButtonStop onClick={handleStop} /> : <ButtonStart onClick={handleStart} />}
        <ButtonClear onClick={clear} />
        <ButtonCancel onClick={handleClose} />
      </div>
    ),
    [
      previewUrl,
      running,
      localPort,
      remotePort,
      https,
      openBrowser,
      handleStart,
      handleStop,
      clear,
      handleClose,
    ]
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
          <div className="mb-2 flex items-center justify-between text-white/60">
            <div>
              <span className="mr-2">Resource:</span>
              <span className="text-white">
                {resourceKind}/{resourceName}
              </span>
              <span className="ml-2">Namespace:</span>
              <span className="text-white">{namespace}</span>
            </div>
            {sessionId && (
              <div>
                <span className="mr-2">Session:</span>
                <span className="text-white">{sessionId}</span>
              </div>
            )}
          </div>
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
