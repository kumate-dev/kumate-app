/**
 * Editable YAML view, used to apply changes to a Kubernetes object.
 *
 * A transparent `<textarea>` sits on top of the highlighted `<pre>`. That is the whole
 * trick, and it is deliberate: CodeMirror and Monaco are 200 KB+ each and would
 * duplicate what prism plus a textarea already do here (see rule 8 in CLAUDE.md).
 * The cost of the trick is that the two layers must agree on font, line height and
 * padding to the pixel, and that the textarea's scroll position has to be mirrored
 * onto the highlight layer and the gutter.
 */

import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { parse } from 'yaml';
import { Save, Undo2 } from 'lucide-solid';
import { cn } from '@/lib/k8s';
import { getErrorMessage } from '@/utils/error';
import { highlightYaml, lineNumbersFor, toYaml } from './YamlView';
import './yaml.css';

export interface YamlEditorProps {
  object: unknown;
  onSave: (parsed: unknown) => Promise<void>;
  saving?: boolean;
  class?: string;
}

type ParseResult = { ok: true; value: unknown } | { ok: false; message: string };

/** Width of one indent step, inserted on Tab. YAML forbids literal tabs. */
const INDENT = '  ';

export function YamlEditor(props: YamlEditorProps) {
  /**
   * `null` means "not edited yet", in which case the text follows `props.object`.
   * Once the user types, their draft wins and a `MODIFIED` watch event on the object
   * no longer overwrites what they are in the middle of writing.
   */
  const [draft, setDraft] = createSignal<string | null>(null);
  const [saveError, setSaveError] = createSignal<string | null>(null);

  const baseline = createMemo(() => toYaml(props.object));
  const text = createMemo(() => draft() ?? baseline());
  const dirty = createMemo(() => text() !== baseline());
  const lines = createMemo(() => lineNumbersFor(text()));

  /**
   * Validation is a derivation, not an effect: the React version kept `isValid` and
   * `errorMessage` in state and pushed them from a `useEffect`, which meant the save
   * button could act on a stale verdict for one render.
   */
  const parsed = createMemo<ParseResult>(() => {
    const source = text();
    if (!source.trim()) return { ok: false, message: 'Document is empty.' };

    try {
      return { ok: true, value: parse(source) };
    } catch (err) {
      return { ok: false, message: getErrorMessage(err) };
    }
  });

  const canSave = createMemo(() => !props.saving && dirty() && parsed().ok);

  let preEl!: HTMLPreElement;
  let textareaEl!: HTMLTextAreaElement;
  let gutterEl!: HTMLDivElement;

  createEffect(() => {
    preEl.innerHTML = highlightYaml(text());
  });

  const syncScroll = () => {
    preEl.scrollTop = textareaEl.scrollTop;
    preEl.scrollLeft = textareaEl.scrollLeft;
    // The gutter is translated rather than scrolled so it never shows a scrollbar of
    // its own and never falls out of step by a sub-pixel.
    gutterEl.style.transform = `translateY(${-textareaEl.scrollTop}px)`;
  };

  const save = async () => {
    if (!canSave()) return;

    const result = parsed();
    // Belt and braces: the button is already gated on this, but nothing invalid may
    // reach the backend, and the ⌘S path can fire from anywhere.
    if (!result.ok) return;

    setSaveError(null);
    try {
      await props.onSave(result.value);
      // Follow the object again: the applied manifest comes back through the watch.
      setDraft(null);
    } catch (err) {
      setSaveError(getErrorMessage(err));
    }
  };

  const onWindowKeyDown = (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return;
    event.preventDefault();
    void save();
  };

  window.addEventListener('keydown', onWindowKeyDown);
  onCleanup(() => window.removeEventListener('keydown', onWindowKeyDown));

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();

    const start = textareaEl.selectionStart;
    const end = textareaEl.selectionEnd;
    const source = text();
    setDraft(source.slice(0, start) + INDENT + source.slice(end));

    // Solid flushes the DOM synchronously at the end of this handler, so the caret is
    // restored one microtask later — by then the textarea holds the new value.
    queueMicrotask(() => {
      textareaEl.selectionStart = start + INDENT.length;
      textareaEl.selectionEnd = start + INDENT.length;
    });
  };

  const errorMessage = createMemo(() => {
    const result = parsed();
    if (!result.ok && dirty()) return result.message;
    return saveError();
  });

  return (
    <div class={cn('flex h-full min-h-0 w-full flex-col gap-2', props.class)}>
      <div class="flex items-center gap-2">
        <span class="tnum text-2xs text-[var(--text-tertiary)]">
          {lines().length} lines
          <Show when={dirty()}> · modified</Show>
        </span>

        <div class="flex-1" />

        <button
          type="button"
          onClick={() => setDraft(null)}
          disabled={!dirty() || props.saving}
          title="Discard local changes"
          class="text-2xs flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
        >
          <Undo2 class="h-3 w-3" />
          Revert
        </button>

        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave()}
          title="Save (⌘S)"
          class="text-2xs flex items-center gap-1 rounded-md border border-[var(--accent-border)] bg-[var(--accent-subtle)] px-2 py-1 text-[var(--accent)] hover:bg-[var(--surface-hover)] disabled:pointer-events-none disabled:opacity-40"
        >
          <Save class="h-3 w-3" />
          {props.saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div
        class={cn(
          'relative min-h-0 flex-1 overflow-hidden rounded-md border bg-[var(--surface-inset)]',
          errorMessage() ? 'border-[var(--status-danger)]' : 'border-[var(--border-subtle)]'
        )}
      >
        <div class="absolute inset-y-0 left-0 z-[1] w-12 overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--surface-inset)]">
          <div
            ref={gutterEl}
            class="tnum px-2 py-2 text-right font-mono text-xs leading-[1.5] text-[var(--text-tertiary)] will-change-transform select-none"
          >
            <For each={lines()}>{(line) => <div>{line}</div>}</For>
          </div>
        </div>

        {/* Highlight layer. `overflow-hidden` rather than `auto`: it is scrolled
            programmatically from the textarea and must never show its own scrollbar. */}
        <pre
          ref={preEl}
          aria-hidden="true"
          class="kumate-yaml pointer-events-none absolute inset-0 m-0 overflow-hidden py-2 pr-3 pl-14 font-mono text-xs leading-[1.5] whitespace-pre"
        />

        <textarea
          ref={textareaEl}
          value={text()}
          onInput={(event) => setDraft(event.currentTarget.value)}
          onScroll={syncScroll}
          onKeyDown={onKeyDown}
          spellcheck={false}
          class="absolute inset-0 h-full w-full resize-none overflow-auto border-0 bg-transparent py-2 pr-3 pl-14 font-mono text-xs leading-[1.5] whitespace-pre text-transparent caret-[var(--text-primary)] outline-none"
        />
      </div>

      <Show when={errorMessage()}>
        {(message) => (
          <div class="selectable text-2xs rounded-md border border-[var(--status-danger)] bg-[var(--status-danger-subtle)] px-2 py-1 text-[var(--status-danger)]">
            {message()}
          </div>
        )}
      </Show>
    </div>
  );
}

export default YamlEditor;
