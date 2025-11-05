import type { V1Ingress } from '@kubernetes/client-node';

export function templateIngress(namespace?: string): V1Ingress {
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {
      name: 'example-ingress',
      namespace,
      annotations: { 'nginx.ingress.kubernetes.io/rewrite-target': '/' },
    },
    spec: {
      ingressClassName: 'nginx',
      rules: [
        {
          host: 'example.com',
          http: {
            paths: [
              {
                path: '/',
                pathType: 'Prefix',
                backend: { service: { name: 'example-service', port: { number: 80 } } },
              },
            ],
          },
        },
      ],
    },
  } as V1Ingress;
}
