import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { startResizing } from '@/utils/resizing';
import { ButtonCancel } from './ButtonCancel';
import { ButtonExpand } from './ButtonExpand';
import { useExecTerminal } from '@/hooks/useExecTerminal';
import type { ExecEvent } from '@/api/k8s/pods';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

export interface ExecTerminalProps {
  open: boolean;
  title: string;
  podName: string;
  namespace: string;
  contextName?: string;
  containerName?: string;
  onClose: () => void;
  autoConnect?: boolean;
}

export default function BottomExecTerminal({
  open,
  title,
  podName,
  namespace,
  contextName,
  containerName,
  onClose,
  autoConnect = true,
}: ExecTerminalProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [panelHeight, setPanelHeight] = useState(() => window.innerHeight * 0.5);
  const [isExpanded, setIsExpanded] = useState(false);
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastWrittenLenRef = useRef(0);
  const disposeDataHandlerRef = useRef<(() => void) | null>(null);
  const [shellMode] = useState<'auto' | 'bash' | 'sh' | 'ash' | 'zsh' | 'powershell' | 'cmd'>(
    'auto'
  );
  const [currentCommand, setCurrentCommand] = useState<string[]>(['sh', '-l']);
  const autoTriedRef = useRef(0);
  const lastStatusRef = useRef<'none' | 'noSession' | 'connecting'>('none');
  const [showConnectionError, setShowConnectionError] = useState(false);
  const [firstDataReceived, setFirstDataReceived] = useState(false);

  const handleStream = useCallback((evt: ExecEvent) => {
    if (!termRef.current) return;
    if ((evt.type === 'EXEC_STDOUT' || evt.type === 'EXEC_STDERR') && evt.data) {
      setFirstDataReceived(true);
      termRef.current.write(evt.data);
      try {
        termRef.current.scrollToBottom();
        termRef.current.focus();
      } catch {}
    }
  }, []);

  const { output, error, isConnected, startSession, stopSession, sendInput, loading } =
    useExecTerminal({
      open,
      contextName,
      namespace,
      podName,
      containerName,
      command: currentCommand,
      tty: true,
      autoConnect,
      onStream: handleStream,
    });

  const onResize = useCallback(
    (e: React.MouseEvent) => {
      startResizing(
        e,
        {
          getCurrentSize: () => panelHeight,
          setSize: setPanelHeight,
          minSize: 200,
          maxSize: window.innerHeight * 0.9,
          axis: 'vertical',
        },
        setIsResizing
      );
    },
    [panelHeight]
  );

  const toggleExpand = useCallback(() => {
    if (isExpanded) {
      setPanelHeight(window.innerHeight * 0.5);
    } else {
      setPanelHeight(window.innerHeight - 40);
    }
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  const handleClose = useCallback(() => {
    try {
      stopSession();
    } catch {}
    onClose();
  }, [stopSession, onClose]);

  const handleBackdropClick = useCallback(() => {
    handleClose();
  }, [handleClose]);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleTerminalClick = useCallback(() => {
    try {
      termRef.current?.focus();
    } catch {}
  }, []);

  const shellCommands = useMemo(
    () => ({
      auto: ['sh', '-l'],
      bash: ['bash', '-l'],
      zsh: ['zsh', '-l'],
      ash: ['ash', '-l'],
      powershell: ['powershell.exe', '-NoLogo', '-NoProfile'],
      cmd: ['cmd.exe'],
      sh: ['sh', '-l'],
    }),
    []
  );

  const autoCandidates = useMemo(
    () => [
      ['sh', '-l'],
      ['sh'],
      ['ash', '-l'],
      ['bash', '-l'],
      ['zsh', '-l'],
      ['powershell.exe', '-NoLogo', '-NoProfile'],
      ['cmd.exe'],
    ],
    []
  );

  useEffect(() => {
    if (open) {
      setShowConnectionError(false);
      lastStatusRef.current = 'none';
      autoTriedRef.current = 0;
      setFirstDataReceived(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      if (disposeDataHandlerRef.current) {
        disposeDataHandlerRef.current();
        disposeDataHandlerRef.current = null;
      }
      if (termRef.current) {
        termRef.current.dispose();
        termRef.current = null;
      }
      lastWrittenLenRef.current = 0;
      return;
    }

    if (!termRef.current && terminalContainerRef.current) {
      const term = new Terminal({
        convertEol: true,
        cursorBlink: true,
        scrollOnUserInput: true,
        fontSize: 12,
        letterSpacing: 0.5,
        lineHeight: 1.2,
        theme: {
          background: '#000000',
          foreground: '#E5E7EB',
          cursor: '#E5E7EB',
          black: '#000000',
          red: '#EF4444',
          green: '#10B981',
          yellow: '#F59E0B',
          blue: '#3B82F6',
          magenta: '#8B5CF6',
          cyan: '#06B6D4',
          white: '#D1D5DB',
          brightBlack: '#4B5563',
          brightRed: '#F87171',
          brightGreen: '#34D399',
          brightYellow: '#FBBF24',
          brightBlue: '#60A5FA',
          brightMagenta: '#A78BFA',
          brightCyan: '#22D3EE',
          brightWhite: '#F3F4F6',
        },
      });
      term.open(terminalContainerRef.current);
      const fit = new FitAddon();
      term.loadAddon(fit);
      fit.fit();
      setTimeout(() => {
        try {
          fit.fit();
        } catch {}
      }, 0);
      fitAddonRef.current = fit;
      termRef.current = term;
    }

    if (isConnected && termRef.current) {
      termRef.current.focus();
      const disposable = termRef.current.onData(async (data) => {
        const isWindowsShell =
          currentCommand &&
          currentCommand.length > 0 &&
          (currentCommand[0].toLowerCase().includes('powershell') ||
            currentCommand[0].toLowerCase().includes('cmd'));
        const normalized = isWindowsShell ? data.replace(/\r/g, '\r\n') : data;
        await sendInput(normalized, false);
      });
      disposeDataHandlerRef.current = () => disposable.dispose();
    } else {
      if (disposeDataHandlerRef.current) {
        disposeDataHandlerRef.current();
        disposeDataHandlerRef.current = null;
      }
    }

    return () => {
      if (disposeDataHandlerRef.current) {
        disposeDataHandlerRef.current();
        disposeDataHandlerRef.current = null;
      }
    };
  }, [open, isConnected, currentCommand, sendInput]);

  useEffect(() => {
    const term = termRef.current;
    if (!term || !open) return;

    const writeOnce = (key: 'noSession' | 'connecting', lines: string[]) => {
      if (lastStatusRef.current === key) return;
      lastStatusRef.current = key;
      try {
        term.clear();
        lines.forEach((l) => term.writeln(l));
      } catch {}
    };

    if (isConnected) {
      if (lastStatusRef.current !== 'none') {
        try {
          term.clear();
        } catch {}
        lastStatusRef.current = 'none';
      }
    } else if (loading) {
      writeOnce('connecting', ['Connecting to container...', 'Please wait...']);
    } else if (error && showConnectionError) {
      writeOnce('noSession', [
        "Couldn't open an interactive shell for this container.",
        'Press Cancel or click outside to close.',
      ]);
    }
  }, [isConnected, loading, error, open, showConnectionError]);

  // Removed auto-Enter kick on connect to avoid sending an unwanted newline.
  // Users will now see the prompt as provided by the container without automatic input.

  useEffect(() => {
    if (!open) return;
    if (shellMode !== 'auto') return;
    if (isConnected) return;

    const errorTimer = setTimeout(() => {
      if (!isConnected && !loading) {
        setShowConnectionError(true);
      }
    }, 5000);

    if (error && !loading) {
      const nextIdx = autoTriedRef.current + 1;
      if (nextIdx < autoCandidates.length) {
        autoTriedRef.current = nextIdx;
        setCurrentCommand(autoCandidates[nextIdx]);
        setShowConnectionError(false);
        setTimeout(() => {
          startSession();
        }, 200);
      } else {
        setShowConnectionError(true);
      }
    }

    return () => clearTimeout(errorTimer);
  }, [error, isConnected, open, shellMode, startSession, autoCandidates, loading]);

  useEffect(() => {
    if (open) {
      autoTriedRef.current = 0;
      const command = shellCommands[shellMode] || shellCommands.auto;
      setCurrentCommand(command);
      setShowConnectionError(false);
    }
  }, [open, shellMode, shellCommands]);

  useEffect(() => {
    if (!terminalContainerRef.current) return;
    const ro = new ResizeObserver(() => {
      try {
        fitAddonRef.current?.fit();
      } catch {}
    });
    ro.observe(terminalContainerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    try {
      fitAddonRef.current?.fit();
    } catch {}
  }, [panelHeight]);

  useEffect(() => {
    const onWinResize = () => {
      try {
        fitAddonRef.current?.fit();
      } catch {}
    };
    window.addEventListener('resize', onWinResize);
    return () => window.removeEventListener('resize', onWinResize);
  }, []);

  useEffect(() => {
    if (output.length === 0 && termRef.current && isConnected) {
      try {
        termRef.current.clear();
      } catch {}
      lastWrittenLenRef.current = 0;
    }
  }, [output, isConnected]);

  const displayTitle = useMemo(() => title ?? 'Exec Terminal', [title]);
  const containerClass = useMemo(
    () =>
      `fixed right-0 bottom-0 left-0 z-[60] overflow-hidden border-l border-white/10 bg-neutral-900/95 shadow-xl backdrop-blur-sm transition-transform duration-300 ${
        isResizing ? 'select-none' : ''
      }`,
    [isResizing]
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
        style={{ height: `${panelHeight}px` }}
        onClick={handleContainerClick}
      >
        <div
          className="absolute top-0 right-0 left-0 h-2 cursor-ns-resize bg-transparent hover:bg-white/10 active:bg-white/20"
          onMouseDown={onResize}
        />

        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-white/80">
            {displayTitle}
          </div>

          <div className="flex items-center gap-2">
            <ButtonCancel onClick={handleClose} />
            <ButtonExpand onClick={toggleExpand} isExpanded={isExpanded} />
          </div>
        </div>

        <div className="h-[calc(100%-49px)] p-4">
          <div className="relative h-full overflow-hidden rounded-md border border-white/20 bg-black">
            <div
              ref={terminalContainerRef}
              onMouseDown={handleTerminalClick}
              className="h-full w-full overflow-hidden font-mono text-sm text-white/80"
            />
            {loading && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="flex flex-col items-center gap-3 text-white/80">
                  <span className="sr-only">Connecting...</span>
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                </div>
              </div>
            )}
            {isConnected && !firstDataReceived && !loading && !error && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="text-xs text-white/70">
                  Connected. Waiting for prompt… Press Enter if nothing appears.
                </div>
              </div>
            )}
            {error && showConnectionError && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="text-xs text-red-300">
                  Could not start an interactive shell. Try a different shell or check container
                  image.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
