import type { V1ConfigMap } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import { ButtonEdit } from '@/components/common/ButtonEdit';
import { ButtonTrash } from '@/components/common/ButtonTrash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { updateConfigMap } from '@/api/k8s/configMaps';
import { useKeyValueEditor } from '@/hooks/useKeyValueEditor';
import { KeyValueEditor } from '@/components/common/KeyValueEditor';
import { useSaveShortcut } from '@/hooks/useSaveShortcut';
import { useAutoSaveOnOutsideClick } from '@/hooks/useAutoSaveOnOutsideClick';

interface SidebarConfigMapsProps {
  item: V1ConfigMap | null;
  setItem: (item: V1ConfigMap | null) => void;
  onDelete?: (item: V1ConfigMap) => void;
  onEdit?: (item: V1ConfigMap) => void;
  onUpdate?: (manifest: V1ConfigMap) => Promise<V1ConfigMap | undefined>;
  contextName?: string;
  updating?: boolean;
  deleting?: boolean;
}

export function SidebarConfigMaps({
  item,
  setItem,
  onDelete,
  onEdit,
  onUpdate,
  contextName,
  updating = false,
  deleting = false,
}: SidebarConfigMapsProps) {
  const kv = useKeyValueEditor();
  const [saving, setSaving] = useState(false);
  const loadedSnapshotRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const initial = item?.data ? { ...item.data } : {};
    kv.load(initial);
    loadedSnapshotRef.current = initial;
  }, [item, kv]);

  const editedData = kv.editedData;

  const isDirty = useMemo(() => {
    const a = editedData;
    const b = loadedSnapshotRef.current;
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return true;
    for (const k of aKeys) {
      if (a[k] !== b[k]) return true;
    }
    return false;
  }, [editedData]);

  const canSave = useMemo(
    () => !!item && !!contextName && !updating && !deleting && !saving,
    [item, contextName, updating, deleting, saving]
  );

  const handleSave = useCallback(async () => {
    if (!item || !contextName) return;
    try {
      setSaving(true);
      const manifest: V1ConfigMap = {
        ...item,
        data: { ...kv.editedData },
      };
      const result =
        (onUpdate && (await onUpdate(manifest))) ||
        (await updateConfigMap({
          name: contextName,
          namespace: item.metadata?.namespace || '',
          manifest,
        }));
      setItem(result ?? manifest);
    } catch (error) {
      console.error('Failed to update ConfigMap:', error);
      toast.error('Failed to update ConfigMap');
    } finally {
      setSaving(false);
    }
  }, [item, contextName, kv.editedData, setItem, onUpdate]);

  useSaveShortcut(canSave && !saving, handleSave);

  const editorRef = useRef<HTMLDivElement>(null);
  useAutoSaveOnOutsideClick(canSave && isDirty, editorRef, handleSave);

  const renderProperties = (cm: V1ConfigMap) => (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-1/4" />
          <col className="w-3/4" />
        </colgroup>
        <Tbody>
          <Tr>
            <Td>Name</Td>
            <Td className="break-all text-white">{cm.metadata?.name ?? '-'}</Td>
          </Tr>

          <Tr>
            <Td>Age</Td>
            <AgeCell timestamp={cm.metadata?.creationTimestamp ?? ''} />
          </Tr>

          <Tr>
            <Td>Namespace</Td>
            <Td>
              <BadgeNamespaces name={cm.metadata?.namespace ?? ''} />
            </Td>
          </Tr>

          <TableYamlRow label="Labels" data={cm.metadata?.labels} maxWidthClass="lg" />
          <TableYamlRow label="Annotations" data={cm.metadata?.annotations} maxWidthClass="xl" />

          <TableYamlRow label="Binary Data" data={cm.binaryData} maxWidthClass="xl" />
        </Tbody>
      </Table>
    </div>
  );

  const renderEditableData = () => (
    <div ref={editorRef}>
      <KeyValueEditor hook={kv} saving={saving} />
    </div>
  );

  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1ConfigMap) => renderProperties(i),
          headerRight: (
            _i: V1ConfigMap,
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
      eventsProps={
        item
          ? {
              contextName,
              namespace: item?.metadata?.namespace,
              resourceKind: 'ConfigMap',
              resourceName: item?.metadata?.name,
            }
          : undefined
      }
      onDelete={onDelete}
      onEdit={onEdit}
      updating={updating || saving}
      deleting={deleting}
      showDefaultActions={false}
      requireDeleteConfirmation={true}
    />
  );
}
