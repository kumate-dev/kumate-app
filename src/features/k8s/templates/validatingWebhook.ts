import type { V1ValidatingWebhookConfiguration } from '@kubernetes/client-node';

export const templateValidatingWebhook: V1ValidatingWebhookConfiguration = {
  apiVersion: 'admissionregistration.k8s.io/v1',
  kind: 'ValidatingWebhookConfiguration',
  metadata: {
    name: 'example-validating-webhook',
  },
  webhooks: [
    {
      name: 'example.validate.kumate.dev',
      admissionReviewVersions: ['v1'],
      sideEffects: 'None',
      failurePolicy: 'Fail',
      clientConfig: {
        service: {
          namespace: 'default',
          name: 'example-webhook-service',
          path: '/validate',
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
