import type { V1MutatingWebhookConfiguration } from '@kubernetes/client-node';

export const templateMutatingWebhook: V1MutatingWebhookConfiguration = {
  apiVersion: 'admissionregistration.k8s.io/v1',
  kind: 'MutatingWebhookConfiguration',
  metadata: {
    name: 'example-mutating-webhook',
  },
  webhooks: [
    {
      name: 'example.mutate.kumate.dev',
      admissionReviewVersions: ['v1'],
      sideEffects: 'None',
      failurePolicy: 'Fail',
      clientConfig: {
        service: {
          namespace: 'default',
          name: 'example-webhook-service',
          path: '/mutate',
        },
      },
      rules: [
        {
          apiGroups: [''],
          apiVersions: ['v1'],
          operations: ['CREATE', 'UPDATE'],
          resources: ['pods'],
          scope: 'Namespaced',
        },
      ],
      timeoutSeconds: 10,
    },
  ],
};
