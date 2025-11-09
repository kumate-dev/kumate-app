import { useCallback, useMemo, useState, useEffect } from 'react';
import type { V1Container, V1ConfigMap, V1Secret } from '@kubernetes/client-node';
import { Table, Tbody, Tr, Td } from '@/components/ui/table';
import { listConfigMaps } from '@/api/k8s/configMaps';
import { listSecrets } from '@/api/k8s/secrets';
import { decodeBase64 } from '@/utils/base64';
import { IconEye } from '@/components/common/IconEye';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface SidebarEnvSectionProps {
  contextName?: string;
  namespace?: string;
  containers?: V1Container[];
  variant?: 'section' | 'inline';
}

type EnvEntry = {
  name: string;
  value?: string;
  source: string;
  isSecret?: boolean;
};

const useEnvSources = (contextName?: string, namespace?: string) => {
  const [configMaps, setConfigMaps] = useState<Record<string, V1ConfigMap>>({});
  const [secrets, setSecrets] = useState<Record<string, V1Secret>>({});

  useMemo(() => {
    if (!contextName || !namespace) return;

    const fetchSources = async () => {
      try {
        const [cms, secs] = await Promise.all([
          listConfigMaps({ name: contextName, namespaces: [namespace] }),
          listSecrets({ name: contextName, namespaces: [namespace] }),
        ]);

        const cmMap: Record<string, V1ConfigMap> = {};
        const secMap: Record<string, V1Secret> = {};

        cms.forEach((cm) => {
          const name = cm.metadata?.name;
          if (name) cmMap[name] = cm;
        });

        secs.forEach((sec) => {
          const name = sec.metadata?.name;
          if (name) secMap[name] = sec;
        });

        setConfigMaps(cmMap);
        setSecrets(secMap);
      } catch (error) {
        console.warn('Failed to fetch ConfigMaps/Secrets:', error);
      }
    };

    fetchSources();
  }, [contextName, namespace]);

  return { configMaps, secrets };
};

const useSecretVisibility = () => {
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const toggleSecret = useCallback((idKey: string) => {
    setShowSecrets((prev) => ({
      ...prev,
      [idKey]: !prev[idKey],
    }));
  }, []);

  const isSecretVisible = useCallback(
    (idKey: string) => {
      return !!showSecrets[idKey];
    },
    [showSecrets]
  );

  return { toggleSecret, isSecretVisible };
};

const processEnvFrom = (
  envFrom: V1Container['envFrom'],
  configMaps: Record<string, V1ConfigMap>,
  secrets: Record<string, V1Secret>,
  entries: EnvEntry[]
) => {
  envFrom?.forEach((ef) => {
    const prefix = ef.prefix || '';

    if (ef.configMapRef?.name) {
      const cmName = ef.configMapRef.name;
      const cm = configMaps[cmName];

      if (cm?.data) {
        Object.entries(cm.data).forEach(([key, value]) => {
          entries.push({
            name: `${prefix}${key}`,
            value,
            source: `configmap:${cmName}/${key}`,
            isSecret: false,
          });
        });
      } else {
        entries.push({
          name: `${prefix}*`,
          value: undefined,
          source: `configmap:${cmName} (unavailable)`,
        });
      }
    }

    if (ef.secretRef?.name) {
      const secretName = ef.secretRef.name;
      const secret = secrets[secretName];

      if (secret?.data) {
        Object.entries(secret.data).forEach(([key, value]) => {
          entries.push({
            name: `${prefix}${key}`,
            value: decodeBase64(value),
            source: `secret:${secretName}/${key}`,
            isSecret: true,
          });
        });
      } else {
        entries.push({
          name: `${prefix}*`,
          value: undefined,
          source: `secret:${secretName} (unavailable)`,
          isSecret: true,
        });
      }
    }
  });
};

