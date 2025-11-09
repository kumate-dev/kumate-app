import { useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModalDelete } from '@/components/common/ModalDelete';
import { ButtonEdit } from '@/components/common/ButtonEdit';
import { ButtonTrash } from '@/components/common/ButtonTrash';
import { startResizing } from '@/utils/resizing';
import { SidebarEventsSection } from '@/features/k8s/generic/components/SidebarEventsSection';

export interface SidebarResourcesProps<T> {
  item: T | null;
  setItem: (item: T | null) => void;
  width?: number;
  sections?: {
    key: string;
    title: string;
    content: (item: T) => ReactNode;
    headerRight?: (
      item: T,
      actions: {
        showDeleteModal: () => void;
        handleEdit: () => void;
        isEditDisabled: boolean;
        isDeleteDisabled: boolean;
      }
    ) => ReactNode;
  }[];
  eventsProps?: {
    title?: string;
    contextName?: string;
    namespace?: string;
    resourceKind?: string; // e.g., Pod, Deployment
    resourceName?: string;
  };
  onDelete?: (item: T) => void;
  onEdit?: (item: T) => void;
  updating?: boolean;
  deleting?: boolean;
  showDefaultActions?: boolean;
  requireDeleteConfirmation?: boolean;
  closeOnEdit?: boolean;
}

export function RightSidebarGeneric<T>({
  item,
  setItem,
  width = 550,
  sections = [],
  eventsProps,
  onDelete,
  onEdit,
  updating = false,
  deleting = false,
  showDefaultActions = true,
  requireDeleteConfirmation = true,
  closeOnEdit = true,
}: SidebarResourcesProps<T>) {
  const [sidebarWidth, setSidebarWidth] = useState(width);
  const [isResizing, setIsResizing] = useState(false);
  const [visible, setVisible] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);

  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (item) {
      setVisible(true);
    }
  }, [item]);

  const closeSidebar = useCallback(() => {
    setVisible(false);
    setTimeout(() => setItem(null), 300);
  }, [setItem]);

  const handleEdit = useCallback(() => {
    if (item && onEdit) {
      onEdit(item);
      if (closeOnEdit) {
        closeSidebar();
      }
    }
  }, [item, onEdit, closeOnEdit, closeSidebar]);

  const handleDeleteConfirm = useCallback(async () => {
    if (item && onDelete) {
      await onDelete(item);
      setOpenDeleteModal(false);
      closeSidebar();
    }
  }, [item, onDelete, closeSidebar]);

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

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      closeSidebar();
    },
    [closeSidebar]
  );

  const handleSidebarClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const showDeleteModal = useCallback(() => {
    setOpenDeleteModal(true);
  }, []);

  const showEditButton = !!onEdit;
  const showDeleteButton = !!onDelete;
  const isEditDisabled = !item || updating;
  const isDeleteDisabled = !item || deleting;

  const shouldShowSidebar = item || visible;

  if (!shouldShowSidebar) return null;

  const defaultActions = (
    <>
      {showEditButton && (
        <ButtonEdit onClick={handleEdit} disabled={isEditDisabled} loading={updating} />
      )}
      {showDeleteButton && (
        <ButtonTrash
          onClick={requireDeleteConfirmation ? showDeleteModal : handleDeleteConfirm}
          disabled={isDeleteDisabled}
          loading={deleting}
        />
      )}
    </>
  );

  return (
    <>
      <div
        className={`fixed inset-0 z-40 cursor-default bg-black/40 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleBackdropClick}
      />

      <div
        ref={sidebarRef}
        className={`fixed top-0 right-0 z-50 flex h-full transform cursor-auto flex-col overscroll-none border-l border-white/10 bg-neutral-900/95 shadow-xl transition-transform duration-300 ease-in-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        } ${isResizing ? 'select-none' : ''}`}
        style={{ width: `${sidebarWidth}px` }}
        onClick={handleSidebarClick}
      >
        <div
          className="absolute top-0 left-0 h-full w-1 cursor-ew-resize bg-transparent hover:bg-white/10 active:bg-white/20"
          onMouseDown={onResize}
        />

        <div className="flex shrink-0 justify-end border-b border-white/10">
          <Button
            variant="ghost"
            className="text-white/70 hover:bg-white/10 hover:text-white"
            onClick={closeSidebar}
            title="Close sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto overscroll-none px-4 pt-0 pb-4">
          {sections.map((section) => (
            <div key={section.key}>
              <div className="sticky top-0 z-10 mb-2 flex items-center justify-between border-b border-white/10 bg-neutral-900/95 px-4 py-2 backdrop-blur">
                <h3 className="font-medium text-white/80">{section.title}</h3>
                {item && (
                  <div className="flex items-center gap-2">
                    {section.headerRight &&
                      section.headerRight(item, {
                        showDeleteModal,
                        handleEdit,
                        isEditDisabled,
                        isDeleteDisabled,
                      })}
                    {showDefaultActions && defaultActions}
                  </div>
                )}
              </div>
              {item && <div className="space-y-2">{section.content(item)}</div>}
            </div>
          ))}

          {item &&
            eventsProps &&
            eventsProps.contextName &&
            eventsProps.resourceKind &&
            eventsProps.resourceName && (
              <div>
                <div className="sticky top-0 z-10 mb-2 flex items-center justify-between border-b border-white/10 bg-neutral-900/95 px-4 py-2 backdrop-blur">
                  <h3 className="font-medium text-white/80">{eventsProps.title || 'Events'}</h3>
                  {/* Intentionally no default actions in Events section to avoid duplication */}
                </div>
                <div className="space-y-2">
                  <SidebarEventsSection
                    contextName={eventsProps.contextName}
                    namespace={eventsProps.namespace}
                    resourceKind={eventsProps.resourceKind}
                    resourceName={eventsProps.resourceName}
                  />
                </div>
              </div>
            )}
        </div>

        {requireDeleteConfirmation && showDeleteButton && item && (
          <ModalDelete
            open={openDeleteModal}
            setOpen={setOpenDeleteModal}
            items={[item]}
            onConfirm={handleDeleteConfirm}
            title="Confirm Delete"
            loading={deleting}
          />
        )}
      </div>
    </>
  );
}
