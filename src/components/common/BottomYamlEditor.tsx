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

    if (mode === 'create') {
      return basicConditions;
    } else {
      return basicConditions && trimmed !== initialYaml.trim();
    }
  }, [yamlError, yamlText, saving, initialYaml, mode]);

  const handleSave = async () => {
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
  };

  const toggleExpand = () => {
    if (isExpanded) {
      setEditorHeight(window.innerHeight * 0.5);
    } else {
      setEditorHeight(window.innerHeight - 40);
    }
    setIsExpanded(!isExpanded);
  };

  if (!open) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-[55] bg-black/40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed right-0 bottom-0 left-0 z-[60] border-l border-white/10 bg-neutral-900/95 shadow-xl backdrop-blur-sm transition-transform duration-300 ${
          isResizing ? 'select-none' : ''
        }`}
        style={{ height: `${editorHeight}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute top-0 right-0 left-0 h-2 cursor-ns-resize bg-transparent hover:bg-white/10 active:bg-white/20"
          onMouseDown={onResize}
        />

        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-white/80">
            {title ?? 'YAML Editor'}
          </div>
          <div className="flex items-center gap-2">
            <ButtonCancel onCancel={onClose} disabled={saving} />
            <ButtonSave
              onSave={handleSave}
              disabled={!canSave}
              text={saving ? 'Saving...' : 'Save'}
            />
            <ButtonExpand onExpand={toggleExpand} isExpanded={isExpanded} />
          </div>
        </div>

        <div className="h-[calc(100%-49px)] p-4">
          <YamlEditor
            value={yamlText}
            onChange={setYamlText}
            heightClass="h-full"
            readOnly={false}
            onError={setYamlError}
          />
        </div>
      </div>
    </>
  );
}
