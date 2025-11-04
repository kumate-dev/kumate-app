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
  command?: string[]; // default: ["sh"]
  tty?: boolean; // default: true
  autoConnect?: boolean; // default: true
  onStream?: (evt: ExecEvent) => void; // live event stream for terminals
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
  const [output, setOutput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const unlistenRef = useRef<UnlistenFn | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const eventNameRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const autoStartedRef = useRef(false);

  const startSession = useCallback(async () => {
    if (!contextName || isConnected) return;
    setLoading(true);
    setError(null);
    try {
      const { eventName, sessionId, unlisten } = await startExecPodSession({
        context: contextName,
        namespace,
        podName,
        containerName,
        command,
        tty,
        onEvent: (evt: ExecEvent) => {
          // Forward raw event to streaming consumer (e.g., xterm)
          try {
            onStream?.(evt);
          } catch (_) {
            // ignore consumer errors
          }
          if (!isMountedRef.current) return;
          // Only accumulate text output when NOT in TTY mode (line-based)
          if (!tty && evt.type === 'EXEC_STDOUT' && evt.data) {
            setOutput((prev) => prev + evt.data + '\n');
          } else if (!tty && evt.type === 'EXEC_STDERR' && evt.data) {
            setOutput((prev) => prev + evt.data + '\n');
          } else if (evt.type === 'EXEC_ERROR') {
            setError(evt.error || 'Exec error');
            setIsConnected(false);
          } else if (evt.type === 'EXEC_COMPLETED') {
            setIsConnected(false);
          }
        },
      });
      unlistenRef.current = unlisten;
      sessionIdRef.current = sessionId;
      eventNameRef.current = eventName;
      setIsConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start exec session');
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, [contextName, namespace, podName, containerName, command, tty, isConnected]);

  const stopSession = useCallback(async () => {
    try {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      if (sessionIdRef.current) {
        await stopExecPodSession({ sessionId: sessionIdRef.current });
      }
    } finally {
      eventNameRef.current = null;
      sessionIdRef.current = null;
      setIsConnected(false);
      setLoading(false);
    }
  }, []);

  const sendInputHandler = useCallback(async (text: string, appendNewline: boolean = true) => {
    if (!sessionIdRef.current) return;
    try {
      await sendExecInput({ sessionId: sessionIdRef.current, input: text, appendNewline });
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
