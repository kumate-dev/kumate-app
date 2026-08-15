/**
 * The command palette — the primary navigation affordance.
 *
 * Everything reachable from the chrome is reachable from here: every registered kind,
 * every cluster, every namespace, and the handful of global actions. That is the point.
 * A keyboard-driven tool where the palette only covers *some* of the app trains people
 * to reach for the mouse, and then the palette may as well not exist.
 *
 * ## Matching
 *
 * A subsequence match with a small score, not a substring match: `dpl` should find
 * Deployments and `kbs` should find `kube-system`. Scoring rewards consecutive hits and
 * word boundaries and penalises gaps, which is what makes the exact kind you typed sort
 * above the namespace that merely contains those letters. It is ~20 lines and runs over
 * a list bounded by "kinds + clusters + namespaces" — a fuzzy-matching dependency would
 * be more bytes than the data it searches.
 *
 * ## Bounded rendering
 *
 * Results are capped at `MAX_RESULTS`. A cluster with two thousand namespaces would
 * otherwise render two thousand rows into a scroll container with no virtualization —
 * and a palette that needs virtualization is a palette whose query is too vague.
 */

import { For, Show, createEffect, createMemo, createSignal, onCleanup, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { useNavigate } from '@solidjs/router';
import { Boxes, Download, FolderTree, RotateCw, Search, Server, SunMoon } from 'lucide-solid';

import { ALL_NAMESPACES } from '@/constants/k8s';
import { cn } from '@/lib/k8s';
import {
  contexts,
  importContexts,
  isConnected,
  refreshConnections,
  selectCluster,
  selectedName,
} from '@/stores/clusters';
import {
  isAllNamespaces,
  namespaces,
  selectedNamespaces,
  setSelectedNamespaces,
} from '@/stores/namespaces';
import { resolvedTheme, setTheme } from '@/stores/theme';
import { Dialog } from '@/ui/Dialog';
import { EmptyState } from '@/ui/EmptyState';
import { Kbd } from '@/ui/Kbd';
import { toast } from '@/ui/Toast';
import type { IconComponent } from '@/ui/types';
import { getErrorMessage } from '@/utils/error';

import { navItems, resourceHref } from './NavSidebar';
import {
  closePalette,
  openPalette,
  paletteOpen,
  paletteQuery,
  requestRefresh,
  setPaletteQuery,
} from './shortcuts';

const MAX_RESULTS = 50;

type CommandGroup = 'Resources' | 'Clusters' | 'Namespaces' | 'Actions';

const GROUP_ORDER: CommandGroup[] = ['Resources', 'Clusters', 'Namespaces', 'Actions'];

interface Command {
  id: string;
  group: CommandGroup;
  label: string;
  /** Secondary text on the right of the row. */
  hint?: string;
  /** Extra text the query may match, e.g. a kind's group or a cluster's context name. */
  keywords?: string;
  icon: IconComponent;
  /** Marks the row as the current selection. */
  current?: boolean;
  run: () => void;
}

const WORD_BREAK = /[\s\-_/.:]/;

/**
 * Score `text` against an already-lowercased `query`. `null` means no match.
 *
 * Higher is better. The weights are deliberately coarse — the only job is to keep an
 * exact-ish prefix above an incidental subsequence.
 */
const fuzzyScore = (query: string, text: string): number | null => {
  if (query.length === 0) return 0;

  const haystack = text.toLowerCase();
  let score = 0;
  let cursor = 0;
  let previous = -2;

  for (const char of query) {
    const index = haystack.indexOf(char, cursor);
    if (index === -1) return null;

    if (index === previous + 1) score += 8;
    if (index === 0 || WORD_BREAK.test(haystack[index - 1] ?? '')) score += 6;
    // Every character skipped to reach this one is a worse match.
    score -= index - cursor;

    previous = index;
    cursor = index + 1;
  }

  return score;
};

const scoreCommand = (query: string, command: Command): number | null => {
  const onLabel = fuzzyScore(query, command.label);
  // Keywords match at a discount so a label hit always outranks a keyword hit.
  const onKeywords = command.keywords ? fuzzyScore(query, command.keywords) : null;
  const discounted = onKeywords === null ? null : onKeywords - 12;

  if (onLabel === null) return discounted;
  if (discounted === null) return onLabel;
  return Math.max(onLabel, discounted);
};

export function CommandPalette(): JSX.Element {
  const navigate = useNavigate();

  const [rawIndex, setRawIndex] = createSignal(0);

  let input: HTMLInputElement | undefined;
  let list: HTMLDivElement | undefined;

  const runAndClose = (action: () => void) => {
    closePalette();
    action();
  };

  const commands = createMemo<Command[]>(() => {
    const entries: Command[] = [];

    for (const descriptor of navItems()) {
      entries.push({
        id: `resource:${descriptor.id}`,
        group: 'Resources',
        label: descriptor.title,
        keywords: `${descriptor.kind} ${descriptor.group} ${descriptor.id}`,
        icon: descriptor.icon,
        run: () => runAndClose(() => navigate(resourceHref(descriptor.id))),
      });
    }

    for (const context of contexts() ?? []) {
      const name = context.display_name || context.name;
      entries.push({
        id: `cluster:${context.name}`,
        group: 'Clusters',
        label: name,
        hint: isConnected(context.name) ? undefined : 'disconnected',
        keywords: `${context.name} ${context.cluster ?? ''}`,
        icon: Server,
        current: context.name === selectedName(),
        run: () => runAndClose(() => selectCluster(context.name)),
      });
    }

    entries.push({
      id: `namespace:${ALL_NAMESPACES}`,
      group: 'Namespaces',
      label: ALL_NAMESPACES,
      icon: FolderTree,
      current: isAllNamespaces(),
      run: () => runAndClose(() => setSelectedNamespaces([ALL_NAMESPACES])),
    });

    for (const name of namespaces()) {
      entries.push({
        id: `namespace:${name}`,
        group: 'Namespaces',
        label: name,
        icon: FolderTree,
        current: !isAllNamespaces() && selectedNamespaces().includes(name),
        // Selecting from the palette replaces the filter rather than extending it: the
        // top bar is where you build a multi-namespace selection.
        run: () => runAndClose(() => setSelectedNamespaces([name])),
      });
    }

    entries.push(
      {
        id: 'action:theme',
        group: 'Actions',
        label: resolvedTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        keywords: 'theme dark light appearance',
        icon: SunMoon,
        run: () => runAndClose(() => setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark')),
      },
      {
        id: 'action:import',
        group: 'Actions',
        label: 'Import contexts from ~/.kube',
        keywords: 'kubeconfig contexts import clusters',
        icon: Download,
        run: () =>
          runAndClose(() => {
            void importContexts()
              .then(() => refreshConnections())
              .then(() => toast.success('Imported contexts from ~/.kube'))
              .catch((error: unknown) => toast.error(getErrorMessage(error)));
          }),
      },
      {
        id: 'action:refresh',
        group: 'Actions',
        label: 'Refresh data',
        hint: 'mod+r',
        keywords: 'refresh reload refetch',
        icon: RotateCw,
        run: () =>
          runAndClose(() => {
            void refreshConnections();
            requestRefresh();
          }),
      },
      {
        id: 'action:reload',
        group: 'Actions',
        label: 'Reload window',
        keywords: 'reload restart window bundle',
        icon: Boxes,
        // Drops every watch and every unsaved edit, which is why it is not bound to ⌘R.
        run: () => runAndClose(() => window.location.reload()),
      }
    );

    return entries;
  });

  /** One pass: the visible slice and how much of the match set it left out. */
  const matches = createMemo<{ items: Command[]; hidden: number }>(() => {
    const query = paletteQuery().trim().toLowerCase();
    const all = commands();

    if (query.length === 0) {
      return { items: all.slice(0, MAX_RESULTS), hidden: Math.max(0, all.length - MAX_RESULTS) };
    }

    const scored: { command: Command; score: number }[] = [];
    for (const command of all) {
      const score = scoreCommand(query, command);
      if (score !== null) scored.push({ command, score });
    }

    scored.sort((a, b) => {
      // Group order first, so the list never reshuffles between sections as you type.
      const byGroup = GROUP_ORDER.indexOf(a.command.group) - GROUP_ORDER.indexOf(b.command.group);
      if (byGroup !== 0) return byGroup;
      return b.score - a.score;
    });

    return {
      items: scored.slice(0, MAX_RESULTS).map((entry) => entry.command),
      hidden: Math.max(0, scored.length - MAX_RESULTS),
    };
  });

  const results = () => matches().items;

  // Clamped rather than reset by an effect: the index is only ever read alongside the
  // results, so there is nothing to synchronise.
  const activeIndex = createMemo(() => Math.min(rawIndex(), Math.max(0, results().length - 1)));

  const move = (delta: number) => {
    const count = results().length;
    if (count === 0) return;
    setRawIndex((activeIndex() + delta + count) % count);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Home':
        event.preventDefault();
        setRawIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setRawIndex(Math.max(0, results().length - 1));
        break;
      case 'Enter': {
        const command = results()[activeIndex()];
        if (!command) return;
        event.preventDefault();
        command.run();
        break;
      }
      case 'Escape':
        // Clearing first is the cheaper undo: Escape on a long query should not also
        // throw away the palette. Kobalte closes it on the second press.
        if (paletteQuery().length > 0) {
          event.preventDefault();
          event.stopPropagation();
          setPaletteQuery('');
          setRawIndex(0);
        }
        break;
      default:
        break;
    }
  };

  // Kobalte focuses the panel itself on open; the field is what the user wants. A frame
  // later so this lands after Kobalte's own focus, and cancelled if the palette closes
  // before it runs.
  createEffect(() => {
    if (!paletteOpen()) return;
    setRawIndex(0);
    const frame = requestAnimationFrame(() => input?.focus());
    onCleanup(() => cancelAnimationFrame(frame));
  });

  createEffect(() => {
    const index = activeIndex();
    if (!paletteOpen()) return;
    list?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({
      block: 'nearest',
    });
  });

  return (
    <Dialog
      open={paletteOpen()}
      onOpenChange={(open) => (open ? openPalette(paletteQuery()) : closePalette())}
      size="lg"
      class="max-h-[min(520px,70vh)]"
    >
      <div class="flex shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-3">
        <Search size={14} class="shrink-0 text-[var(--text-tertiary)]" aria-hidden="true" />
        <input
          ref={input}
          type="text"
          value={paletteQuery()}
          onInput={(event) => {
            setPaletteQuery(event.currentTarget.value);
            setRawIndex(0);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded="true"
          aria-controls="command-palette-list"
          aria-label="Command palette"
          aria-activedescendant={results().length > 0 ? `command-${activeIndex()}` : undefined}
          autocomplete="off"
          spellcheck={false}
          placeholder="Jump to a kind, cluster or namespace…"
          class={cn(
            'h-10 min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)]',
            'placeholder:text-[var(--text-tertiary)] focus-visible:outline-none'
          )}
        />
      </div>

      <div
        ref={list}
        id="command-palette-list"
        role="listbox"
        aria-label="Commands"
        class="min-h-0 flex-1 overflow-y-auto p-1"
      >
        <Show
          when={results().length > 0}
          fallback={
            <EmptyState
              icon={Search}
              title={`No match for “${paletteQuery().trim()}”`}
              description="Searches resource kinds, clusters, namespaces and global actions. Try fewer letters — matching is by subsequence, so “dpl” finds Deployments."
              class="min-h-[160px]"
            />
          }
        >
          <For each={results()}>
            {(command, index) => {
              const isFirstOfGroup = () => results()[index() - 1]?.group !== command.group;
              const isActive = () => index() === activeIndex();

              return (
                <>
                  <Show when={isFirstOfGroup()}>
                    <p
                      class={cn(
                        'text-2xs px-2 pt-2 pb-1 font-medium tracking-wide',
                        'text-[var(--text-tertiary)] uppercase'
                      )}
                    >
                      {command.group}
                    </p>
                  </Show>

                  <div
                    id={`command-${index()}`}
                    data-index={index()}
                    role="option"
                    aria-selected={isActive()}
                    // Pointer-down, not click: the input must keep focus, and mousedown
                    // is what would otherwise steal it.
                    onPointerDown={(event) => {
                      event.preventDefault();
                      command.run();
                    }}
                    onPointerMove={() => setRawIndex(index())}
                    class={cn(
                      'flex h-[var(--spacing-row)] cursor-default items-center gap-2 rounded-xs px-2',
                      isActive()
                        ? 'bg-[var(--surface-hover)] text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)]'
                    )}
                  >
                    <Dynamic
                      component={command.icon}
                      size={14}
                      class="shrink-0 opacity-80"
                      aria-hidden="true"
                    />
                    <span class="min-w-0 flex-1 truncate">{command.label}</span>

                    <Show when={command.current}>
                      <span class="text-2xs shrink-0 text-[var(--accent)]">current</span>
                    </Show>
                    <Show when={command.hint}>
                      {(hint) => (
                        <span class="text-2xs shrink-0 text-[var(--text-tertiary)]">{hint()}</span>
                      )}
                    </Show>
                  </div>
                </>
              );
            }}
          </For>

          <Show when={matches().hidden > 0}>
            <p class="text-2xs px-2 py-2 text-[var(--text-tertiary)]">
              {`+${matches().hidden} more — keep typing to narrow the list.`}
            </p>
          </Show>
        </Show>
      </div>

      <footer
        class={cn(
          'flex shrink-0 items-center gap-3 border-t border-[var(--border-subtle)]',
          'text-2xs bg-[var(--surface-raised)] px-3 py-1.5 text-[var(--text-tertiary)]'
        )}
      >
        <span class="flex items-center gap-1">
          <Kbd keys="up" size="sm" />
          <Kbd keys="down" size="sm" />
          navigate
        </span>
        <span class="flex items-center gap-1">
          <Kbd keys="enter" size="sm" />
          open
        </span>
        <span class="flex items-center gap-1">
          <Kbd keys="esc" size="sm" />
          close
        </span>
        <span class="tnum ml-auto">
          {`${results().length} result${results().length === 1 ? '' : 's'}`}
        </span>
      </footer>
    </Dialog>
  );
}
