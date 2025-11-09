export type YamlEditorMode = 'create' | 'edit' | 'view';

export interface YamlEditorProps {
  open: boolean;
  title?: string;
  mode: YamlEditorMode;
  initialYaml: string;
  onClose: () => void;
  onSave: (manifest: any) => Promise<void> | void;
  // Optional extra controls to render in the editor header (e.g., form inputs)
  headerChildren?: React.ReactNode;
}
