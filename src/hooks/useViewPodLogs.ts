import { useEffect, useState, useRef, useCallback } from 'react';
import { getPodLogs, watchPodLogs } from '@/api/k8s/pods';
import { unwatch } from '@/api/k8s/unwatch';

export interface UseViewPodLogsProps {
  open: boolean;
  podName: string;
  namespace: string;
  contextName?: string;
  containerName?: string;
  tailLines?: number;
  autoStream?: boolean;
}

export interface UseViewPodLogsReturn {
  logs: string;
  loading: boolean;
  error: string | null;
  isStreaming: boolean;
  fetchLogs: () => Promise<void>;
  startStreaming: () => Promise<void>;
  stopStreaming: () => void;
  downloadLogs: () => void;
  clearLogs: () => void;
  setTailLines: (lines: number) => void;
}

export function useViewPodLogs({
  open,
  podName,
  namespace,
  contextName,
  containerName,
  tailLines: initialTailLines = 100,
  autoStream = true,
}: UseViewPodLogsProps): UseViewPodLogsReturn {
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [tailLines, setTailLines] = useState(initialTailLines);

  const unlistenRef = useRef<(() => void) | null>(null);
  const eventNameRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const autoStreamStartedRef = useRef(false);

  const fetchLogs = useCallback(async () => {
    if (!contextName) {
      setError('Context name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const logData = await getPodLogs({
        context: contextName,
        namespace,
        podName,
        containerName,
        tailLines,
      });
      setLogs(logData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, [contextName, namespace, podName, containerName, tailLines]);

  const startStreaming = useCallback(async () => {
    if (!contextName || isStreaming) return;

    setLoading(true);
    setError(null);
    setIsStreaming(true);

    try {
      const { unlisten, eventName } = await watchPodLogs({
        context: contextName,
        namespace,
        podName,
        containerName,
        tailLines,
        onEvent: (event) => {
          if (!isMountedRef.current) return;

          if (event.type === 'LOG_LINE' && event.log) {
            setLogs((prev) => prev + event.log + '\n');
          } else if (event.type === 'LOG_ERROR') {
            setError(event.error || 'Log stream error');
            setIsStreaming(false);
          } else if (event.type === 'LOG_COMPLETED') {
            setIsStreaming(false);
          }
        },
      });

      unlistenRef.current = unlisten;
      eventNameRef.current = eventName;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start log stream');
      setIsStreaming(false);
    } finally {
      setLoading(false);
    }
  }, [contextName, namespace, podName, containerName, tailLines, isStreaming]);

  const stopStreaming = useCallback(() => {
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
    if (contextName) {
      unwatch({ name: contextName });
    }
    eventNameRef.current = null;
    setIsStreaming(false);
    setLoading(false);
  }, [contextName]);

  const downloadLogs = useCallback(() => {
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${podName}-${containerName || 'logs'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [logs, podName, containerName]);

  const clearLogs = useCallback(() => {
    setLogs('');
  }, []);

  const handleSetTailLines = useCallback((lines: number) => {
    setTailLines(lines);
  }, []);

  useEffect(() => {
    if (open && contextName && autoStream && !autoStreamStartedRef.current) {
      autoStreamStartedRef.current = true;
      startStreaming();
    }
  }, [open, contextName, autoStream, startStreaming]);

  useEffect(() => {
    if (!open) {
      autoStreamStartedRef.current = false;
      stopStreaming();
      setLogs('');
      setError(null);
    }
  }, [open, stopStreaming]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopStreaming();
    };
  }, [stopStreaming]);

  return {
    logs,
    loading,
    error,
    isStreaming,
    fetchLogs,
    startStreaming,
    stopStreaming,
    downloadLogs,
    clearLogs,
    setTailLines: handleSetTailLines,
  };
}
