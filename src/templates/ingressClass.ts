import type { V1IngressClass } from '@kubernetes/client-node';

export function templateIngressClass(): V1IngressClass {
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'IngressClass',
    metadata: { name: 'example-ingress-class' },
    spec: {
      controller: 'k8s.io/ingress-nginx',
    },
  } as V1IngressClass;
}
