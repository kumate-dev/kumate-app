/**
 * Modal dialog, plus the confirmation dialog that guards destructive actions.
 *
 * `Dialog` is a thin shell: overlay, a centred panel, and an optional header with a
 * title and a close button. Body and footer are the caller's, composed from
 * `DialogTitle` / `DialogDescription` / `DialogFooter` so the accessible names are
 * registered with Kobalte rather than being loose `<h2>`s.
 *
 * The scrim is the dark-mode `--surface-base` value at 60% in *both* themes. There is
 * no scrim token, and a light scrim over a light app reads as a rendering glitch
 * rather than as "the thing behind is inert".
 *
 * `ConfirmDialog` exists because deleting a Kubernetes resource is irreversible and
 * frequently done to the wrong row. Its danger form is unmistakable on three axes at
 * once — a danger-tinted warning glyph, a filled red confirm button, and Cancel first
 * in the DOM so Tab and the initial focus land on the safe choice. `onConfirm` may be
 * async: the button shows a spinner until it settles, and the dialog stays open if it
 * rejects, so a failed delete is not silently dismissed.
 */

import { Show, children, createSignal, splitProps, type JSX } from 'solid-js';
import { Dialog as KDialog } from '@kobalte/core/dialog';
import { TriangleAlert, X } from 'lucide-solid';

import { cn } from '@/lib/k8s';
import { getErrorMessage } from '@/utils/error';

import { Button } from './Button';
import { toast } from './Toast';

const SIZE: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'max-w-[380px]',
  md: 'max-w-[480px]',
  lg: 'max-w-[680px]',
};

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Renders the standard header. Omit to build your own out of `DialogTitle`. */
  title?: JSX.Element;
  description?: JSX.Element;
  size?: 'sm' | 'md' | 'lg';
  /** Hides the header ✕. Use for dialogs that must be answered, not dismissed. */
  hideCloseButton?: boolean;
  class?: string;
  children?: JSX.Element;
}

export function Dialog(props: DialogProps) {
  const [local] = splitProps(props, [
    'open',
    'defaultOpen',
    'onOpenChange',
    'title',
    'description',
    'size',
    'hideCloseButton',
    'class',
    'children',
  ]);

  // `children()` memoises the resolved node. Reading a JSX-valued prop twice — once for
  // a `<Show>` condition and once to render it — would otherwise build it twice and
  // throw one away, running any effects inside it a second time.
  const title = children(() => local.title);
  const description = children(() => local.description);

  return (
    <KDialog
      open={local.open}
      defaultOpen={local.defaultOpen}
      onOpenChange={local.onOpenChange}
      modal
    >
      <KDialog.Portal>
        <KDialog.Overlay class="fixed inset-0 z-50 bg-[hsl(222_18%_8%/0.6)]" />
        <div class="pointer-events-none fixed inset-0 z-50 flex items-start justify-center p-8 pt-[12vh]">
          <KDialog.Content
            class={cn(
              'animate-in pointer-events-auto flex w-full flex-col overflow-hidden rounded-sm',
              'border border-[var(--border-default)] bg-[var(--surface-overlay)]',
              'shadow-[var(--shadow-overlay)] outline-none',
              SIZE[local.size ?? 'md'],
              local.class
            )}
          >
            <Show when={title()}>
              <header class="flex items-start gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
                <div class="min-w-0 flex-1">
                  <DialogTitle>{title()}</DialogTitle>
                  <Show when={description()}>
                    <DialogDescription>{description()}</DialogDescription>
                  </Show>
                </div>
                <Show when={!local.hideCloseButton}>
                  <KDialog.CloseButton
                    aria-label="Close"
                    class={cn(
                      '-mr-1 shrink-0 rounded-xs p-1 text-[var(--text-tertiary)] transition-colors',
                      'hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    <X size={14} />
                  </KDialog.CloseButton>
                </Show>
              </header>
            </Show>
            {local.children}
          </KDialog.Content>
        </div>
      </KDialog.Portal>
    </KDialog>
  );
}

export interface DialogTitleProps {
  class?: string;
  children?: JSX.Element;
}

export function DialogTitle(props: DialogTitleProps) {
  return (
    <KDialog.Title class={cn('truncate font-medium text-[var(--text-primary)]', props.class)}>
      {props.children}
    </KDialog.Title>
  );
}

export interface DialogDescriptionProps {
  class?: string;
  children?: JSX.Element;
}

export function DialogDescription(props: DialogDescriptionProps) {
  return (
    <KDialog.Description
      class={cn('text-2xs mt-0.5 leading-snug text-[var(--text-secondary)]', props.class)}
    >
      {props.children}
    </KDialog.Description>
  );
}

export interface DialogFooterProps {
  class?: string;
  children?: JSX.Element;
}

export function DialogFooter(props: DialogFooterProps) {
  return (
    <footer
      class={cn(
        'flex items-center justify-end gap-2 border-t border-[var(--border-subtle)]',
        'bg-[var(--surface-raised)] px-4 py-3',
        props.class
      )}
    >
      {props.children}
    </footer>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: JSX.Element;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  /** Resolve to close. Reject to keep the dialog open and surface the failure. */
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const [pending, setPending] = createSignal(false);
  const description = children(() => props.description);

  const isDanger = () => (props.variant ?? 'danger') === 'danger';

  const confirm = async () => {
    setPending(true);
    try {
      await props.onConfirm();
      props.onOpenChange(false);
    } catch (error) {
      // Staying open with a toast beats closing on a failed delete: the user needs to
      // know the resource is still there, and they are already looking at this dialog.
      toast.error(getErrorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange} size="sm" hideCloseButton>
      <div class="flex items-start gap-3 px-4 py-4">
        <Show when={isDanger()}>
          <span
            class={cn(
              'mt-px flex size-7 shrink-0 items-center justify-center rounded-sm',
              'bg-[var(--status-danger-subtle)] text-[var(--status-danger)]'
            )}
            aria-hidden="true"
          >
            <TriangleAlert size={15} />
          </span>
        </Show>
        <div class="min-w-0 flex-1">
          <DialogTitle class="whitespace-normal">{props.title}</DialogTitle>
          <Show when={description()}>
            <DialogDescription>{description()}</DialogDescription>
          </Show>
        </div>
      </div>

      <DialogFooter>
        {/* Cancel first so it takes initial focus and the first Tab stop. */}
        <Button variant="ghost" disabled={pending()} onClick={() => props.onOpenChange(false)}>
          {props.cancelLabel ?? 'Cancel'}
        </Button>
        <Button
          variant={isDanger() ? 'danger' : 'primary'}
          loading={pending()}
          onClick={() => void confirm()}
        >
          {props.confirmLabel ?? (isDanger() ? 'Delete' : 'Confirm')}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
