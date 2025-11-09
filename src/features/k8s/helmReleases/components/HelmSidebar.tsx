import { useCallback, useEffect, useMemo, useState } from 'react';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import BottomYamlEditor from '@/components/common/BottomYamlEditor';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/common/Dropdown';
import DropdownTrigger from '@/components/ui/dropdown';
import {
  getHelmValues,
  getHelmHistory,
  rollbackHelmRelease,
  type HelmHistoryEntry,
} from '@/api/k8s/helm';
import { toast } from 'sonner';
import { BadgeStatus } from '@/features/k8s/generic/components/BadgeStatus';
import { getHelmReleaseStatus } from '@/features/k8s/helmReleases/utils/helmStatus';

interface ReleaseItem {
  metadata?: { name?: string; namespace?: string };
  name?: string;
  namespace?: string;
  chart?: string;
  revision?: string;
  status?: string;
}

interface HelmSidebarProps {
  item: ReleaseItem | null;
  setItem: (item: ReleaseItem | null) => void;
  onDelete?: (item: ReleaseItem) => void;
  contextName?: string;
}

export function HelmSidebar({ item, setItem, onDelete, contextName }: HelmSidebarProps) {
  const [valuesYaml, setValuesYaml] = useState<string>('');
  const [openValuesEditor, setOpenValuesEditor] = useState(false);
  const [history, setHistory] = useState<HelmHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState<number | undefined>(undefined);
  const [performing, setPerforming] = useState(false);
  const releaseName = item?.metadata?.name ?? item?.name ?? '';
  const namespace = item?.metadata?.namespace ?? item?.namespace ?? undefined;

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      if (!item || !contextName || !releaseName) return;
      try {
        const [vals, hist] = await Promise.all([
          getHelmValues({ name: contextName, namespace, releaseName }),
          getHelmHistory({ name: contextName, namespace, releaseName }),
        ]);
        if (!cancelled) {
          setValuesYaml(vals);
          setHistory(hist);
          const latest =
            Array.isArray(hist) && hist.length > 0
              ? Math.max(...hist.map((h) => Number(h.revision)))
              : undefined;
          setSelectedRevision((prev) => (prev === undefined ? latest : prev));
        }
      } catch (err) {
        console.warn('Failed to load helm values/history:', err);
      }
    }
    setLoadingHistory(true);
    fetchData().finally(() => setLoadingHistory(false));
    return () => {
      cancelled = true;
    };
  }, [item?.metadata?.name, item?.metadata?.namespace, contextName, item, namespace, releaseName]);

  const onOpenEditValues = useCallback(() => {
    setOpenValuesEditor(true);
  }, []);

  const onSaveValues = useCallback(async (_manifest: Record<string, any>) => {
    // Temporarily disable Helm upgrade via FE
    toast.error('Upgrade Helm is temporarily disabled in Kumactl. Please use Helm CLI instead.');
  }, []);

  const onTriggerRollback = useCallback(
    async (revision: number) => {
      if (!contextName || !releaseName) return;
      setPerforming(true);
      try {
        await rollbackHelmRelease({ name: contextName, namespace, releaseName, revision });
        toast.success(`Rollback to ${revision} triggered`);
      } catch (err) {
        toast.error(`Rollback failed: ${err}`);
      } finally {
        setPerforming(false);
      }
    },
    [contextName, namespace, releaseName]
  );

  const valuesDisplayData = useMemo(() => {
    const trimmed = (valuesYaml || '').trim();
    return trimmed === '' || trimmed === 'null' ? null : valuesYaml;
  }, [valuesYaml]);

  const renderProperties = useCallback(() => {
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
              <Td className="break-all text-white">{releaseName || '-'}</Td>
            </Tr>
            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={namespace || ''} />
              </Td>
            </Tr>
            <Tr>
              <Td>Chart</Td>
              <Td className="break-all text-white">{item?.chart || '-'}</Td>
            </Tr>
            <Tr>
              <Td>Status</Td>
              <Td>
                <BadgeStatus status={getHelmReleaseStatus(item?.status || '')} />
              </Td>
            </Tr>

            {false && <TableYamlRow label="Values" data={valuesDisplayData} maxWidthClass="xl" />}

            <Tr>
              <Td>History</Td>
              <Td className="align-middle">
                {loadingHistory ? (
                  <div className="text-white/70">Loading history...</div>
                ) : history.length === 0 ? (
                  <div className="text-white/70">-</div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Dropdown
                      trigger={
                        <DropdownTrigger
                          key={`rev-${selectedRevision ?? 'none'}`}
                          label={
                            selectedRevision ? `Revision ${selectedRevision}` : 'Select revision'
                          }
                          className="w-56"
                        />
                      }
                    >
                      {history.slice(0, 20).map((h) => (
                        <div
                          key={h.revision}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-white/10"
                          onClick={() => setSelectedRevision(Number(h.revision))}
                        >
                          <span className="inline-flex w-14 shrink-0 items-center justify-center rounded bg-white/10 px-2 py-0.5 text-xs text-white tabular-nums">
                            {h.revision}
                          </span>
                          <span className="inline-flex min-w-0 items-center gap-2 truncate text-xs text-white/80">
                            <BadgeStatus status={getHelmReleaseStatus(h.status)} />
                            <span className="truncate text-white/70">{h.updated ?? ''}</span>
                          </span>
                        </div>
                      ))}
                    </Dropdown>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-w-[96px] px-3"
                      onClick={() =>
                        selectedRevision && onTriggerRollback(Number(selectedRevision))
                      }
                      disabled={!selectedRevision || performing}
                    >
                      Rollback
                    </Button>
                  </div>
                )}
              </Td>
            </Tr>
          </Tbody>
        </Table>
      </div>
    );
  }, [
    releaseName,
    namespace,
    item?.chart,
    item?.status,
    valuesDisplayData,
    loadingHistory,
    history,
    onTriggerRollback,
    performing,
    selectedRevision,
  ]);

  const sections = useMemo(() => {
    if (!item) return [];
    return [
      {
        key: 'properties',
        title: 'Properties',
        content: () => renderProperties(),
        headerRight: () => (
          <Button
            size="sm"
            variant="outline"
            className="min-w-[96px] px-3"
            onClick={onOpenEditValues}
          >
            View
          </Button>
        ),
      },
    ];
  }, [item, renderProperties, onOpenEditValues]);

  return (
    <>
      <RightSidebarGeneric
        item={item}
        setItem={setItem}
        sections={sections as any}
        onDelete={onDelete}
        // Disable Edit action in FE while upgrade is disabled
        onEdit={undefined}
        closeOnEdit={false}
      />

      <BottomYamlEditor
        open={openValuesEditor}
        title={`View Helm Values: ${releaseName}`}
        mode="view"
        initialYaml={valuesYaml}
        onClose={() => setOpenValuesEditor(false)}
        onSave={onSaveValues}
      />
    </>
  );
}
