/**
 * Interactive `exec` terminal for a pod container.
 *
 * `@xterm/xterm` is driven imperatively against a ref, so the port is mostly deletion:
 * `components/common/BottomExecTerminal.tsx` needed three effects and four refs to
 * open, re-open and dispose the terminal in step with React's lifecycle, plus a latch
 * to stop the auto-connect effect from firing repeatedly. Here the terminal is created
 * in `onMount` and disposed in `onCleanup`, and that is the whole lifecycle.
 *
 * The bug that latch existed to paper over is deliberately not ported: the React hook
 * defaulted `command` to `['sh']` in its parameter list and then listed it in a
 * dependency array, so its identity changed on every render and the connect effect
 * re-ran continuously. `command` is a prop here and the session starts exactly once.
 */

import { Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { Terminal as XTerm, type ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { RotateCw } from 'lucide-solid';
import {
  sendExecInput,
  startExecPodSession,
  stopExecPodSession,
  type ExecEvent,
} from '@/api/k8s/pods';
import { resolvedTheme } from '@/stores/theme';
import { cn } from '@/lib/k8s';
import { getErrorMessage } from '@/utils/error';
import '@xterm/xterm/css/xterm.css';

export interface TerminalProps {
  context: string;
  namespace: string;
  pod: string;
  container?: string;
  /** Defaults to `sh`. Read once, when the session starts. */
  command?: string[];
  class?: string;
}

const DEFAULT_COMMAND = ['sh'];

const SCROLLBACK_LINES = 5000;

type SessionStatus = 'connecting' | 'connected' | 'closed' | 'error';

/**
 * `#rrggbb` for a computed CSS colour, or `null` if it is not in `rgb()` form.
 *
 * xterm parses hex reliably; the palette tokens are authored as `hsl(...)`, and a
 * custom property is *not* resolved to a colour by `getComputedStyle` — it comes back
 * as the raw token stream. Hence the probe element below: assigning the variable to a
 * real `color` property forces the browser to resolve it, and it always reports
 * resolved colours as `rgb()`/`rgba()`.
 */
const rgbToHex = (value: string): string | null => {
  if (!value.startsWith('rgb')) return null;
  const parts = value.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return null;

  const channel = (part: string): string => {
    const byte = Math.max(0, Math.min(255, Math.round(Number(part))));
    return byte.toString(16).padStart(2, '0');
  };

  return `#${parts.slice(0, 3).map(channel).join('')}`;
};

/**
 * Build the xterm palette from the design tokens.
 *
 * There is no separate bright ramp in the token set, so the bright slots reuse the
 * same hues. That is preferable to reintroducing the hardcoded palette the React
 * component carried, which was legible in dark mode only.
 */
const readTerminalTheme = (host: HTMLElement): ITheme => {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  host.appendChild(probe);

  const read = (variable: string, fallback: string): string => {
    probe.style.color = '';
    probe.style.color = `var(${variable})`;
    return rgbToHex(getComputedStyle(probe).color) ?? fallback;
  };

  const background = read('--surface-inset', '#0b0f16');
  const foreground = read('--text-primary', '#f1f5f9');
  const danger = read('--status-danger', '#ef4444');
  const ok = read('--status-ok', '#10b981');
  const warn = read('--status-warn', '#f59e0b');
  const accent = read('--accent', '#3b82f6');
  const boolean = read('--code-boolean', '#a78bfa');
  const key = read('--code-key', '#38bdf8');
  const dim = read('--text-tertiary', '#64748b');

  const theme: ITheme = {
    background,
    foreground,
    cursor: accent,
    cursorAccent: background,
    selectionBackground: read('--surface-active', '#334155'),
    black: read('--surface-base', '#000000'),
    red: danger,
    green: ok,
    yellow: warn,
    blue: accent,
    magenta: boolean,
    cyan: key,
    white: foreground,
    brightBlack: dim,
    brightRed: danger,
    brightGreen: ok,
    brightYellow: warn,
    brightBlue: read('--accent-hover', '#60a5fa'),
    brightMagenta: boolean,
    brightCyan: key,
    brightWhite: foreground,
  };

  probe.remove();
  return theme;
};

export function Terminal(props: TerminalProps) {
  let hostEl!: HTMLDivElement;
  let term: XTerm | undefined;
  let fit: FitAddon | undefined;
  let unlisten: UnlistenFn | null = null;
  let sessionId: string | null = null;
  let disposed = false;

  const [status, setStatus] = createSignal<SessionStatus>('connecting');
  const [error, setError] = createSignal<string | null>(null);

  // `fit()` throws when the host has no layout — it can be inside a collapsed pane
  // while a transition runs. A failed fit is never worth taking the pane down for.
  const safeFit = () => {
    try {
      fit?.fit();
    } catch {
      /* not laid out yet */
    }
  };

  const handleEvent = (event: ExecEvent) => {
    const instance = term;
    if (disposed || !instance) return;

    switch (event.type) {
      case 'EXEC_STDOUT':
      case 'EXEC_STDERR':
        if (event.data) instance.write(event.data);
        break;
      case 'EXEC_ERROR':
        setError(event.error ?? 'Exec session failed');
        setStatus('error');
        break;
      case 'EXEC_COMPLETED':
        setStatus('closed');
        instance.writeln('\r\n\x1b[2m[session closed]\x1b[0m');
        break;
    }
  };

  const sendInput = async (data: string) => {
    const id = sessionId;
    if (!id) return;

    try {
      await sendExecInput({ sessionId: id, input: data, appendNewline: false });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const stopSession = async (id: string) => {
    try {
      await stopExecPodSession({ sessionId: id });
    } catch (err) {
      // The session is usually already gone (the container exited); nothing to do.
      console.warn('failed to stop exec session', err);
    }
  };

  const teardown = () => {
    unlisten?.();
    unlisten = null;

    const id = sessionId;
    sessionId = null;
    if (id) void stopSession(id);
  };

  const connect = async () => {
    setError(null);
    setStatus('connecting');

    try {
      const started = await startExecPodSession({
        context: props.context,
        namespace: props.namespace,
        podName: props.pod,
        containerName: props.container,
        command: props.command ?? DEFAULT_COMMAND,
        tty: true,
        onEvent: handleEvent,
      });

      // The component can be disposed while the attach is in flight; the session is
      // live on the backend by then and has to be stopped explicitly.
      if (disposed) {
        started.unlisten();
        void stopSession(started.sessionId);
        return;
      }

      unlisten = started.unlisten;
      sessionId = started.sessionId;
      setStatus('connected');
      term?.focus();
    } catch (err) {
      if (disposed) return;
      setError(getErrorMessage(err));
      setStatus('error');
    }
  };

  const reconnect = () => {
    teardown();
    term?.reset();
    void connect();
  };

  onMount(() => {
    const instance = new XTerm({
      convertEol: true,
      cursorBlink: true,
      scrollOnUserInput: true,
      scrollback: SCROLLBACK_LINES,
      fontSize: 12,
      lineHeight: 1.2,
      fontFamily: getComputedStyle(hostEl).fontFamily,
      theme: readTerminalTheme(hostEl),
    });

    const fitAddon = new FitAddon();
    instance.loadAddon(fitAddon);
    instance.open(hostEl);

    term = instance;
    fit = fitAddon;
    safeFit();

    // Disposed together with the terminal; no separate handle to keep.
    instance.onData((data) => void sendInput(data));

    const observer = new ResizeObserver(() => safeFit());
    observer.observe(hostEl);

    // KNOWN ISSUE: the remote TTY keeps the size it was attached with — there is no
    // resize command on the exec session yet, so a full-screen program in the
    // container will not reflow. Fix: add a `resize_exec` command that forwards
    // `instance.cols`/`instance.rows` and call it from this observer.
    onCleanup(() => observer.disconnect());

    void connect();
  });

  // Re-theme in place rather than recreating the terminal. Declared after `onMount`
  // so the terminal exists by the time this first runs.
  createEffect(() => {
    resolvedTheme();
    if (term) term.options.theme = readTerminalTheme(hostEl);
  });

  onCleanup(() => {
    disposed = true;
    teardown();
    term?.dispose();
    term = undefined;
  });

  const statusLabel = () => {
    switch (status()) {
      case 'connecting':
        return 'Connecting…';
      case 'connected':
        return props.container ? `Connected · ${props.container}` : 'Connected';
      case 'closed':
        return 'Session closed';
      case 'error':
        return 'Session failed';
    }
  };

  const statusColour = () =>
    status() === 'connected'
      ? 'text-[var(--status-ok)]'
      : status() === 'error'
        ? 'text-[var(--status-danger)]'
        : 'text-[var(--text-tertiary)]';

  return (
    <div class={cn('flex h-full min-h-0 w-full flex-col gap-2', props.class)}>
      <div class="flex items-center gap-2">
        <span class={cn('text-2xs', statusColour())}>{statusLabel()}</span>

        <div class="flex-1" />

        <Show when={status() === 'closed' || status() === 'error'}>
          <button
            type="button"
            onClick={reconnect}
            title="Start a new session"
            class="text-2xs flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            <RotateCw class="h-3 w-3" />
            Reconnect
          </button>
        </Show>
      </div>

      <div class="relative min-h-0 flex-1 overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-1">
        <div ref={hostEl} class="h-full w-full font-mono" />
      </div>

      <Show when={error()}>
        {(message) => (
          <div class="selectable text-2xs rounded-md border border-[var(--status-danger)] bg-[var(--status-danger-subtle)] px-2 py-1 text-[var(--status-danger)]">
            {message()}
          </div>
        )}
      </Show>
    </div>
  );
}

export default Terminal;
