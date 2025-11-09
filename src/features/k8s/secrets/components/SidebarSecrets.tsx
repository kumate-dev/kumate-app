import type { V1Secret } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import { ButtonEdit } from '@/components/common/ButtonEdit';
import { ButtonTrash } from '@/components/common/ButtonTrash';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getSecretTypeStatus } from '../utils/secretTypeStatus';
import { useKeyValueEditor } from '@/hooks/useKeyValueEditor';
import { KeyValueEditor } from '@/components/common/KeyValueEditor';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { updateSecret } from '@/api/k8s/secrets';
import { toast } from 'sonner';
import { decodeBase64 } from '@/utils/base64';
import { useSaveShortcut } from '@/hooks/useSaveShortcut';
import { useAutoSaveOnOutsideClick } from '@/hooks/useAutoSaveOnOutsideClick';

interface SidebarSecretsProps {
  item: V1Secret | null;
  setItem: (item: V1Secret | null) => void;
  onDelete?: (item: V1Secret) => void;
  onEdit?: (item: V1Secret) => void;
  onUpdate?: (manifest: V1Secret) => Promise<V1Secret | undefined>;
  contextName?: string;
  updating?: boolean;
  deleting?: boolean;
}

export function SidebarSecrets({
  item,
  setItem,
  onDelete,
  onEdit,
  onUpdate,
  contextName,
  updating = false,
  deleting = false,
}: SidebarSecretsProps) {
  const kv = useKeyValueEditor();
  const [saving, setSaving] = useState(false);
  const loadedSnapshotRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!item) {
      kv.load({});
      loadedSnapshotRef.current = {};
      return;
    }
    const decodedEntries = item.data
      ? Object.fromEntries(
          Object.entries(item.data).map(([k, v]) => [k, decodeBase64(v as unknown as string)])
        )
      : {};
    const stringEntries = item.stringData ?? {};
    const initialEntries = { ...stringEntries, ...decodedEntries };
    kv.load({ ...initialEntries });
    loadedSnapshotRef.current = { ...initialEntries };
  }, [item, kv]);

  const isDirty = useMemo(() => {
    const a = kv.editedData;
    const b = loadedSnapshotRef.current;
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return true;
    for (const k of aKeys) {
      if (a[k] !== b[k]) return true;
    }
    return false;
  }, [kv.editedData]);

  const canSave = useMemo(
    () => !!item && !!contextName && !updating && !deleting && !saving,
    [item, contextName, updating, deleting, saving]
  );

  const handleSave = useCallback(async () => {
    if (!item || !contextName) return;
    try {
      setSaving(true);
      const encoded = Object.fromEntries(
        Object.entries(kv.editedData).map(([k, v]) => [k, btoa(v)])
      );
      const manifest: V1Secret = { ...item, data: encoded as any };
      const result =
        (onUpdate && (await onUpdate(manifest))) ||
        (await updateSecret({
          name: contextName,
          namespace: item.metadata?.namespace || '',
          manifest,
        }));
      setItem(result ?? manifest);
    } catch (error) {
      console.error('Failed to update Secret:', error);
      toast.error('Failed to update Secret');
    } finally {
      setSaving(false);
    }
  }, [item, contextName, kv.editedData, onUpdate, setItem]);

  useSaveShortcut(canSave && !saving, handleSave);

  const editorRef = useRef<HTMLDivElement>(null);
  useAutoSaveOnOutsideClick(canSave && isDirty, editorRef, handleSave);

  const renderProperties = (secret: V1Secret) => {
    return (
      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-1/4" />
            <col className="w-3/4" />
          </colgroup>
          <Tbody>
            <Tr>
              <Td>Name</Td>
              <Td className="break-all text-white">{secret.metadata?.name ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={secret.metadata?.creationTimestamp ?? ''} />
            </Tr>

            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={secret.metadata?.namespace ?? ''} />
              </Td>
            </Tr>

            <TableYamlRow label="Labels" data={secret.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow
              label="Annotations"
              data={secret.metadata?.annotations}
              maxWidthClass="xl"
            />

            <Tr>
              <Td>Type</Td>
              <Td>
                <BadgeStatus status={getSecretTypeStatus(secret)} />
              </Td>
            </Tr>

            <Tr>
              <Td>Immutable</Td>
              <Td>{secret.immutable ? 'true' : 'false'}</Td>
            </Tr>
            <TableYamlRow label="String Data" data={secret.stringData} maxWidthClass="xl" />
          </Tbody>
        </Table>
      </div>
    );
  };

  const renderEditableData = () => (
    <div className="space-y-2" ref={editorRef}>
      <KeyValueEditor hook={kv} saving={saving} perEntryMaskToggle />
    </div>
  );

  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1Secret) => renderProperties(i),
          headerRight: (
            _i: V1Secret,
            actions: {
              showDeleteModal: () => void;
              handleEdit: () => void;
              isEditDisabled: boolean;
              isDeleteDisabled: boolean;
            }
          ) => (
            <div className="flex items-center gap-2">
              <ButtonEdit
                onClick={actions.handleEdit}
                disabled={actions.isEditDisabled}
                loading={updating || saving}
              />
              <ButtonTrash
                onClick={actions.showDeleteModal}
                disabled={actions.isDeleteDisabled}
                loading={deleting}
              />
            </div>
          ),
        },
        {
          key: 'data',
          title: 'Data',
          content: () => renderEditableData(),
        },
      ]
    : [];

  return (
    <RightSidebarGeneric
      item={item}
      setItem={setItem}
      sections={sections}
      onDelete={onDelete}
      onEdit={onEdit}
      updating={updating || saving}
      deleting={deleting}
      showDefaultActions={false}
      requireDeleteConfirmation={true}
    />
  );
}
