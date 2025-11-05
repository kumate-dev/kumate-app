import { useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { X} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModalConfirmDelete } from '@/components/common/ModalConfirmDelete';
import { ButtonEdit } from '@/components/common/ButtonEdit';
import { ButtonTrash } from '@/components/common/ButtonTrash';
import { startResizing } from '@/utils/resizing';

export interface SidebarResourcesProps<T> {
  item: T | null;
  setItem: (item: T | null) => void;
  width?: number;
  sections?: {
    key: string;
    title: string;
    content: (item: T) => ReactNode;
  }[];
  onDelete?: (item: T) => void;
  onEdit?: (item: T) => void;
}

export function SidebarGeneric<T>({
  item,
  setItem,
  width = 550,
  sections = [],
  onDelete,
  onEdit,
}: SidebarResourcesProps<T>) {
  const [sidebarWidth, setSidebarWidth] = useState(width);
  const [isResizing, setIsResizing] = useState(false);
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

  const onResize = useCallback(
    (e: React.MouseEvent) => {
      startResizing(
        e,
        {
          getCurrentSize: () => sidebarWidth,
          setSize: setSidebarWidth,
          minSize: 200,
          maxSize: window.innerWidth * 0.9,
          axis: 'horizontal',
        },
        setIsResizing
      );
    },
    [sidebarWidth]
  );

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
          className="absolute top-0 left-0 h-full w-1 cursor-ew-resize bg-transparent hover:bg-white/10 active:bg-white/20"
          onMouseDown={onResize}
        />

        <div className="flex shrink-0 justify-end border-b border-white/10">
          <Button variant="ghost" className="text-white/70" onClick={closeSidebar}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto p-4">
          {sections.map((section) => (
            <div key={section.key}>
              <h3 className="mb-2 text-white/80">{section.title}</h3>

              {item && <div className="space-y-2">{section.content(item)}</div>}
            </div>
          ))}
        </div>

        <div className="flex flex-shrink-0 justify-between gap-2 border-t border-white/10 p-4">
          {onEdit && item && (
            <ButtonEdit
              onEdit={() => {
                onEdit(item);
                closeSidebar();
              }}
            />
          )}
          {onDelete && <ButtonTrash onDelete={() => setOpenDeleteModal(true)} />}
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
