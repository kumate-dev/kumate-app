export type YamlEditorMode = 'create' | 'edit';

export interface YamlEditorProps {
  open: boolean;
  title?: string;
  mode: YamlEditorMode;
  initialYaml: string;
  onClose: () => void;
  onSave: (manifest: any) => Promise<void> | void;
}