const processEnv = (
  env: V1Container['env'],
  configMaps: Record<string, V1ConfigMap>,
  secrets: Record<string, V1Secret>,
  entries: EnvEntry[]
) => {
  env?.forEach((e) => {
    const name = e.name || '-';

    if (e.value !== undefined) {
      entries.push({ name, value: e.value, source: 'literal' });
      return;
    }

    const valueFrom = e.valueFrom;
    if (!valueFrom) {
      entries.push({ name, value: undefined, source: 'unknown' });
      return;
    }

    if (valueFrom.configMapKeyRef) {
      const ref = valueFrom.configMapKeyRef;
      const cm = ref.name ? configMaps[ref.name] : undefined;
      const value = cm?.data?.[ref.key || ''];

      entries.push({
        name,
        value,
        source: `configmap:${ref.name}/${ref.key}`,
        isSecret: false,
      });
      return;
    }

    if (valueFrom.secretKeyRef) {
      const ref = valueFrom.secretKeyRef;
      const secret = ref.name ? secrets[ref.name] : undefined;
      const encodedValue = secret?.data?.[ref.key || ''];
      const value = encodedValue ? decodeBase64(encodedValue) : undefined;

      entries.push({
        name,
        value,
        source: `secret:${ref.name}/${ref.key}`,
        isSecret: true,
      });
      return;
    }

    if (valueFrom.fieldRef) {
      entries.push({
        name,
        value: undefined,
        source: `fieldRef:${valueFrom.fieldRef.fieldPath}`,
      });
      return;
    }

    if (valueFrom.resourceFieldRef) {
      entries.push({
        name,
        value: undefined,
        source: `resourceFieldRef:${valueFrom.resourceFieldRef.resource}`,
      });
      return;
    }

    entries.push({ name, value: undefined, source: 'unknown' });
  });
};

const processContainerEnv = (
  container: V1Container,
  configMaps: Record<string, V1ConfigMap>,
  secrets: Record<string, V1Secret>
): EnvEntry[] => {
  const entries: EnvEntry[] = [];

  processEnvFrom(container.envFrom, configMaps, secrets, entries);
  processEnv(container.env, configMaps, secrets, entries);

  entries.sort((a, b) => a.name.localeCompare(b.name));

  return entries;
};

interface EnvRowProps {
  entry: EnvEntry;
  idKey: string;
  isSecretVisible: (key: string) => boolean;
  onToggleSecret: (key: string) => void;
}

const EnvRow = ({ entry, idKey, isSecretVisible, onToggleSecret }: EnvRowProps) => {
  const isSecret = !!entry.isSecret;
  const shown = isSecret ? isSecretVisible(idKey) : true;
  const masked = isSecret && !shown;
  const displayValue = entry.value ?? '';
  const canToggle = isSecret && entry.value !== undefined;

  return (
    <Tr>
      <Td className="w-auto align-top">{entry.name}</Td>
      <Td className="w-auto text-white">
        <div className="inline-flex items-center gap-2 break-all">
          <span className={masked ? 'secret-masked select-none' : ''}>
            {masked ? '••••••••' : displayValue}
          </span>
          {canToggle && (
            <IconEye
              masked={masked}
              onClick={() => onToggleSecret(idKey)}
              className="h-5 w-5 shrink-0 cursor-pointer text-white/90 hover:text-white"
              title={masked ? 'Reveal' : 'Hide'}
            />
          )}
        </div>
      </Td>
      <Td className="w-auto text-white/70">{entry.source}</Td>
    </Tr>
  );
};

interface ContainerSectionProps {
  container: V1Container;
  namespace?: string;
  entries: EnvEntry[];
  isSecretVisible: (key: string) => boolean;
  onToggleSecret: (key: string) => void;
}

