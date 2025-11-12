import { useEffect, useMemo, useState, useCallback } from 'react';
import { parse } from 'yaml';
import { YamlEditor } from './YamlEditor';
import { ButtonCancel } from './ButtonCancel';
import { ButtonSave } from './ButtonSave';
import { YamlEditorProps } from '@/types/yaml';
import { startResizing } from '@/utils/resizing';
import { ButtonExpand } from './ButtonExpand';

export default function BottomYamlEditor({
  open,
  title,
  mode,
  initialYaml,
  onClose,
  onSave,
  headerChildren,
}: YamlEditorProps) {
  const [yamlText, setYamlText] = useState(initialYaml);
  const [yamlError, setYamlError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [editorHeight, setEditorHeight] = useState(() => window.innerHeight * 0.5);
  const [isExpanded, setIsExpanded] = useState(false);

  const onResize = useCallback(
    (e: React.MouseEvent) => {
      startResizing(
        e,
        {
          getCurrentSize: () => editorHeight,
          setSize: setEditorHeight,
          minSize: 200,
          maxSize: window.innerHeight * 0.9,
          axis: 'vertical',
        },
        setIsResizing
      );
    },
    [editorHeight]
  );

  useEffect(() => {
    if (open) {
      setYamlText(initialYaml);
      setYamlError(null);
      setEditorHeight(window.innerHeight * 0.5);
      setIsExpanded(false);
    }
  }, [open, initialYaml]);

  const canSave = useMemo(() => {
    const trimmed = yamlText.trim();
    const basicConditions = !yamlError && trimmed.length > 0 && !saving;

    if (mode === 'view') {
      return false;
    } else if (mode === 'create') {
      return basicConditions;
    } else {
      return basicConditions && trimmed !== initialYaml.trim();
    }
  }, [yamlError, yamlText, saving, initialYaml, mode]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    try {
      setSaving(true);
      const manifest = parse(yamlText);
      await onSave(manifest);
      onClose();
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  }, [canSave, yamlText, onSave, onClose]);

  const toggleExpand = useCallback(() => {
    if (isExpanded) {
      setEditorHeight(window.innerHeight * 0.5);
    } else {
      setEditorHeight(window.innerHeight - 40);
    }
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose();
    },
    [onClose]
  );

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const displayTitle = useMemo(() => title ?? 'YAML Editor', [title]);

  const containerClass = useMemo(
    () =>
      `fixed right-0 bottom-0 left-0 z-[60] border-l border-white/10 bg-neutral-900/95 shadow-xl backdrop-blur-sm transition-transform duration-300 ${
        isResizing ? 'select-none' : ''
      }`,
    [isResizing]
  );

  if (!open) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-[55] bg-black/40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleBackdropClick}
      />

      <div
        className={containerClass}
        style={{ height: `${editorHeight}px` }}
        onClick={handleContainerClick}
      >
        <div
          className="absolute top-0 right-0 left-0 h-2 cursor-ns-resize bg-transparent hover:bg-white/10 active:bg-white/20"
          onMouseDown={onResize}
        />

        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <div className="min-w-0 truncate text-sm font-medium text-white/80">{displayTitle}</div>
          <div className="min-w-0 flex-1">{headerChildren}</div>
        <div className="flex items-center gap-2">
          <ButtonCancel onClick={onClose} disabled={saving} />
          {mode !== 'view' && (
            <ButtonSave onClick={handleSave} disabled={!canSave} loading={saving} />
          )}
          <ButtonExpand onClick={toggleExpand} isExpanded={isExpanded} />
        </div>
      </div>

        <div className="h-[calc(100%-49px)] p-4">
          <YamlEditor
            value={yamlText}
            onChange={setYamlText}
            heightClass="h-full"
            readOnly={mode === 'view'}
            onError={setYamlError}
          />
        </div>
      </div>
    </>
  );
}
