import { useState, useEffect, ReactNode, useRef } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BubbleTrash } from './BubbleTrash';
import { ModalConfirmDelete } from './ModalConfirmDelete';

export interface SidebarK8sResourcesProps<T> {
  item: T | null;
  setItem: (item: T | null) => void;
  width?: number;
  tableRef?: React.RefObject<HTMLTableElement | null>;
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
  width = 550,
  tableRef,
  sections = [],
  onDelete,
}: SidebarK8sResourcesProps<T>) {
  const [sidebarWidth, setSidebarWidth] = useState(width);
  const [isResizing, setIsResizing] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({});
  const [visible, setVisible] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);

  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (item) setVisible(true);
  }, [item]);

  const closeSidebar = () => {
    setVisible(false);
    setTimeout(() => setItem(null), 300);
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const tableWidth = tableRef?.current?.offsetWidth ?? 1000;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = startWidth - (e.clientX - startX);
      setSidebarWidth(Math.min(Math.max(newWidth, 300), tableWidth));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const toggleSection = (key: string) => {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!item && !visible) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 cursor-default bg-black/40 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeSidebar}
      />

      <div
        ref={sidebarRef}
        className={`fixed top-0 right-0 z-50 flex h-full transform cursor-auto flex-col border-l border-white/10 bg-neutral-900/95 shadow-xl transition-transform duration-300 ease-in-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        } ${isResizing ? 'select-none' : ''}`}
        style={{ width: `${sidebarWidth}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute left-0 top-0 h-full w-1 cursor-ew-resize bg-transparent hover:bg-white/10 active:bg-white/20"
          onMouseDown={startResizing}
        />

        <div className="flex shrink-0 justify-end border-b border-white/10">
          <Button variant="ghost" className="text-white/70" onClick={closeSidebar}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto p-4">
          {sections.map((section) => (
            <div key={section.key}>
              <h3
                className="mb-2 flex cursor-pointer select-none items-center justify-between text-white/80"
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
          onConfirm={() => {
            if (!item || !onDelete) return;
            onDelete(item);
            setOpenDeleteModal(false);
            closeSidebar();
          }}
          title="Confirm Delete"
        />
      )}
    </>
  );
}
