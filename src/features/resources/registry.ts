import type { K8sObject } from '@/lib/k8s';
import type { NavGroup, ResourceDescriptor } from './types';

import { clusterRoleBindingsDescriptor } from './descriptors/clusterRoleBindings';
import { clusterRolesDescriptor } from './descriptors/clusterRoles';
import { configMapsDescriptor } from './descriptors/configMaps';
import { cronJobsDescriptor } from './descriptors/cronJobs';
import { daemonSetsDescriptor } from './descriptors/daemonSets';
import { deploymentsDescriptor } from './descriptors/deployments';
import { endpointsDescriptor } from './descriptors/endpoints';
import { horizontalPodAutoscalersDescriptor } from './descriptors/horizontalPodAutoscalers';
import { ingressClassesDescriptor } from './descriptors/ingressClasses';
import { ingressesDescriptor } from './descriptors/ingresses';
import { jobsDescriptor } from './descriptors/jobs';
import { leasesDescriptor } from './descriptors/leases';
import { limitRangesDescriptor } from './descriptors/limitRanges';
import { mutatingWebhooksDescriptor } from './descriptors/mutatingWebhooks';
import { namespacesDescriptor } from './descriptors/namespaces';
import { networkPoliciesDescriptor } from './descriptors/networkPolicies';
import { nodesDescriptor } from './descriptors/nodes';
import { persistentVolumeClaimsDescriptor } from './descriptors/persistentVolumeClaims';
import { persistentVolumesDescriptor } from './descriptors/persistentVolumes';
import { podDisruptionBudgetsDescriptor } from './descriptors/podDisruptionBudgets';
import { podsDescriptor } from './descriptors/pods';
import { priorityClassesDescriptor } from './descriptors/priorityClasses';
import { replicaSetsDescriptor } from './descriptors/replicaSets';
import { replicationControllersDescriptor } from './descriptors/replicationControllers';
import { resourceQuotasDescriptor } from './descriptors/resourceQuotas';
import { roleBindingsDescriptor } from './descriptors/roleBindings';
import { rolesDescriptor } from './descriptors/roles';
import { runtimeClassesDescriptor } from './descriptors/runtimeClasses';
import { secretsDescriptor } from './descriptors/secrets';
import { serviceAccountsDescriptor } from './descriptors/serviceAccounts';
import { servicesDescriptor } from './descriptors/services';
import { statefulSetsDescriptor } from './descriptors/statefulSets';
import { storageClassesDescriptor } from './descriptors/storageClasses';
import { validatingWebhooksDescriptor } from './descriptors/validatingWebhooks';

/**
 * Every resource kind the application can show.
 *
 * ## Why this file is short
 *
 * The React implementation spread 37 kinds across 114 files — a `pages/X.tsx`, a
 * `PaneX.tsx` and a `SidebarX.tsx` each, ~14,700 lines, of which the overwhelming
 * majority was copy-paste that differed only by type parameter and API function name.
 * A fix to table behaviour had to be applied 37 times, and in practice was not.
 *
 * Each entry below is a descriptor: pure data describing columns, status derivation,
 * detail sections and actions. `ResourceView` renders all of them. Adding a kind is one
 * file plus one line here.
 *
 * ## Order matters
 *
 * The sidebar and the command palette render kinds in this order within each group, and
 * `/` redirects to the first entry. It is arranged by how often a kind is opened, not
 * alphabetically — Pods first, obscure cluster-scoped configuration last.
 */
// Element types differ per descriptor and are checked at each definition site by
// `defineResource`; the registry only ever treats them as `K8sObject`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const RESOURCES: ResourceDescriptor<any>[] = [
  // Workloads
  podsDescriptor,
  deploymentsDescriptor,
  statefulSetsDescriptor,
  daemonSetsDescriptor,
  replicaSetsDescriptor,
  replicationControllersDescriptor,
  jobsDescriptor,
  cronJobsDescriptor,

  // Configuration
  configMapsDescriptor,
  secretsDescriptor,
  resourceQuotasDescriptor,
  limitRangesDescriptor,
  horizontalPodAutoscalersDescriptor,
  podDisruptionBudgetsDescriptor,
  leasesDescriptor,

  // Network
  servicesDescriptor,
  endpointsDescriptor,
  ingressesDescriptor,
  ingressClassesDescriptor,
  networkPoliciesDescriptor,

  // Storage
  persistentVolumeClaimsDescriptor,
  persistentVolumesDescriptor,
  storageClassesDescriptor,

  // Access control
  serviceAccountsDescriptor,
  rolesDescriptor,
  roleBindingsDescriptor,
  clusterRolesDescriptor,
  clusterRoleBindingsDescriptor,

  // Cluster
  nodesDescriptor,
  namespacesDescriptor,
  priorityClassesDescriptor,
  runtimeClassesDescriptor,
  mutatingWebhooksDescriptor,
  validatingWebhooksDescriptor,
];

export const resourceById = (id: string): ResourceDescriptor<K8sObject> | undefined =>
  RESOURCES.find((descriptor) => descriptor.id === id);

export const resourcesByGroup = (group: NavGroup): ResourceDescriptor<K8sObject>[] =>
  RESOURCES.filter((descriptor) => descriptor.group === group);

/** Groups that currently contain at least one registered kind. */
export const populatedGroups = (): NavGroup[] => {
  const seen = new Set<NavGroup>();
  for (const descriptor of RESOURCES) seen.add(descriptor.group);
  return [...seen];
};
