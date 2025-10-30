import { useEffect, useMemo, useState, useRef } from 'react';
import yaml from 'js-yaml';
import { YamlEditor } from './YamlEditor';
import { ButtonCancel } from './ButtonCancel';
import { ButtonSave } from './ButtonSave';
import { YamlEditorProps } from '@/types/yaml';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

  const editorRef = useRef<HTMLDivElement>(null);

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
      const manifest = yaml.load(yamlText);
      await onSave(manifest);
      onClose();
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startY = e.clientY;
    const startHeight = editorHeight;

    const handleMouseMove = (e: MouseEvent) => {
      const newHeight = startHeight + (startY - e.clientY);
      const minHeight = 200;
      const maxHeight = window.innerHeight * 0.9;
      setEditorHeight(Math.min(Math.max(newHeight, minHeight), maxHeight));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
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
        ref={editorRef}
        className={`fixed right-0 bottom-0 left-0 z-[60] border-t border-white/10 bg-neutral-950 transition-transform duration-300 ${
          isResizing ? 'select-none' : ''
        }`}
        style={{ height: `${editorHeight}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute top-0 right-0 left-0 h-2 cursor-ns-resize bg-transparent hover:bg-white/10 active:bg-white/20"
          onMouseDown={startResizing}
        />

        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
          <div className="min-w-0 flex-1 truncate text-sm text-white/80">
            {title ?? 'YAML Editor'}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-white/70 hover:text-white"
              onClick={toggleExpand}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>

            <ButtonCancel onCancel={onClose} disabled={saving} />
            <ButtonSave
              onSave={handleSave}
              disabled={!canSave}
              text={saving ? 'Saving...' : 'Save'}
            />
          </div>
        </div>

        <div className="h-full p-3" style={{ height: `calc(100% - 41px)` }}>
          <YamlEditor
            value={yamlText}
            onChange={setYamlText}
            height="100%"
            readOnly={false}
            onError={setYamlError}
          />
        </div>
      </div>
    </>
  );
}
