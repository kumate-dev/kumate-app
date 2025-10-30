import { useEffect, useMemo, useState } from 'react';
import yaml from 'js-yaml';
import { YamlEditor } from './YamlEditor';
import { ButtonCancel } from './ButtonCancel';
import { ButtonSave } from './ButtonSave';

interface BottomYamlEditorProps {
  open: boolean;
  title?: string;
  mode: 'create' | 'edit';
  initialYaml: string;
  onClose: () => void;
  onSave: (manifest: any) => Promise<void> | void;
}

export default function BottomYamlEditor({
  open,
  title,
  mode,
  initialYaml,
  onClose,
  onSave,
}: BottomYamlEditorProps) {
  const [yamlText, setYamlText] = useState(initialYaml);
  const [yamlError, setYamlError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setYamlText(initialYaml);
      setYamlError(null);
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

  if (!open) return null;

  return (
    <div className="fixed right-0 bottom-0 left-0 z-[60] border-t border-white/10 bg-neutral-950">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
        <div className="min-w-0 flex-1 truncate text-sm text-white/80">
          {title ?? 'YAML Editor'}
        </div>
        <div className="flex items-center gap-2">
          <ButtonCancel onCancel={onClose} disabled={saving} />
          <ButtonSave
            onSave={handleSave}
            disabled={!canSave}
            text={saving ? 'Saving...' : 'Save'}
          />
        </div>
      </div>
      <div className="h-[320px] p-3">
        <YamlEditor
          value={yamlText}
          onChange={setYamlText}
          height="300px"
          readOnly={false}
          onError={setYamlError}
        />
      </div>
    </div>
  );
}
