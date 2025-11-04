import { useState, useCallback, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import { startResizing } from '@/utils/resizing';
import { ButtonCancel } from './ButtonCancel';
import { useViewPodLogs } from '@/hooks/useViewPodLogs';
import { ButtonStop } from './ButtonStop';
import { ButtonStart } from './ButtonStart';
import { ButtonExpand } from './ButtonExpand';
import { Dropdown } from '@/components/common/Dropdown';
import DropdownTrigger from '@/components/ui/dropdown';
import { ButtonDownloadLog } from './ButtonDownloadLog';
import { ButtonClear } from './ButtonClear';

export interface LogViewerProps {
  open: boolean;
  title: string;
  podName: string;
  namespace: string;
  contextName?: string;
  containerName?: string;
  onClose: () => void;
  autoStream?: boolean;
}

export default function BottomLogViewer({
  open,
  title,
  podName,
  namespace,
  contextName,
  containerName,
  onClose,
  autoStream = true,
}: LogViewerProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [editorHeight, setEditorHeight] = useState(() => window.innerHeight * 0.5);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTail, setSelectedTail] = useState<number>(50);

  const logEndRef = useRef<HTMLDivElement>(null);

  const {
    logs,
    loading,
    error,
    isStreaming,
    startStreaming,
    stopStreaming,
    downloadLogs,
    clearLogs,
    setTailLines,
  } = useViewPodLogs({
    open,
    podName,
    namespace,
    contextName,
    containerName,
    tailLines: selectedTail,
    autoStream,
  });

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const onResize = useCallback(
    (e: React.MouseEvent) => {
      startResizing(
        e,
        {
          getCurrentSize: () => editorHeight,
          setSize: setEditorHeight,
          minSize: 200,
          maxSize: window.innerHeight * 0.9,
          axis: 'vertical',
        },
        setIsResizing
      );
    },
    [editorHeight]
  );

  const toggleExpand = () => {
    if (isExpanded) {
      setEditorHeight(window.innerHeight * 0.5);
    } else {
      setEditorHeight(window.innerHeight - 40);
    }
    setIsExpanded(!isExpanded);
  };

  if (!open) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-[55] bg-black/40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed right-0 bottom-0 left-0 z-[60] border-l border-white/10 bg-neutral-900/95 shadow-xl backdrop-blur-sm transition-transform duration-300 ${
          isResizing ? 'select-none' : ''
        }`}
        style={{ height: `${editorHeight}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute top-0 right-0 left-0 h-2 cursor-ns-resize bg-transparent hover:bg-white/10 active:bg-white/20"
          onMouseDown={onResize}
        />

        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-white/80">
            {title ?? 'Pod Logs'}
          </div>

          <div className="flex items-center gap-2">
            <Dropdown
              trigger={
                <DropdownTrigger
                  label={selectedTail === -1 ? 'All' : `${selectedTail} lines`}
                  className="w-40"
                  disabled={isStreaming}
                />
              }
              disabled={isStreaming}
            >
              {[50, 100, 500, 1000, -1].map((val) => (
                <div
                  key={val}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-white/10"
                  onClick={() => {
                    setTailLines(val);
                    setSelectedTail(val);
                  }}
                >
                  <Check
                    className={`h-4 w-4 text-green-400 ${
                      selectedTail === val ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  <span className="truncate text-xs text-white">
                    {val === -1 ? 'All' : `${val} lines`}
                  </span>
                </div>
              ))}
            </Dropdown>

            <ButtonDownloadLog onDownloadLogs={downloadLogs} />
            <ButtonClear onClearLogs={clearLogs} />

            {!isStreaming ? (
              <ButtonStart onStart={startStreaming} disabled={loading} />
            ) : (
              <ButtonStop onStop={stopStreaming} />
            )}

            <ButtonCancel onCancel={onClose} />

            <ButtonExpand onExpand={toggleExpand} isExpanded={isExpanded} />
          </div>
        </div>

        <div className="h-[calc(100%-49px)] p-4">
          <div className="relative h-full overflow-auto rounded-md border border-white/20 bg-black font-mono text-sm break-words whitespace-pre-wrap">
            {loading && !logs && (
              <div className="flex h-full items-center justify-center text-white/60">
                Loading logs...
              </div>
            )}

            {error && <div className="mb-4 text-red-400">Error: {error}</div>}

            {logs && (
              <div className="text-white/80">
                {logs}
                <div ref={logEndRef} />
              </div>
            )}

            {!loading && !error && !logs && (
              <div className="flex h-full items-center justify-center text-white/60">
                No logs available
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
