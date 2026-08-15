import type {
  V1NetworkPolicy,
  V1NetworkPolicyIngressRule,
  V1NetworkPolicyPeer,
} from '@kubernetes/client-node';

/**
 * An ingress rule under the name the apiserver actually reads.
 *
 * `V1NetworkPolicyIngressRule` declares the field as **`_from`**, because `from` is a
 * reserved word and the generated client renames it — its `ObjectSerializer` maps the
 * wire name onto `_from` when *it* deserialises a response. Nothing in this app runs that
 * serialiser: this object is sent to the apiserver as raw JSON, which knows only `from`.
 *
 * This template used to emit `_from`. The apiserver dropped the unknown field, leaving a
 * rule with an **empty** peer list — and an empty peer list allows traffic from
 * *everywhere*, so the example shipped the exact opposite of the policy it documents. See
 * the header of `features/resources/descriptors/networkPolicies.tsx`.
 */
type WireIngressRule = Omit<V1NetworkPolicyIngressRule, '_from'> & {
  from?: V1NetworkPolicyPeer[];
};

export function templateNetworkPolicy(namespace?: string): V1NetworkPolicy {
  const allowFromFrontend: WireIngressRule = {
    from: [{ podSelector: { matchLabels: { app: 'frontend' } } }],
  };

  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: { name: 'example-network-policy', namespace },
    spec: {
      podSelector: {},
      policyTypes: ['Ingress', 'Egress'],
      ingress: [allowFromFrontend],
      egress: [
        {
          to: [{ podSelector: { matchLabels: { app: 'backend' } } }],
        },
      ],
    },
  } as V1NetworkPolicy;
}
