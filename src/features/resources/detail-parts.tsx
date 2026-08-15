/**
 * The presentational vocabulary of the resource detail panel.
 *
 * Every descriptor's `detail` sections are built out of these parts, and so will the
 * kinds still to be ported. That is the point: the React code drew the same
 * label/value table by hand in 39 `Sidebar*.tsx` files, each with its own `<colgroup>`,
 * its own idea of what an empty value looks like, and its own copy-to-clipboard bug.
 *
 * Three rules hold everywhere here:
 *
 * 1. **Values are selectable, labels are not.** `user-select: none` is global in this
 *    app (see `index.css`); a detail panel exists to be copied out of, so every value
 *    opts back in with `.selectable`.
 * 2. **Nothing is ever blank.** A missing value renders an em dash, so "the field is
 *    empty" and "the row did not render" cannot be confused.
 * 3. **Credential material is opt-in.** `KeyValueTable` never materialises a masked
 *    value until the user reveals it — see the note on `KeyValueEntry.value` — and
 *    refuses to edit one that has not been revealed.
 */

import {
  For,
  Show,
  children,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type JSX,
} from 'solid-js';
import { Check, Copy, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-solid';

import { cn, formatAge, type K8sObject } from '@/lib/k8s';
import { useClock } from '@/stores/clock';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/Dialog';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { Kbd } from '@/ui/Kbd';
import { toast } from '@/ui/Toast';
import { Tooltip } from '@/ui/Tooltip';
import { getErrorMessage } from '@/utils/error';

/* -------------------------------------------------------------------------- */
/* Age                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Sort/search value for an age column.
 *
 * Deliberately the raw creation time, not a computed age: it is called per row per
 * sort, and it must not allocate. Ascending therefore means oldest first, which is
 * what `kubectl --sort-by=.metadata.creationTimestamp` does.
 */
export const ageValue = (item: K8sObject): number => {
  const timestamp = item.metadata?.creationTimestamp;
  if (!timestamp) return 0;
  return typeof timestamp === 'string' ? Date.parse(timestamp) : timestamp.getTime();
};

export interface AgeCellProps {
  timestamp?: Date | string;
  class?: string;
}

/**
 * Relative age, driven by the one shared clock.
 *
 * Used by table cells *and* by detail rows. There is no timer here and there must
 * never be one: `stores/clock.ts` explains what a per-row interval cost the React
 * implementation.
 */
export function AgeCell(props: AgeCellProps) {
  const now = useClock();
  return <span class={cn('tnum', props.class)}>{formatAge(props.timestamp, now())}</span>;
}

/* -------------------------------------------------------------------------- */
/* Access modes                                                               */
/* -------------------------------------------------------------------------- */

/** `kubectl`'s abbreviations for `spec.accessModes`. */
const ACCESS_MODE_SHORT: Record<string, string> = {
  ReadWriteOnce: 'RWO',
  ReadOnlyMany: 'ROX',
  ReadWriteMany: 'RWX',
  ReadWriteOncePod: 'RWOP',
};

/** Unknown modes pass through: a mode added by a future API must be visible, not eaten. */
export const accessModeShort = (mode: string): string => ACCESS_MODE_SHORT[mode] ?? mode;

/**
 * Sort/search value for an access-modes column.
 *
 * Cheap enough for a column accessor: the array is at most four entries long, and the
 * alternative — sorting on the long names — puts `ReadOnlyMany` before `ReadWriteOnce`
 * for no reason a reader could infer from the cell.
 */
export const accessModesValue = (modes?: readonly string[]): string =>
  modes === undefined ? '' : modes.map(accessModeShort).join(',');

export interface AccessModesProps {
  modes?: readonly string[];
}

/**
 * Short access-mode forms, with the long names on hover.
 *
 * The long names are 13–16 characters and a volume may declare three of them; that is
 * 45 characters in a column with room for about twelve, which is why `kubectl get pv`
 * abbreviates too. `RWOP` is not self-explanatory the first time it is seen, hence the
 * tooltip — **one** for the whole cell rather than one per mode, because this renders
 * for every visible row and a Kobalte tooltip root per chip would be three per row for
 * information that reads better as a single list.
 */
export function AccessModes(props: AccessModesProps) {
  const modes = createMemo(() => props.modes ?? []);

  return (
    <Show when={modes().length > 0} fallback={<span class="text-[var(--text-tertiary)]">—</span>}>
      <Tooltip
        content={
          <div class="flex flex-col">
            <For each={modes()}>{(mode) => <span>{mode}</span>}</For>
          </div>
        }
      >
        <span class="truncate">
          <For each={modes()}>
            {(mode, index) => (
              <>
                <Show when={index() > 0}>
                  <span class="text-[var(--text-tertiary)]">, </span>
                </Show>
                {accessModeShort(mode)}
              </>
            )}
          </For>
        </span>
      </Tooltip>
    </Show>
  );
}

/* -------------------------------------------------------------------------- */
/* Grid                                                                       */
/* -------------------------------------------------------------------------- */

export interface DetailGridProps {
  class?: string;
  children?: JSX.Element;
}

/**
 * Two-column label/value list.
 *
 * A CSS grid on the *list*, not a table, so every row in a section shares one label
 * column width without the caller measuring anything — and so a long value wraps
 * under itself instead of widening the label column of every sibling row.
 */
export function DetailGrid(props: DetailGridProps) {
  return (
    <dl
      class={cn(
        'grid grid-cols-[minmax(72px,132px)_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1',
        props.class
      )}
    >
      {props.children}
    </dl>
  );
}

export interface DetailRowProps {
  label: string;
  /** Omitted, empty or nullish renders an em dash. */
  children?: JSX.Element;
  class?: string;
}

export function DetailRow(props: DetailRowProps) {
  // Memoised: reading a JSX-valued prop twice — once to test it, once to render it —
  // builds the node twice and throws one away.
  const value = children(() => props.children);

  const present = () => {
    const resolved = value();
    return resolved !== null && resolved !== undefined && resolved !== '' && resolved !== false;
  };

  return (
    <>
      <dt class="text-2xs truncate text-right text-[var(--text-tertiary)]" title={props.label}>
        {props.label}
      </dt>
      <dd class={cn('selectable min-w-0 break-words text-[var(--text-primary)]', props.class)}>
        <Show when={present()} fallback={<span class="text-[var(--text-tertiary)]">—</span>}>
          {value()}
        </Show>
      </dd>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Labels / annotations                                                       */
/* -------------------------------------------------------------------------- */

/** Chips shown before the "+N more" fold. Annotations routinely run to dozens. */
const LABEL_FOLD = 8;

const copyToClipboard = async (text: string, what: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${what}`);
  } catch (err) {
    // Never surface the value itself, here or in the log: this is also the path a
    // Secret key takes.
    console.warn('copy to clipboard failed', err);
    toast.error('Could not copy to the clipboard');
  }
};

export interface LabelListProps {
  /** `metadata.labels` or `metadata.annotations`. */
  entries?: Record<string, string>;
  /** Shown when there is nothing to list. */
  empty?: string;
  /** Chips shown before folding. Defaults to 8. */
  fold?: number;
}

/**
 * `key=value` chips, one per label, copied on click.
 *
 * Folded past `fold` entries because annotations are unbounded — a Deployment applied
 * with `kubectl apply` carries `last-applied-configuration`, which is the whole
 * manifest, and rendering it inline pushes every other section off the screen. The
 * chip truncates rather than wraps for the same reason; the full text is on hover and
 * one click away in the clipboard.
 */
export function LabelList(props: LabelListProps) {
  const [expanded, setExpanded] = createSignal(false);

  // Mapped to objects rather than left as `[key, value]` tuples so the `<For>` callback
  // below does not destructure — `eslint-plugin-solid` flags destructuring in a render
  // callback, and the rule is right often enough not to argue with.
  const all = createMemo(() =>
    Object.entries(props.entries ?? {}).map(([key, value]) => ({ key, value }))
  );

  const fold = () => props.fold ?? LABEL_FOLD;
  const visible = createMemo(() => (expanded() ? all() : all().slice(0, fold())));
  const hidden = () => all().length - visible().length;

  return (
    <Show
      when={all().length > 0}
      fallback={<span class="text-2xs text-[var(--text-tertiary)]">{props.empty ?? 'None'}</span>}
    >
      <div class="flex flex-wrap gap-1">
        <For each={visible()}>
          {(entry) => (
            <Tooltip content={`${entry.key}=${entry.value}`}>
              <button
                type="button"
                onClick={() => void copyToClipboard(`${entry.key}=${entry.value}`, entry.key)}
                class={cn(
                  'text-2xs flex max-w-full items-center gap-1 rounded-xs px-1.5 py-0.5',
                  'bg-[var(--surface-inset)] text-[var(--text-secondary)] transition-colors',
                  'hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                )}
              >
                <span class="shrink-0 font-medium text-[var(--code-key)]">{entry.key}</span>
                <span class="truncate">{entry.value}</span>
              </button>
            </Tooltip>
          )}
        </For>

        <Show when={hidden() > 0}>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            class="text-2xs rounded-xs px-1.5 py-0.5 text-[var(--accent)] hover:bg-[var(--surface-hover)]"
          >
            +{hidden()} more
          </button>
        </Show>
      </div>
    </Show>
  );
}

/* -------------------------------------------------------------------------- */
/* Key/value table                                                            */
/* -------------------------------------------------------------------------- */

export interface KeyValueEntry {
  key: string;
  /**
   * A **thunk**, not a value.
   *
   * It is called only when the row is actually displayed — which for `secret: true`
   * means after an explicit reveal, when the copy button is pressed, and when the
   * editor for that one row is opened. That is what keeps decoded credential material
   * out of the DOM and out of memory until someone asks for it: a screenshot of a
   * Secret shows dots, not the token.
   */
  value?: () => string | undefined;
  /** Provenance or size, shown greyed after the value. */
  hint?: string;
  /** Masks the value behind a reveal toggle. Credential material only. */
  secret?: boolean;
  /**
   * Whether the payload is bytes rather than text — a **thunk** for the same reason
   * `value` is one: answering it means decoding, and a Secret must not be decoded
   * before it is revealed.
   *
   * Binary entries are read-only. Round-tripping arbitrary bytes through a `<textarea>`
   * re-encodes them as UTF-8 and silently corrupts the payload, which for a keystore or
   * a `.jar` is indistinguishable from data loss. They can still be deleted, and still
   * edited in the YAML tab where they stay base64.
   */
  binary?: () => boolean;
}

/**
 * The write half of `KeyValueTable`, supplied by the descriptor that owns the object.
 *
 * Each callback is one JSON merge patch — see `ResourceApi.patch`. None of them may
 * mutate local state on success: the watch delivers the `MODIFIED` event and
 * `createResourceList` reconciles the row in place, so an optimistic write would only
 * be a second, less correct source of truth.
 */
export interface KeyValueEditing {
  /** Replace one key's value. Rejects to keep the editor open with the draft intact. */
  onSave: (key: string, value: string) => Promise<void>;
  /** Omit to hide the delete affordance. Always guarded by a confirmation. */
  onDelete?: (key: string) => Promise<void>;
  /** Omit to hide the "Add key" affordance. */
  onAdd?: (key: string, value: string) => Promise<void>;
  /** Names the object in the delete confirmation, e.g. `ConfigMap app-config`. */
  subject?: string;
}

export interface KeyValueTableProps {
  entries: readonly KeyValueEntry[];
  empty?: string;
  /** Adds a per-row copy button. */
  copyable?: boolean;
  /**
   * Makes the rows writable. Omit it — or pass `undefined` for an immutable object —
   * and this is exactly the read-only table it has always been.
   */
  editing?: KeyValueEditing;
}

const MASK = '••••••••••••';

/**
 * The apiserver's rule for a ConfigMap/Secret key (`validation.IsConfigMapKey`):
 * `[-._a-zA-Z0-9]+`, at most 253 characters, and neither `.` nor `..` — both of which
 * would be a path traversal once the key is projected into a volume. Checked here so a
 * typo is a message under the field rather than a 422 from the cluster.
 */
const KEY_PATTERN = /^[-._a-zA-Z0-9]+$/;
const KEY_MAX_LENGTH = 253;

const validateKey = (key: string, existing: readonly KeyValueEntry[]): string | undefined => {
  if (key.length === 0) return 'A key is required.';
  if (key.length > KEY_MAX_LENGTH) return `A key may be at most ${KEY_MAX_LENGTH} characters.`;
  if (key === '.' || key === '..') return '"." and ".." are not valid keys.';
  if (!KEY_PATTERN.test(key)) return 'Use only letters, digits, "-", "_" and ".".';
  if (existing.some((entry) => entry.key === key)) return 'This key already exists.';
  return undefined;
};

/**
 * Key/value rows, with per-key reveal for anything marked `secret` and, when `editing`
 * is supplied, per-key editing.
 *
 * Reveal state is keyed by entry key and reset whenever the set of keys changes, so
 * selecting a different object cannot inherit the previous one's revealed rows.
 * `ResourceDetail` also remounts the Overview panel per object, which covers the case
 * where two objects happen to share a key set (two `kubernetes.io/tls` Secrets both
 * have exactly `tls.crt` and `tls.key`) — belt and braces, on purpose.
 *
 * ## Editing
 *
 * One row at a time, and the draft is seeded by calling that row's `value` thunk at the
 * moment the editor opens — never before. A `secret` row must be revealed first: an
 * edit affordance on a masked value invites overwriting something nobody has read.
 */
export function KeyValueTable(props: KeyValueTableProps) {
  const [revealed, setRevealed] = createSignal<ReadonlySet<string>>(new Set());
  /** Key of the row whose editor is open, or `null`. */
  const [editingKey, setEditingKey] = createSignal<string | null>(null);
  const [adding, setAdding] = createSignal(false);
  /** Buffer for whichever editor is open. Only one can be, so one buffer is enough. */
  const [draft, setDraft] = createSignal('');
  const [newKey, setNewKey] = createSignal('');
  const [keyError, setKeyError] = createSignal<string | undefined>();
  const [pending, setPending] = createSignal(false);
  const [confirming, setConfirming] = createSignal<string | null>(null);

  const signature = createMemo(() => props.entries.map((entry) => entry.key).join('\u0000'));

  createEffect(() => {
    signature();
    setRevealed(new Set<string>());
    // An open editor cannot survive the key set changing under it: the row it belongs
    // to may have just been deleted, and its draft was seeded from a value that was
    // current for a different version of the object.
    setEditingKey(null);
    setDraft('');
  });

  const toggle = (key: string) => {
    setRevealed((previous) => {
      const next = new Set<string>(previous);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  };

  const shown = (entry: KeyValueEntry) => !entry.secret || revealed().has(entry.key);
  const isEditing = (key: string) => editingKey() === key;

  /** Why this row cannot be edited as text, or `undefined` when it can. */
  const editBlockedBy = (entry: KeyValueEntry): string | undefined => {
    if (!shown(entry)) return 'Reveal this value before editing it.';
    // Only reached for a shown row, so answering this never decodes a masked Secret.
    if (entry.binary?.()) return 'Binary value — edit it in the YAML tab.';
    return undefined;
  };

  /**
   * Run one write.
   *
   * The failure path deliberately leaves the editor open with the draft intact — a
   * patch rejected by an admission webhook is exactly where losing what was typed
   * hurts most. The message is the apiserver's; the value is never part of it.
   */
  const submit = (write: () => Promise<void>, done: () => void) => {
    if (pending()) return;
    setPending(true);
    void write()
      .then(done)
      .catch((err: unknown) => toast.error(getErrorMessage(err)))
      .finally(() => setPending(false));
  };

  const openEditor = (entry: KeyValueEntry) => {
    setAdding(false);
    setKeyError(undefined);
    setEditingKey(entry.key);
    // The thunk is pulled exactly here: for a Secret this is the first moment the
    // plaintext exists, and it exists because the user asked to edit this one key.
    setDraft(entry.value?.() ?? '');
  };

  const closeEditor = () => {
    setEditingKey(null);
    setDraft('');
  };

  const saveEntry = (key: string) => {
    const editing = props.editing;
    if (!editing) return;
    // Read out of the signal here rather than inside the closure: what is sent is what
    // was in the box when Save was pressed, not whatever it holds when the patch runs.
    const value = draft();
    submit(() => editing.onSave(key, value), closeEditor);
  };

  const openAdd = () => {
    setEditingKey(null);
    setNewKey('');
    setKeyError(undefined);
    setDraft('');
    setAdding(true);
  };

  const closeAdd = () => {
    setAdding(false);
    setNewKey('');
    setKeyError(undefined);
    setDraft('');
  };

  const addEntry = () => {
    const add = props.editing?.onAdd;
    if (!add) return;

    const key = newKey().trim();
    const invalid = validateKey(key, props.entries);
    setKeyError(invalid);
    if (invalid) return;

    const value = draft();
    submit(() => add(key, value), closeAdd);
  };

  /** Rejects on failure so `ConfirmDialog` stays open and reports it. */
  const deleteEntry = async () => {
    const remove = props.editing?.onDelete;
    const key = confirming();
    if (!remove || key === null) return;

    await remove(key);
    if (isEditing(key)) closeEditor();
  };

  return (
    <div class="flex flex-col gap-1.5">
      <Show
        when={props.entries.length > 0}
        fallback={<span class="text-2xs text-[var(--text-tertiary)]">{props.empty ?? 'None'}</span>}
      >
        <div class="flex flex-col divide-y divide-[var(--border-subtle)]">
          <For each={props.entries}>
            {(entry) => (
              <div class="flex flex-col gap-1 py-1">
                <div class="grid grid-cols-[minmax(80px,180px)_minmax(0,1fr)_auto] items-start gap-2">
                  <span
                    class="selectable text-2xs truncate font-mono text-[var(--code-key)]"
                    title={entry.key}
                  >
                    {entry.key}
                  </span>

                  <div class="min-w-0">
                    {/* The value is not repeated above an open editor: two copies of the
                        same text, one of them stale, is how the wrong one gets edited. */}
                    <Show when={!isEditing(entry.key)}>
                      <Show
                        when={shown(entry)}
                        fallback={
                          <span class="text-2xs font-mono tracking-widest text-[var(--text-tertiary)]">
                            {MASK}
                          </span>
                        }
                      >
                        <span class="selectable text-2xs block font-mono break-all whitespace-pre-wrap text-[var(--text-primary)]">
                          {entry.value?.() ?? '—'}
                        </span>
                      </Show>
                    </Show>

                    <Show when={entry.hint}>
                      <span class="text-2xs block truncate text-[var(--text-tertiary)]">
                        {entry.hint}
                      </span>
                    </Show>

                    <Show when={props.editing && shown(entry) && entry.binary?.()}>
                      <span class="text-2xs block text-[var(--text-tertiary)] italic">
                        Binary value — edit it in the YAML tab.
                      </span>
                    </Show>
                  </div>

                  {/* Row actions step aside while this row is being edited: Save and
                      Cancel are the only two answers the editor accepts. */}
                  <Show when={!isEditing(entry.key)}>
                    <div class="flex items-center gap-0.5">
                      <Show when={entry.secret}>
                        <button
                          type="button"
                          onClick={() => toggle(entry.key)}
                          aria-label={shown(entry) ? `Hide ${entry.key}` : `Reveal ${entry.key}`}
                          aria-pressed={shown(entry)}
                          class="rounded-xs p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                        >
                          <Show when={shown(entry)} fallback={<Eye size={13} />}>
                            <EyeOff size={13} />
                          </Show>
                        </button>
                      </Show>

                      <Show when={props.copyable}>
                        <CopyButton
                          label={entry.key}
                          text={() => entry.value?.() ?? ''}
                          disabled={entry.value === undefined}
                        />
                      </Show>

                      <Show when={props.editing}>
                        {(editing) => (
                          <>
                            <Show
                              when={editBlockedBy(entry)}
                              fallback={
                                <IconButton
                                  icon={Pencil}
                                  label={`Edit ${entry.key}`}
                                  size="sm"
                                  tooltip={false}
                                  disabled={pending()}
                                  onClick={() => openEditor(entry)}
                                />
                              }
                            >
                              {/* A disabled control with no explanation reads as a bug.
                                  `Button` keeps pointer events on precisely so a tooltip
                                  can still open over it. */}
                              {(reason) => (
                                <Tooltip content={reason()}>
                                  <IconButton
                                    icon={Pencil}
                                    label={`Edit ${entry.key}`}
                                    size="sm"
                                    tooltip={false}
                                    disabled
                                  />
                                </Tooltip>
                              )}
                            </Show>

                            <Show when={editing().onDelete}>
                              <IconButton
                                icon={Trash2}
                                label={`Delete ${entry.key}`}
                                size="sm"
                                tooltip={false}
                                disabled={pending()}
                                onClick={() => setConfirming(entry.key)}
                              />
                            </Show>
                          </>
                        )}
                      </Show>
                    </div>
                  </Show>
                </div>

                <Show when={isEditing(entry.key)}>
                  <ValueEditor
                    value={draft()}
                    onInput={setDraft}
                    pending={pending()}
                    ariaLabel={`Value of ${entry.key}`}
                    onSubmit={() => saveEntry(entry.key)}
                    onCancel={closeEditor}
                  />
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.editing?.onAdd}>
        <Show
          when={adding()}
          fallback={
            <div>
              <Button size="sm" variant="subtle" icon={Plus} onClick={openAdd}>
                Add key
              </Button>
            </div>
          }
        >
          <ValueEditor
            value={draft()}
            onInput={setDraft}
            pending={pending()}
            ariaLabel="Value of the new key"
            saveLabel="Add"
            onSubmit={addEntry}
            onCancel={closeAdd}
            header={
              <div class="flex flex-col gap-1">
                <Input
                  value={newKey()}
                  onInput={(event) => {
                    setNewKey(event.currentTarget.value);
                    // Cleared on every keystroke: a message about the previous attempt
                    // sitting under a field being retyped is just noise.
                    setKeyError(undefined);
                  }}
                  invalid={keyError() !== undefined}
                  disabled={pending()}
                  spellcheck={false}
                  autocomplete="off"
                  aria-label="New key"
                  placeholder="key"
                  class="text-2xs font-mono"
                />
                <Show when={keyError()}>
                  {(message) => (
                    <span class="text-2xs text-[var(--status-danger)]">{message()}</span>
                  )}
                </Show>
              </div>
            }
          />
        </Show>
      </Show>

      <Show when={confirming()}>
        {(key) => (
          <ConfirmDialog
            open
            onOpenChange={() => setConfirming(null)}
            variant="danger"
            title={`Delete key ${key()}?`}
            description={`It is removed from ${props.editing?.subject ?? 'the object'} immediately, and anything mounting that key sees it disappear.`}
            confirmLabel="Delete key"
            onConfirm={deleteEntry}
          />
        )}
      </Show>
    </div>
  );
}

interface ValueEditorProps {
  value: string;
  onInput: (value: string) => void;
  /** Disables every control and spins the save button while a patch is in flight. */
  pending: boolean;
  /** Accessible name for the textarea; the key is not repeated on the field itself. */
  ariaLabel: string;
  saveLabel?: string;
  /** Rendered above the textarea. The add form puts its key field here. */
  header?: JSX.Element;
  onSubmit: () => void;
  onCancel: () => void;
}

/**
 * The one editor, used both for an existing row and for the add form.
 *
 * A `<textarea>` rather than an `Input` because these values are files — an
 * `nginx.conf`, a JSON blob, a PEM chain — and a single-line field turns a 200-line
 * config into a horizontal scrollbar. It grows to fit its content up to `max-h-64` and
 * scrolls past that, so a large value cannot push the rest of the panel off screen.
 *
 * The key handler sits on the wrapper, not the textarea, so the add form's key field is
 * covered by the same two shortcuts.
 */
function ValueEditor(props: ValueEditorProps) {
  let wrapper: HTMLDivElement | undefined;
  let field: HTMLTextAreaElement | undefined;

  const grow = () => {
    if (!field) return;
    // Collapse first: without it the box can only ever get taller, never shorter.
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight}px`;
  };

  onMount(() => {
    // After insertion rather than in the ref callback: `scrollHeight` is 0 for an
    // element that is not in the document yet.
    grow();
    // Whichever field comes first in the DOM — the add form's key input when there is
    // one, the value otherwise. Asking the DOM avoids reading `props.header` to decide,
    // which would instantiate that JSX a second time.
    wrapper?.querySelector<HTMLElement>('input, textarea')?.focus();
  });

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      // Swallowed: the drawer this panel lives in also closes on Escape, and losing the
      // whole panel when you meant to abandon one edit is the worse outcome.
      event.preventDefault();
      event.stopPropagation();
      if (!props.pending) props.onCancel();
      return;
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      props.onSubmit();
    }
  };

  return (
    <div
      ref={wrapper}
      class={cn(
        'flex flex-col gap-1.5 rounded-sm border border-[var(--border-default)]',
        'bg-[var(--surface-inset)] p-1.5'
      )}
      onKeyDown={onKeyDown}
    >
      {props.header}

      <textarea
        ref={field}
        rows={1}
        spellcheck={false}
        autocomplete="off"
        aria-label={props.ariaLabel}
        disabled={props.pending}
        value={props.value}
        onInput={(event) => {
          props.onInput(event.currentTarget.value);
          grow();
        }}
        class={cn(
          'text-2xs max-h-64 min-h-14 w-full resize-none rounded-xs border p-1.5 font-mono',
          // Wraps rather than scrolling sideways, and breaks anywhere — the same
          // treatment the read-only value gets, so the text does not reflow when the
          // editor opens over it.
          'border-[var(--border-subtle)] bg-[var(--surface-base)] break-all whitespace-pre-wrap',
          'text-[var(--text-primary)] disabled:opacity-60',
          'focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:-1px]'
        )}
      />

      <div class="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant="primary"
          loading={props.pending}
          onClick={() => props.onSubmit()}
        >
          {props.saveLabel ?? 'Save'}
        </Button>
        <Button size="sm" variant="ghost" disabled={props.pending} onClick={() => props.onCancel()}>
          Cancel
        </Button>
        <span class="text-2xs flex items-center gap-1 text-[var(--text-tertiary)]">
          <Kbd keys="mod+enter" size="sm" /> save
          <Kbd keys="esc" size="sm" /> cancel
        </span>
      </div>
    </div>
  );
}

