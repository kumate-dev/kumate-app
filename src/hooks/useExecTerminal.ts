import { useCallback, useEffect, useRef, useState } from 'react';
import {
  startExecPodSession,
  sendExecInput,
  stopExecPodSession,
  type ExecEvent,
} from '@/api/k8s/pods';
import type { UnlistenFn } from '@tauri-apps/api/event';

export interface UseExecTerminalProps {
  open: boolean;
  contextName?: string;
  namespace: string;
  podName: string;
  containerName?: string;
  command?: string[];
  tty?: boolean;
  autoConnect?: boolean;
  onStream?: (evt: ExecEvent) => void;
}

export interface UseExecTerminalReturn {
  output: string;
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  startSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  sendInput: (text: string, appendNewline?: boolean) => Promise<void>;
  clearOutput: () => void;
}

export function useExecTerminal({
  open,
  contextName,
  namespace,
  podName,
  containerName,
  command = ['sh'],
  tty = true,
  autoConnect = true,
  onStream,
}: UseExecTerminalProps): UseExecTerminalReturn {
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const unlistenRef = useRef<UnlistenFn | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const autoStartedRef = useRef(false);
  const onStreamRef = useRef(onStream);

  useEffect(() => {
    onStreamRef.current = onStream;
  }, [onStream]);

  const handleExecEvent = useCallback(
    (evt: ExecEvent) => {
      onStreamRef.current?.(evt);

      if (!isMountedRef.current) return;

      switch (evt.type) {
        case 'EXEC_STDOUT':
        case 'EXEC_STDERR':
          if (!tty && evt.data) {
            setOutput((prev) => prev + evt.data + '\n');
          }
          break;
        case 'EXEC_ERROR':
          setError(evt.error || 'Exec error');
          setIsConnected(false);
          break;
        case 'EXEC_COMPLETED':
          setIsConnected(false);
          break;
      }
    },
    [tty]
  );

  const startSession = useCallback(async () => {
    if (!contextName || isConnected) return;

    setLoading(true);
    setError(null);

    try {
      const { sessionId, unlisten } = await startExecPodSession({
        context: contextName,
        namespace,
        podName,
        containerName,
        command,
        tty,
        onEvent: handleExecEvent,
      });

      unlistenRef.current = unlisten;
      sessionIdRef.current = sessionId;
      setIsConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start exec session');
      setIsConnected(false);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [contextName, namespace, podName, containerName, command, tty, isConnected, handleExecEvent]);

  const stopSession = useCallback(async () => {
    const cleanup = () => {
      unlistenRef.current = null;
      sessionIdRef.current = null;
      setIsConnected(false);
      setLoading(false);
    };

    try {
      unlistenRef.current?.();

      if (sessionIdRef.current) {
        await stopExecPodSession({ sessionId: sessionIdRef.current });
      }
    } finally {
      cleanup();
    }
  }, []);

  const sendInputHandler = useCallback(async (text: string, appendNewline = true) => {
    if (!sessionIdRef.current) return;

    try {
      await sendExecInput({
        sessionId: sessionIdRef.current,
        input: text,
        appendNewline,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send input');
    }
  }, []);

  const clearOutput = useCallback(() => setOutput(''), []);

  useEffect(() => {
    if (open && contextName && autoConnect && !autoStartedRef.current) {
      autoStartedRef.current = true;
      startSession();
    }
  }, [open, contextName, autoConnect, startSession]);

  useEffect(() => {
    if (!open) {
      autoStartedRef.current = false;
      stopSession();
      setOutput('');
      setError(null);
    }
  }, [open, stopSession]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopSession();
    };
  }, [stopSession]);

  return {
    output,
    loading,
    error,
    isConnected,
    startSession,
    stopSession,
    sendInput: sendInputHandler,
    clearOutput,
  };
}
