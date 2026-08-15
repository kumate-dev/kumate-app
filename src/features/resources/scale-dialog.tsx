/**
 * The dialogs a `ResourceAction` can ask a question with.
 *
 * A `ResourceAction` is a plain async function with no JSX slot, so an action that needs
 * a confirmation or a value has nowhere to draw one. `openModal` gives it one by mounting
 * a short-lived Solid root, and it keeps `Dialog` / `ConfirmDialog` as the only dialog
 * implementations in the app — the alternative is a bespoke modal per action, which is
 * exactly what the React code had (`ModalScale`, `ModalRestart`, `ModalSuspend`, each
 * with its own `patching` flag threaded through six props).
 *
 * `deployments.tsx` owned `openModal` privately and carried a FOLLOW-UP to lift it once a
 * second kind needed it. Five now do: StatefulSets restart and scale, ReplicaSets and
 * ReplicationControllers scale, DaemonSets restart, CronJobs suspend and resume. The file
 * is named after the dialog that motivated the move; `openModal` is the part the rest is
 * built on, and a new action-owned dialog belongs here rather than in a descriptor.
 */

import { createMemo, createSignal, type JSX } from 'solid-js';
import { render } from 'solid-js/web';

import { Button } from '@/ui/Button';
import { ConfirmDialog, Dialog, DialogFooter } from '@/ui/Dialog';
import { Input } from '@/ui/Input';

/**
 * Show a modal from outside the component tree and resolve with the answer.
 *
 * The root is disposed after the answer, so nothing survives the interaction; there is
 * no dialog state parked in a store waiting for the next time an action runs.
 */
export function openModal<T>(view: (resolve: (value: T) => void) => JSX.Element): Promise<T> {
  return new Promise<T>((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    let settled = false;

    const finish = (value: T) => {
      // `ConfirmDialog` calls `onConfirm` and then `onOpenChange(false)`, so both paths
      // fire; the first answer wins.
      if (settled) return;
      settled = true;
      resolve(value);

      // Torn down on a later task, not in this handler: the pointerup/click/focus
      // sequence Kobalte is still in the middle of must finish against a live tree.
      setTimeout(() => {
        dispose();
        host.remove();
      }, 0);
    };

    // Declared after `finish` and closed over by it. Safe because nothing calls `finish`
    // synchronously during `render` — it only ever runs from a user interaction.
    const dispose = render(() => view(finish), host);
  });
}

/**
 * Confirm a rolling restart.
 *
 * `description` is per kind because the blast radius is: a Deployment replaces pods in
 * parallel under `maxUnavailable`, a StatefulSet one ordinal at a time, a DaemonSet one
 * node at a time. Defaults to the Deployment wording.
 */
export const confirmRestart = (name: string, description?: JSX.Element): Promise<boolean> =>
  openModal<boolean>((resolve) => (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) resolve(false);
      }}
      variant="primary"
      title={`Restart ${name}?`}
      description={
        description ??
        'Every pod is replaced by a rolling update. In-flight requests to terminating pods may fail.'
      }
      confirmLabel="Restart"
      onConfirm={() => resolve(true)}
    />
  ));

/** Resolves with the requested replica count, or `null` if the user backed out. */
export const promptReplicas = (name: string, current: number): Promise<number | null> =>
  openModal<number | null>((resolve) => {
    const [draft, setDraft] = createSignal(String(current));

    const parsed = createMemo(() => Number.parseInt(draft(), 10));
    const valid = () => Number.isInteger(parsed()) && parsed() >= 0;

    const submit = () => {
      if (valid()) resolve(parsed());
    };

    return (
      <Dialog
        open
        size="sm"
        onOpenChange={(open) => {
          if (!open) resolve(null);
        }}
        title={`Scale ${name}`}
        description="Desired number of replicas. Scaling to 0 stops the workload without deleting it."
      >
        <form
          class="px-4 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Input
            type="number"
            min="0"
            step="1"
            autofocus
            aria-label="Replicas"
            value={draft()}
            invalid={!valid()}
            onInput={(event) => setDraft(event.currentTarget.value)}
          />
        </form>

        <DialogFooter>
          {/* Cancel first, so it takes the initial focus and the first Tab stop. */}
          <Button variant="ghost" onClick={() => resolve(null)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid()} onClick={submit}>
            Scale
          </Button>
        </DialogFooter>
      </Dialog>
    );
  });
