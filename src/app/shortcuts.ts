/**
 * Global keyboard shortcuts, and the shell state they drive.
 *
 * | Keys        | Action                                                       |
 * | ----------- | ------------------------------------------------------------ |
 * | `⌘K`/`^K`   | Open (or close) the command palette                          |
 * | `⌘R`/`^R`   | Refresh cluster health, watch diagnostics and the open view   |
 * | `⌘1`..`⌘9`  | Jump to the nth item in the navigation sidebar                |
 * | `/`         | Focus the top-bar search field                                |
 * | `Esc`       | Close the palette                                             |
 *
 * ## Why the state lives here rather than in a context
 *
 * Three unrelated components need to open the palette (the top bar's search field, the
 * ⌘K handler, and eventually any "search this cluster" affordance), and exactly one
 * palette exists. A provider would add a tree dependency for no isolation benefit; the
 * signals below are already fine-grained. This mirrors `stores/clusters.ts`.
 *
 * ## The two rules that keep this from fighting the app
 *
 * 1. **Keystrokes originating in a text field are ignored**, apart from `⌘K` and `Esc`.
 *    Without that, typing `/` into a resource filter would steal focus from itself.
 * 2. **`Esc` does not `preventDefault`.** `ui/Drawer`, `ui/Dialog` and `ui/Input` all
 *    have their own Escape behaviour and each expects to see the event.
 */

import { batch, createSignal, onCleanup, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';

import { navItems, resourceHref } from './NavSidebar';

const [paletteOpen, setPaletteOpen] = createSignal(false);
const [paletteQuery, setPaletteQuery] = createSignal('');

export { paletteOpen, setPaletteOpen, paletteQuery, setPaletteQuery };

/** Open the palette, optionally seeded with text the user already typed elsewhere. */
export const openPalette = (query = ''): void => {
  batch(() => {
    setPaletteQuery(query);
    setPaletteOpen(true);
  });
};

export const closePalette = (): void => {
  setPaletteOpen(false);
};

/**
 * A refresh request counter.
 *
 * A counter rather than a boolean so consumers can `on(refreshRequests, …)` and get one
 * run per press, including two presses in a row.
 *
 * FOLLOW-UP: `features/resources/ResourceView.tsx` should subscribe with
 * `createEffect(on(refreshRequests, list.refetch, { defer: true }))`. Until it does, ⌘R
 * refreshes cluster connection state, apiserver version and watch diagnostics, but not
 * the resource list on screen.
 */
const [refreshRequests, setRefreshRequests] = createSignal(0);

export { refreshRequests };

export const requestRefresh = (): void => {
  setRefreshRequests((count) => count + 1);
};

/**
 * The top bar registers its search field here so `/` has something to focus.
 *
 * A module-level element reference rather than a signal: nothing renders from it, and a
 * signal would make every consumer re-run when the top bar remounts.
 */
let searchInput: HTMLInputElement | undefined;

export const registerSearchInput = (element: HTMLInputElement | undefined): void => {
  searchInput = element;
};

/** Returns false when there is no search field mounted, so `/` can fall through. */
export const focusSearch = (): boolean => {
  const element = searchInput;
  if (!element) return false;
  element.focus();
  element.select();
  return true;
};

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  // SELECT is included because typeahead inside a native picker is text entry too.
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

/**
 * Install the global shortcut handler.
 *
 * Call once, from `AppLayout` — it needs the router, so it cannot live at module scope.
 */
export function useGlobalShortcuts(): void {
  const navigate = useNavigate();

  const onKeyDown = (event: KeyboardEvent) => {
    // `metaKey || ctrlKey` rather than a platform branch: Ctrl on macOS is free, and a
    // user on a Windows keyboard plugged into a Mac should get the shortcut either way.
    const mod = (event.metaKey || event.ctrlKey) && !event.altKey;

    // ⌘K and Escape are the two that must work from inside a text field.
    if (mod && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (paletteOpen()) closePalette();
      else openPalette('');
      return;
    }

    if (event.key === 'Escape') {
      if (paletteOpen()) closePalette();
      return;
    }

    if (isTypingTarget(event.target)) return;

    if (mod && event.key.toLowerCase() === 'r') {
      // Without this the WebView reloads the whole bundle, dropping every watch and
      // every unsaved YAML edit — which is emphatically not what ⌘R means in this app.
      event.preventDefault();
      requestRefresh();
      return;
    }

    if (mod && event.key.length === 1 && event.key >= '1' && event.key <= '9') {
      const target = navItems()[Number(event.key) - 1];
      if (!target) return;
      event.preventDefault();
      navigate(resourceHref(target.id));
      return;
    }

    if (!mod && !event.altKey && event.key === '/') {
      // Only swallow the slash if it actually moved focus, so it still types into a
      // field this module does not know about.
      if (focusSearch()) event.preventDefault();
    }
  };

  onMount(() => {
    document.addEventListener('keydown', onKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener('keydown', onKeyDown);
  });
}
