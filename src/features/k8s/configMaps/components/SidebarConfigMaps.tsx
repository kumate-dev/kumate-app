import type { V1ConfigMap } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { updateConfigMap } from '@/api/k8s/configMaps';

interface SidebarConfigMapsProps {
  item: V1ConfigMap | null;
  setItem: (item: V1ConfigMap | null) => void;
  onDelete?: (item: V1ConfigMap) => void;
  onEdit?: (item: V1ConfigMap) => void;
  contextName?: string;
  updating?: boolean;
  deleting?: boolean;
}

export function SidebarConfigMaps({
  item,
  setItem,
  onDelete,
  onEdit,
  contextName,
  updating = false,
  deleting = false,
}: SidebarConfigMapsProps) {
  const [editedData, setEditedData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item?.data) {
      setEditedData({ ...item.data });
    } else {
      setEditedData({});
    }
  }, [item]);

  const handleDataChange = useCallback(
    (key: string, value: string) => {
      setEditedData((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleKeyRename = useCallback((oldKey: string, newKey: string) => {
    setEditedData((prev) => {
      const next = { ...prev };
      const val = next[oldKey];
      delete next[oldKey];
      next[newKey] = val ?? '';
      return next;
    });
  }, []);

  const handleRemoveKey = useCallback((key: string) => {
    setEditedData((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleAddKey = useCallback(() => {
    const base = 'NEW_KEY';
    let idx = 1;
    let candidate = base;
    const existing = new Set(Object.keys(editedData));
    while (existing.has(candidate)) {
      candidate = `${base}_${idx++}`;
    }
    setEditedData((prev) => ({ ...prev, [candidate]: '' }));
  }, [editedData]);

  const canSave = useMemo(() => !!item && !!contextName && !updating && !deleting && !saving, [item, contextName, updating, deleting, saving]);

  const handleSave = useCallback(async () => {
    if (!item || !contextName) return;
    try {
      setSaving(true);
      const manifest: V1ConfigMap = {
        ...item,
        data: { ...editedData },
      };
      const result = await updateConfigMap({
        name: contextName,
        namespace: item.metadata?.namespace || '',
        manifest,
      });
      toast.success('ConfigMap updated');
      setItem(result ?? manifest);
    } catch (error) {
      console.error('Failed to update ConfigMap:', error);
      toast.error('Failed to update ConfigMap');
    } finally {
      setSaving(false);
    }
  }, [item, contextName, editedData, setItem]);

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
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5 p-2">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium text-white/80">Data entries</h4>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleAddKey} disabled={!item}>
            Add key
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
      <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
        {Object.keys(editedData).length === 0 && (
          <div className="text-sm text-white/60">No data entries. Add one to begin.</div>
        )}
        {Object.entries(editedData).map(([key, value]) => (
          <div key={key} className="rounded border border-white/10 bg-neutral-900/60 p-2">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-white/60">Key</span>
              <input
                className="flex-1 rounded border border-white/10 bg-neutral-800/80 px-2 py-1 text-sm text-white outline-none focus:border-white/20"
                value={key}
                onChange={(e) => handleKeyRename(key, e.target.value)}
              />
              <Button
                variant="ghost"
                className="text-red-300 hover:text-red-400"
                onClick={() => handleRemoveKey(key)}
                disabled={saving}
              >
                Remove
              </Button>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs text-white/60">Value</span>
              <textarea
                className="min-h-[80px] flex-1 rounded border border-white/10 bg-neutral-800/80 px-2 py-1 text-sm text-white outline-none focus:border-white/20"
                value={value}
                onChange={(e) => handleDataChange(key, e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1ConfigMap) => renderProperties(i),
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
    />
  );
}
