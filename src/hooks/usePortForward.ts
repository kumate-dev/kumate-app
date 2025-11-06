import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listenPortForward,
  startPortForward,
  stopPortForward,
  type PortForwardEvent,
} from '@/api/k8s/portForward';
import type { UnlistenFn } from '@tauri-apps/api/event';

export interface UsePortForwardOptions {
  context: string;
  namespace: string;
  resourceKind: 'pod' | 'service' | 'deployment' | 'replicaset' | 'statefulset' | 'daemonset';
  resourceName: string;
}

export interface UsePortForwardReturn {
  running: boolean;
  output: string[];
  error?: string | null;
  sessionId?: string | null;
  start: (localPort: number, remotePort: number) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
}

export function usePortForward(opts: UsePortForwardOptions): UsePortForwardReturn {
  const { context, namespace, resourceKind, resourceName } = opts;
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  const handleEvent = useCallback((evt: PortForwardEvent) => {
    const t = evt.type;
    if (t === 'PF_STDOUT' || t === 'PF_STDERR') {
      setOutput((prev) => [...prev, evt.line]);
    } else if (t === 'PF_ERROR') {
      setError(evt.line || 'Port forward error');
      setRunning(false);
    } else if (t === 'PF_DONE') {
      setRunning(false);
    }
  }, []);

  const start = useCallback(
    async (localPort: number, remotePort: number) => {
      setError(null);
      setOutput([]);
      const res = await startPortForward({
        context,
        namespace,
        resourceKind,
        resourceName,
        localPort,
        remotePort,
      });
      sessionIdRef.current = res.sessionId;
      setRunning(true);
      unlistenRef.current = await listenPortForward(res.eventName, handleEvent);
    },
    [context, namespace, resourceKind, resourceName, handleEvent]
  );

  const stop = useCallback(async () => {
    const id = sessionIdRef.current;
    if (id) {
      await stopPortForward(id);
    }
    setRunning(false);
  }, []);

  const clear = useCallback(() => {
    setOutput([]);
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, []);

  return { running, output, error, sessionId: sessionIdRef.current, start, stop, clear };
}
