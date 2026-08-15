/**
 * MutatingWebhookConfigurations. Cluster-scoped.
 *
 * The whole rendering comes from `validatingWebhooks.tsx`: `V1MutatingWebhook` and
 * `V1ValidatingWebhook` are the same shape apart from `reinvocationPolicy`, and
 * `WebhookCard` renders that row only when it is present. The two React files
 * (`SidebarMutatingWebhooks` / `SidebarValidatingWebhooks`) were character-identical apart
 * from the type parameter, which is the duplication `types.ts` describes.
 *
 * What is different about a *mutating* webhook is what it does when it works rather than
 * when it fails: it rewrites objects on their way in. A pod that does not look like its
 * manifest, an injected sidecar nobody can find in Git, a label that reappears after being
 * deleted — the explanation is on this screen, in the rules of whichever webhook matches.
 * That is why the target and the intercepted resources are searchable.
 *
 * `failurePolicy: Fail` is as dangerous here as it is for validation, and defaults the same
 * way: absent means `Fail`. See the header of `validatingWebhooks.tsx`.
 */

import { Wand } from 'lucide-solid';
import type { V1MutatingWebhookConfiguration } from '@kubernetes/client-node';

import {
  deleteMutatingWebhooks,
  listMutatingWebhooks,
  updateMutatingWebhook,
  watchMutatingWebhooks,
} from '@/api/k8s/mutatingWebhooks';

import { AgeCell, DetailGrid, DetailRow, LabelList, ageValue } from '../detail-parts';
import { defineResource } from '../types';

import { WebhookList, webhookCount, webhookSearchTerms } from './validatingWebhooks';

export const mutatingWebhooksDescriptor = defineResource({
  id: 'mutatingWebhooks',
  kind: 'MutatingWebhookConfiguration',
  title: 'Mutating Webhooks',
  group: 'cluster',
  icon: Wand,
  namespaced: false,

  // Cluster-scoped: `list_mutating_webhooks` takes `{ name }` and
  // `delete_mutating_webhooks` `{ name, resourceNames }`.
  api: {
    list: listMutatingWebhooks,
    watch: watchMutatingWebhooks,
    remove: deleteMutatingWebhooks,
    update: updateMutatingWebhook,
  },

  searchExtra: (config: V1MutatingWebhookConfiguration) =>
    webhookSearchTerms(config.webhooks, config.metadata?.labels),

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(220px, 4fr)',
      value: (config: V1MutatingWebhookConfiguration) => config.metadata?.name,
    },
    {
      id: 'webhooks',
      header: 'Webhooks',
      width: '84px',
      align: 'right',
      // The number, not `String(n)`: the React pane sorted the stringified count.
      value: (config: V1MutatingWebhookConfiguration) => webhookCount(config.webhooks),
      cell: (config: V1MutatingWebhookConfiguration) => (
        <span class="tnum">{webhookCount(config.webhooks)}</span>
      ),
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (config: V1MutatingWebhookConfiguration) => ageValue(config),
      cell: (config: V1MutatingWebhookConfiguration) => (
        <AgeCell timestamp={config.metadata?.creationTimestamp} />
      ),
    },
  ],

  detail: [
    {
      id: 'webhooks',
      title: 'Webhooks',
      render: (config: V1MutatingWebhookConfiguration) => (
        <WebhookList webhooks={config.webhooks} verb="mutate" />
      ),
    },
    {
      id: 'metadata',
      title: 'Metadata',
      render: (config: V1MutatingWebhookConfiguration) => (
        <DetailGrid>
          <DetailRow label="Name">{config.metadata?.name}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={config.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Webhooks">{webhookCount(config.webhooks)}</DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={config.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={config.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
  ],
});
