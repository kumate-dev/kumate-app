import { useEffect, useState, useRef, useCallback } from 'react';
import { getPodLogs, watchPodLogs } from '@/api/k8s/pods';
import { unwatch } from '@/api/k8s/unwatch';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

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
  downloadLogs: () => Promise<void>;
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
  const [logs, setLogs] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [tailLines, setTailLines] = useState(initialTailLines);

  const unlistenRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);
  const autoStreamStartedRef = useRef(false);
  const contextNameRef = useRef(contextName);

  useEffect(() => {
    contextNameRef.current = contextName;
  }, [contextName]);

  const handleLogEvent = useCallback((event: any) => {
    if (!isMountedRef.current) return;

    switch (event.type) {
      case 'LOG_LINE':
        if (event.log) {
          setLogs((prev) => prev + event.log + '\n');
        }
        break;
      case 'LOG_ERROR':
        setError(event.error || 'Log stream error');
        setIsStreaming(false);
        break;
      case 'LOG_COMPLETED':
        setIsStreaming(false);
        break;
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    const currentContext = contextNameRef.current;
    if (!currentContext) {
      setError('Context name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const logData = await getPodLogs({
        context: currentContext,
        namespace,
        podName,
        containerName,
        tailLines,
      });
      setLogs(logData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [namespace, podName, containerName, tailLines]);

  const startStreaming = useCallback(async () => {
    const currentContext = contextNameRef.current;
    if (!currentContext || isStreaming) return;

    setLoading(true);
    setError(null);
    setIsStreaming(true);

    try {
      const { unlisten } = await watchPodLogs({
        context: currentContext,
        namespace,
        podName,
        containerName,
        tailLines,
        onEvent: handleLogEvent,
      });

      unlistenRef.current = unlisten;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start log stream');
      setIsStreaming(false);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [namespace, podName, containerName, tailLines, isStreaming, handleLogEvent]);

  const stopStreaming = useCallback(() => {
    const currentContext = contextNameRef.current;

    unlistenRef.current?.();
    unlistenRef.current = null;

    if (currentContext) {
      unwatch({ name: currentContext });
    }

    setIsStreaming(false);
    setLoading(false);
  }, []);

  const downloadLogs = useCallback(async () => {
    if (!logs) return;

    try {
      const filePath = await save({
        defaultPath: `${podName}-${containerName || 'logs'}.log`,
        filters: [{ name: 'Log', extensions: ['log', 'txt'] }],
      });

      if (!filePath) return;

      await writeTextFile(filePath, logs);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Download failed: ${errorMessage}`);
    }
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