interface CopyButtonProps {
  label: string;
  text: () => string;
  disabled?: boolean;
}

/** Copy affordance with a 1.2s confirmed state. Never renders the copied text. */
function CopyButton(props: CopyButtonProps) {
  const [copied, setCopied] = createSignal(false);

  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  const copy = async () => {
    await copyToClipboard(props.text(), props.label);
    setCopied(true);
    clearTimeout(timer);
    timer = setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={() => void copy()}
      aria-label={`Copy ${props.label}`}
      class="rounded-xs p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
    >
      <Show when={copied()} fallback={<Copy size={13} />}>
        <Check size={13} class="text-[var(--status-ok)]" />
      </Show>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Conditions                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The subset of a Kubernetes condition every kind shares.
 *
 * `V1PodCondition`, `V1DeploymentCondition`, `V1NodeCondition` and the rest are
 * separate generated classes with identical shapes; this is the structural type they
 * all satisfy, so `ConditionsTable` needs no type argument and no cast.
 */
export interface K8sCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  lastTransitionTime?: Date | string;
}

/**
 * Conditions whose *healthy* value is `False`.
 *
 * For almost every condition `True` is good, but a handful invert — and colouring
 * `ReplicaFailure=True` green would be worse than not colouring it at all. Node
 * pressures are listed ahead of the Nodes descriptor landing, because getting this
 * wrong is silent.
 */
const NEGATIVE_CONDITIONS = new Set([
  'ReplicaFailure',
  'DisruptionTarget',
  'MemoryPressure',
  'DiskPressure',
  'PIDPressure',
  'NetworkUnavailable',
  // Every condition the namespace controller sets is a reason a deletion is *not*
  // finishing. `NamespaceFinalizersRemaining: True` in green would be the single most
  // misleading cell in the app: it is the answer to "why has this namespace been
  // Terminating for two days".
  'NamespaceDeletionDiscoveryFailure',
  'NamespaceDeletionContentFailure',
  'NamespaceDeletionGroupVersionParsingFailure',
  'NamespaceContentRemaining',
  'NamespaceFinalizersRemaining',
]);

const conditionVariant = (condition: K8sCondition) => {
  const negative = NEGATIVE_CONDITIONS.has(condition.type);
  switch (condition.status) {
    case 'True':
      return negative ? 'error' : 'success';
    case 'False':
      return negative ? 'success' : 'error';
    default:
      return 'warning';
  }
};

export interface ConditionsTableProps {
  conditions?: readonly K8sCondition[];
  empty?: string;
}

export function ConditionsTable(props: ConditionsTableProps) {
  return (
    <Show
      when={props.conditions && props.conditions.length > 0}
      fallback={
        <span class="text-2xs text-[var(--text-tertiary)]">
          {props.empty ?? 'No conditions reported'}
        </span>
      }
    >
      <div class="flex flex-col divide-y divide-[var(--border-subtle)]">
        <For each={props.conditions}>
          {(condition) => (
            <div class="flex flex-col gap-0.5 py-1">
              <div class="flex items-baseline gap-2">
                <span class="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">
                  {condition.type}
                </span>
                <Badge variant={conditionVariant(condition)} size="sm">
                  {condition.status}
                </Badge>
                <AgeCell
                  timestamp={condition.lastTransitionTime}
                  class="text-2xs w-10 shrink-0 text-right text-[var(--text-tertiary)]"
                />
              </div>

              <Show when={condition.reason ?? condition.message}>
                <p class="selectable text-2xs leading-snug text-[var(--text-secondary)]">
                  <Show when={condition.reason}>
                    <span class="text-[var(--text-tertiary)]">{condition.reason}: </span>
                  </Show>
                  {condition.message}
                </p>
              </Show>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}