const ContainerSection = ({
  container,
  namespace,
  entries,
  isSecretVisible,
  onToggleSecret,
}: ContainerSectionProps) => {
  const containerName = container.name || 'unnamed';
  const idKey = `${namespace}/${containerName}`;
  const [isOpen, setIsOpen] = useState(false);
  const hasEntries = entries.length > 0;

  useEffect(() => {
    setIsOpen(false);
  }, [containerName, namespace, entries]);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <div className="px-4 pt-3">
        {hasEntries && (
          <button
            type="button"
            onClick={toggle}
            className="mb-2 flex items-center space-x-1 text-gray-400 hover:text-gray-200"
            title={isOpen ? 'Collapse' : 'Expand'}
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span>
              {entries.length} environment variable{entries.length !== 1 ? 's' : ''}
            </span>
          </button>
        )}
      </div>

      {isOpen || !hasEntries ? (
        <Table>
          <colgroup>
            <col className="w-auto" />
            <col className="w-auto" />
            <col className="w-32" />
          </colgroup>
          <Tbody>
            <Tr>
              <Td colSpan={3} className="font-medium text-white">
                Container: {containerName}
              </Td>
            </Tr>
            {entries.length === 0 ? (
              <Tr>
                <Td colSpan={3} className="text-white/60">
                  No environment variables
                </Td>
              </Tr>
            ) : (
              entries.map((entry, idx) => (
                <EnvRow
                  key={`${entry.name}-${idx}`}
                  entry={entry}
                  idKey={`${idKey}/${entry.name}-${idx}`}
                  isSecretVisible={isSecretVisible}
                  onToggleSecret={onToggleSecret}
                />
              ))
            )}
          </Tbody>
        </Table>
      ) : null}
    </div>
  );
};

interface InlineEnvSectionProps {
  container?: V1Container;
  namespace?: string;
  entries: EnvEntry[];
  isSecretVisible: (key: string) => boolean;
  onToggleSecret: (key: string) => void;
}

const InlineEnvSection = ({
  container,
  namespace,
  entries,
  isSecretVisible,
  onToggleSecret,
}: InlineEnvSectionProps) => {
  const containerName = container?.name || '';
  const idKey = `${namespace}/${containerName}`;

  const [isOpen, setIsOpen] = useState(false);
  const hasEntries = entries.length > 0;

  useEffect(() => {
    setIsOpen(false);
  }, [containerName, namespace, entries]);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <div className="flex w-full min-w-0 flex-col">
      {hasEntries && (
        <button
          type="button"
          onClick={toggle}
          className="mb-1 flex items-center space-x-1 text-gray-400 hover:text-gray-200"
          title={isOpen ? 'Collapse' : 'Expand'}
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span>
            {entries.length} environment variable{entries.length !== 1 ? 's' : ''}
          </span>
        </button>
      )}

      <div>
        {isOpen || !hasEntries ? (
          <Table>
            <Tbody>
              {entries.length === 0 ? (
                <Tr>
                  <Td colSpan={3} className="text-white/60">
                    No environment variables
                  </Td>
                </Tr>
              ) : (
                entries.map((entry, idx) => (
                  <EnvRow
                    key={`${entry.name}-${idx}`}
                    entry={entry}
                    idKey={`${idKey}/${entry.name}-${idx}`}
                    isSecretVisible={isSecretVisible}
                    onToggleSecret={onToggleSecret}
                  />
                ))
              )}
            </Tbody>
          </Table>
        ) : null}
      </div>
    </div>
  );
};

export function SidebarEnvSection({
  contextName,
  namespace,
  containers = [],
  variant = 'section',
}: SidebarEnvSectionProps) {
  const { configMaps, secrets } = useEnvSources(contextName, namespace);
  const { toggleSecret, isSecretVisible } = useSecretVisibility();

  const envByContainer = useMemo(() => {
    const result: Record<string, EnvEntry[]> = {};

    containers.forEach((container) => {
      const containerName = container.name || 'unnamed';
      result[containerName] = processContainerEnv(container, configMaps, secrets);
    });

    return result;
  }, [containers, configMaps, secrets]);

  if (containers.length === 0) {
    return <div className="py-2 text-white/60">No environment variables</div>;
  }

  if (variant === 'inline') {
    const container = containers[0];
    const entries = envByContainer[container.name || ''] || [];

    return (
      <InlineEnvSection
        container={container}
        namespace={namespace}
        entries={entries}
        isSecretVisible={isSecretVisible}
        onToggleSecret={toggleSecret}
      />
    );
  }

  return (
    <div className="space-y-4">
      {containers.map((container) => {
        const containerName = container.name || 'unnamed';
        const entries = envByContainer[containerName] || [];

        return (
          <ContainerSection
            key={containerName}
            container={container}
            namespace={namespace}
            entries={entries}
            isSecretVisible={isSecretVisible}
            onToggleSecret={toggleSecret}
          />
        );
      })}
    </div>
  );
}
