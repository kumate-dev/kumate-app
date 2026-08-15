/**
 * Read-only, syntax-highlighted YAML view of a Kubernetes object.
 *
 * Replaces the read-only half of `components/common/YamlEditor.tsx`. The React
 * version was a single component doing view, edit, validation and in-document search;
 * the two modes shared almost no state, so they are split here (see `YamlEditor.tsx`).
 */

import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { stringify } from 'yaml';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';
import { Check, Copy } from 'lucide-solid';
import { cn } from '@/lib/k8s';
import { getErrorMessage } from '@/utils/error';
import './yaml.css';

export interface YamlViewProps {
  object: unknown;
  class?: string;
}

/** How long the copy button stays in its confirmed state. */
const COPIED_RESET_MS = 1200;

const escapeHtml = (text: string): string =>
  text.replace(/[&<>]/g, (char) => (char === '&' ? '&amp;' : char === '<' ? '&lt;' : '&gt;'));

/**
 * Serialize any object to the YAML we show and edit.
 *
 * `lineWidth: 0` disables folding: without it `yaml` wraps long scalars — the
 * `kubectl.kubernetes.io/last-applied-configuration` annotation is the usual victim —
 * and the wrapped result no longer round-trips to the same line numbers we render in
 * the gutter, nor to text a user can paste back into `kubectl`.
 *
 * The trailing newline is stripped so the gutter does not show a phantom last line.
 */
export const toYaml = (object: unknown): string => {
  if (object === null || object === undefined) return '';
  if (typeof object === 'string') return object.replace(/\n+$/, '');

  try {
    return stringify(object, { indent: 2, lineWidth: 0 }).replace(/\n+$/, '');
  } catch (err) {
    // Cyclic or otherwise unserializable input must not take the pane down with it.
    return `# could not be serialized: ${getErrorMessage(err)}`;
  }
};

/** Prism HTML for a YAML document, falling back to escaped plain text. */
export const highlightYaml = (text: string): string => {
  const grammar = Prism.languages.yaml;
  if (!grammar) return escapeHtml(text);

  try {
    return Prism.highlight(text, grammar, 'yaml');
  } catch (err) {
    console.warn('prism highlighting failed', err);
    return escapeHtml(text);
  }
};

/** `1..n`, for the line-number gutter. */
export const lineNumbersFor = (text: string): number[] => {
  const total = Math.max(1, text.split('\n').length);
  return Array.from({ length: total }, (_, i) => i + 1);
};

export function YamlView(props: YamlViewProps) {
  const text = createMemo(() => toYaml(props.object));
  const lines = createMemo(() => lineNumbersFor(text()));

  let preEl!: HTMLPreElement;

  // Prism owns this subtree. It hands back an HTML string, so an effect writing
  // `innerHTML` is the correct shape — there is nothing here for Solid to render
  // fine-grained, and re-highlighting is keyed on the serialized text alone.
  createEffect(() => {
    preEl.innerHTML = highlightYaml(text());
  });

  const [copied, setCopied] = createSignal(false);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(copiedTimer));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text());
      setCopied(true);
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch (err) {
      console.warn('copy to clipboard failed', err);
    }
  };

  return (
    <div
      class={cn(
        'relative flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--surface-inset)]',
        props.class
      )}
    >
      <button
        type="button"
        onClick={() => void copy()}
        title="Copy YAML"
        aria-label="Copy YAML"
        class="text-2xs absolute top-1.5 right-3 z-10 flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-1 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
      >
        <Show when={copied()} fallback={<Copy class="h-3 w-3" />}>
          <Check class="h-3 w-3 text-[var(--status-ok)]" />
        </Show>
        <span>{copied() ? 'Copied' : 'Copy'}</span>
      </button>

      <div class="min-h-0 flex-1 overflow-auto">
        <div class="flex min-w-max font-mono text-xs leading-[1.5]">
          {/* Sticky so the gutter survives horizontal scrolling; inside the same
              scroll box as the code so vertical scrolling needs no syncing at all. */}
          <div class="tnum sticky left-0 z-[1] shrink-0 border-r border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2 py-2 text-right text-[var(--text-tertiary)] select-none">
            <For each={lines()}>{(line) => <div>{line}</div>}</For>
          </div>

          <pre ref={preEl} class="kumate-yaml selectable m-0 px-3 py-2 whitespace-pre" />
        </div>
      </div>
    </div>
  );
}

export default YamlView;
