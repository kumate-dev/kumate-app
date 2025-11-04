import { useCallback, useEffect, useRef, useState } from 'react';
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
  const lastWrittenLenRef = useRef<number>(0);
  const disposeDataHandlerRef = useRef<(() => void) | null>(null);
  const [shellMode] = useState<'auto' | 'bash' | 'sh' | 'ash' | 'zsh' | 'powershell' | 'cmd'>(
    'auto'
  );
  const [currentCommand, setCurrentCommand] = useState<string[]>(['bash', '-l']);
  const autoTriedRef = useRef<number>(0);

  const { output, error, isConnected, startSession, stopSession, sendInput } =
    useExecTerminal({
      open,
      contextName,
      namespace,
      podName,
      containerName,
      command: currentCommand,
      tty: true,
      autoConnect,
      onStream: (evt: ExecEvent) => {
        if (!termRef.current) return;
        if ((evt.type === 'EXEC_STDOUT' || evt.type === 'EXEC_STDERR') && evt.data) {
          termRef.current.write(evt.data);
          try {
            termRef.current.scrollToBottom();
            termRef.current.focus();
          } catch (_) {
            // ignore focus/scroll errors
          }
        }
      },
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

  const toggleExpand = () => {
    if (isExpanded) {
      setPanelHeight(window.innerHeight * 0.5);
    } else {
      setPanelHeight(window.innerHeight - 40);
    }
    setIsExpanded(!isExpanded);
  };

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
          background: '#000000', // match black background
          foreground: '#E5E7EB', // gray-200
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
        } catch (_) {}
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
  }, [open, isConnected]);

  useEffect(() => {
    if (!terminalContainerRef.current) return;
    const ro = new ResizeObserver(() => {
      try {
        fitAddonRef.current?.fit();
      } catch (_) {}
    });
    ro.observe(terminalContainerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    try {
      fitAddonRef.current?.fit();
    } catch (_) {}
  }, [panelHeight]);

  useEffect(() => {
    const onWinResize = () => {
      try {
        fitAddonRef.current?.fit();
      } catch (_) {}
    };
    window.addEventListener('resize', onWinResize);
    return () => window.removeEventListener('resize', onWinResize);
  }, []);

  useEffect(() => {
    if (output.length === 0 && termRef.current) {
      try {
        termRef.current.clear();
      } catch (_) {}
      lastWrittenLenRef.current = 0;
    }
  }, [output]);

  useEffect(() => {
    autoTriedRef.current = 0;
    if (shellMode === 'auto') {
      setCurrentCommand(['bash', '-l']);
    } else if (shellMode === 'bash') {
      setCurrentCommand(['bash', '-l']);
    } else if (shellMode === 'zsh') {
      setCurrentCommand(['zsh', '-l']);
    } else if (shellMode === 'ash') {
      setCurrentCommand(['ash', '-l']);
    } else if (shellMode === 'powershell') {
      setCurrentCommand(['powershell.exe', '-NoLogo', '-NoProfile']);
    } else if (shellMode === 'cmd') {
      setCurrentCommand(['cmd.exe']);
    } else {
      setCurrentCommand(['sh', '-l']);
    }
  }, [shellMode]);

  useEffect(() => {
    if (!open) return;
    if (shellMode !== 'auto') return;
    if (isConnected) return;
    if (!error) return;
    const candidates: string[][] = [
      // Linux shells first
      ['bash', '-l'],
      ['zsh', '-l'],
      ['ash', '-l'],
      ['sh', '-l'],
      ['sh'],
      // Windows shells as fallbacks
      ['powershell.exe', '-NoLogo', '-NoProfile'],
      ['cmd.exe'],
    ];
    const nextIdx = autoTriedRef.current + 1;
    if (nextIdx < candidates.length) {
      autoTriedRef.current = nextIdx;
      setCurrentCommand(candidates[nextIdx]);
      // attempt reconnect automatically
      setTimeout(() => {
        startSession();
      }, 200);
    }
  }, [error, isConnected, open, shellMode, startSession]);

  // Write status messages directly into xterm at the cursor, no overlays
  const lastStatusRef = useRef<'none' | 'noSession'>('none');
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    const writeOnce = (key: 'noSession', lines: string[]) => {
      if (lastStatusRef.current === key) return;
      lastStatusRef.current = key;
      try {
        lines.forEach((l) => term.writeln(l));
      } catch (_) {}
    };

    // Only check noSession; write with default shell color (no ANSI)
    if (!isConnected) {
      writeOnce('noSession', [
        "Couldn't open an interactive shell for this container.",
        'Press Cancel or click outside to close.',
      ]);
      return;
    }

    lastStatusRef.current = 'none';
  }, [isConnected]);

  if (!open) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-[55] bg-black/40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={() => {
          try {
            stopSession();
          } catch (_) {}
          onClose();
        }}
      />

      <div
        className={`fixed right-0 bottom-0 left-0 z-[60] overflow-hidden border-l border-white/10 bg-neutral-900/95 shadow-xl backdrop-blur-sm transition-transform duration-300 ${
          isResizing ? 'select-none' : ''
        }`}
        style={{ height: `${panelHeight}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute top-0 right-0 left-0 h-2 cursor-ns-resize bg-transparent hover:bg-white/10 active:bg-white/20"
          onMouseDown={onResize}
        />

        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-white/80">
            {title ?? 'Exec Terminal'}
          </div>

          <div className="flex items-center gap-2">
            <ButtonCancel
              onCancel={() => {
                try {
                  stopSession();
                } catch (_) {}
                onClose();
              }}
            />
            <ButtonExpand onExpand={toggleExpand} isExpanded={isExpanded} />
          </div>
        </div>

        <div className="h-[calc(100%-49px)] p-4">
          <div className="relative h-full overflow-hidden rounded-md border border-white/20 bg-black">
            <div
              ref={terminalContainerRef}
              onMouseDown={() => {
                try {
                  termRef.current?.focus();
                } catch (_) {}
              }}
              className="h-full w-full overflow-hidden font-mono text-sm text-white/80"
            />
          </div>
        </div>
      </div>
    </>
  );
}
