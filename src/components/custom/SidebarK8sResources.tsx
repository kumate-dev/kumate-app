import { useState, useEffect, ReactNode } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BubbleTrash } from './BubbleTrash';
import { ModalConfirmDelete } from './ModalConfirmDelete';

export interface SidebarK8sResourcesProps<T> {
  item: T | null;
  setItem: (item: T | null) => void;
  width?: string;
  sections?: {
    key: string;
    title: string;
    content: (item: T) => ReactNode;
  }[];
  onDelete?: (item: T) => void;
}

export function SidebarK8sResources<T>({
  item,
  setItem,
  width = '500px',
  sections = [],
  onDelete,
}: SidebarK8sResourcesProps<T>) {
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({});
  const [visible, setVisible] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);

  useEffect(() => {
    if (item) setVisible(true);
  }, [item]);

  const closeSidebar = () => {
    setVisible(false);
    setTimeout(() => setItem(null), 300);
  };

  const handleConfirmDelete = () => {
    if (!item || !onDelete) return;
    onDelete(item);
    setOpenDeleteModal(false);
    closeSidebar();
  };

  if (!item && !visible) return null;

  const toggleSection = (key: string) => {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 cursor-default bg-black/40 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeSidebar}
      />

      <div
        className={`fixed top-0 right-0 z-50 flex h-full transform cursor-auto flex-col border-l border-white/10 bg-neutral-900/95 shadow-xl transition-transform duration-300 ease-in-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 justify-end border-b border-white/10">
          <Button variant="ghost" className="text-white/70" onClick={closeSidebar}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto p-4">
          {sections.map((section) => (
            <div key={section.key}>
              <h3
                className="mb-2 flex cursor-pointer items-center justify-between text-white/80 select-none"
                onClick={() => toggleSection(section.key)}
              >
                <span>{section.title}</span>
                {sectionsOpen[section.key] ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </h3>

              {item && sectionsOpen[section.key] !== false && (
                <div className="space-y-2">{section.content(item)}</div>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-shrink-0 justify-end gap-2 border-t border-white/10 p-4">
          {onDelete && <BubbleTrash onDelete={() => setOpenDeleteModal(true)} />}
        </div>
      </div>

      {onDelete && item && (
        <ModalConfirmDelete
          open={openDeleteModal}
          setOpen={setOpenDeleteModal}
          items={[item]}
          onConfirm={handleConfirmDelete}
          title="Confirm Delete"
        />
      )}
    </>
  );
}
