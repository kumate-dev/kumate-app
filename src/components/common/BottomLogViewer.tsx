import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
import { Spinner } from '@/components/ui/spinner';
import { Search } from '@/components/common/Search';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [selectedTail, setSelectedTail] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

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

  const toggleExpand = useCallback(() => {
    if (isExpanded) {
      setEditorHeight(window.innerHeight * 0.5);
    } else {
      setEditorHeight(window.innerHeight - 40);
    }
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  const handleTailSelect = useCallback(
    (val: number) => {
      setTailLines(val);
      setSelectedTail(val);
    },
    [setTailLines]
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose();
    },
    [onClose]
  );

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const tailOptions = useMemo(() => [50, 100, 500, 1000, -1], []);
  const displayTitle = useMemo(() => title ?? 'Pod Logs', [title]);

  const escapeRegExp = useCallback((s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), []);
  const highlightedLogs = useMemo(() => {
    if (!logs) return null;
    if (!searchQuery.trim()) return logs;
    try {
      const source = isRegex ? searchQuery : escapeRegExp(searchQuery);
      const flags = isCaseSensitive ? 'g' : 'gi';
      const pattern = new RegExp(source, flags);
      const parts = logs.split(pattern);
      const matches = logs.match(pattern) || [];
      const nodes: React.ReactNode[] = [];
      for (let i = 0; i < parts.length; i++) {
        nodes.push(parts[i]);
        if (i < matches.length) {
          nodes.push(
            <mark
              id={`log-match-${i}`}
              key={`h-${i}`}
              className={`${i === currentMatchIndex ? 'bg-amber-300 ring-2 ring-amber-500' : 'bg-yellow-300'} text-black dark:text-black`}
            >
              {matches[i]}
            </mark>
          );
        }
      }
      return nodes;
    } catch {
      return logs;
    }
  }, [logs, searchQuery, escapeRegExp, isCaseSensitive, isRegex, currentMatchIndex]);

  const matchesCount = useMemo(() => {
    if (!logs || !searchQuery.trim()) return 0;
    try {
      const source = isRegex ? searchQuery : escapeRegExp(searchQuery);
      const flags = isCaseSensitive ? 'g' : 'gi';
      const pattern = new RegExp(source, flags);
      return (logs.match(pattern) || []).length;
    } catch {
      return 0;
    }
  }, [logs, searchQuery, escapeRegExp, isCaseSensitive, isRegex]);

  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery]);

  const scrollToCurrentMatch = useCallback(() => {
    if (!logContainerRef.current) return;
    if (matchesCount === 0) return;
    const el = logContainerRef.current.querySelector(`#log-match-${currentMatchIndex}`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentMatchIndex, matchesCount]);

  useEffect(() => {
    scrollToCurrentMatch();
  }, [scrollToCurrentMatch, highlightedLogs]);

  const containerClass = useMemo(
    () =>
      `fixed right-0 bottom-0 left-0 z-[60] border-l border-neutral-200 bg-white/95 shadow-xl backdrop-blur-sm transition-transform duration-300 dark:border-white/10 dark:bg-neutral-900/95 ${
        isResizing ? 'select-none' : ''
      }`,
    [isResizing]
  );

  const logContentClass = useMemo(
    () =>
      'relative h-full overflow-auto rounded-md border border-neutral-200 bg-neutral-50 font-mono text-sm break-words whitespace-pre-wrap dark:border-white/20 dark:bg-black',
    []
  );

  if (!open) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-[55] bg-black/40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleBackdropClick}
      />

      <div
        className={containerClass}
        style={{ height: `${editorHeight}px` }}
        onClick={handleContainerClick}
      >
        <div
          className="absolute top-0 right-0 left-0 h-2 cursor-ns-resize bg-transparent hover:bg-neutral-200/60 active:bg-neutral-200/80 dark:hover:bg-white/10 dark:active:bg-white/20"
          onMouseDown={onResize}
        />

        <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-white/10">
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800 dark:text-white/80">
            {displayTitle}
          </div>

          <div
            className="flex items-center gap-2"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                  matchesCount > 0 && setCurrentMatchIndex((i) => (i - 1 + matchesCount) % matchesCount);
                } else {
                  matchesCount > 0 && setCurrentMatchIndex((i) => (i + 1) % matchesCount);
                }
              }
            }}
          >
            <Search query={searchQuery} onQueryChange={setSearchQuery} className="max-w-xs min-w-0 flex-shrink" />
            <div className="flex items-center gap-1 text-xs text-neutral-700 dark:text-white/70">
              <label className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-neutral-200/60 dark:hover:bg-white/10">
                <input type="checkbox" checked={isCaseSensitive} onChange={(e) => setIsCaseSensitive(e.target.checked)} />
                <span title="Match case">Aa</span>
              </label>
              <label className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-neutral-200/60 dark:hover:bg-white/10">
                <input type="checkbox" checked={isRegex} onChange={(e) => setIsRegex(e.target.checked)} />
                <span title="Regex">.*</span>
              </label>
              <button
                type="button"
                className="rounded-md p-1 text-neutral-800 hover:bg-neutral-200/60 hover:text-black disabled:opacity-50 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
                onClick={() => matchesCount > 0 && setCurrentMatchIndex((i) => (i - 1 + matchesCount) % matchesCount)}
                disabled={matchesCount === 0}
                aria-label="Previous match"
                title="Previous match"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>{matchesCount > 0 ? currentMatchIndex + 1 : 0}/{matchesCount}</span>
              <button
                type="button"
                className="rounded-md p-1 text-neutral-800 hover:bg-neutral-200/60 hover:text-black disabled:opacity-50 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
                onClick={() => matchesCount > 0 && setCurrentMatchIndex((i) => (i + 1) % matchesCount)}
                disabled={matchesCount === 0}
                aria-label="Next match"
                title="Next match"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
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
              {tailOptions.map((val) => (
                <div
                  key={val}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-neutral-100 dark:hover:bg-white/10"
                  onClick={() => handleTailSelect(val)}
                >
                  <Check
                    className={`h-4 w-4 text-green-400 ${
                      selectedTail === val ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  <span className="truncate text-xs text-neutral-800 dark:text-white">
                    {val === -1 ? 'All' : `${val} lines`}
                  </span>
                </div>
              ))}
            </Dropdown>

            <ButtonDownloadLog onClick={downloadLogs} />
            <ButtonClear onClick={clearLogs} />

            {!isStreaming ? (
              <ButtonStart onClick={startStreaming} disabled={loading || isStreaming} />
            ) : (
              <ButtonStop onClick={stopStreaming} disabled={!isStreaming} />
            )}

            <ButtonCancel onClick={onClose} />

            <ButtonExpand onClick={toggleExpand} isExpanded={isExpanded} />
          </div>
        </div>

        <div className="h-[calc(100%-49px)] p-4">
          <div className={logContentClass}>
            {(loading || (isStreaming && !logs)) && (
              <div className="flex h-full items-center justify-center">
                <Spinner size="md" className="text-neutral-500 dark:text-white/60" />
              </div>
            )}

            {error && <div className="mb-4 text-red-600 dark:text-red-400">Error: {error}</div>}

            {logs && (
              <div ref={logContainerRef} className="text-neutral-800 dark:text-white/80">
                {highlightedLogs}
                <div ref={logEndRef} />
              </div>
            )}

            {!loading && !isStreaming && !error && !logs && (
              <div className="flex h-full items-center justify-center text-neutral-500 dark:text-white/60">
                No logs available
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
