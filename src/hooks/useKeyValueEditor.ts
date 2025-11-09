import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface UseKeyValueEditorOptions {
  keepAddOpen?: boolean;
}

export interface RenameResult {
  ok: boolean;
  error?: string;
}

export function useKeyValueEditor(
  initialEntries: Record<string, string> = {},
  options: UseKeyValueEditorOptions = {}
) {
  const { keepAddOpen = true } = options;

  const [editedData, setEditedData] = useState<Record<string, string>>({ ...initialEntries });
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>(() => {
    const drafts: Record<string, string> = {};
    for (const k of Object.keys(initialEntries)) drafts[k] = k;
    return drafts;
  });

  const [isAdding, setIsAdding] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const newKeyNameRef = useRef<HTMLInputElement>(null);

  const load = useCallback((entries: Record<string, string>) => {
    setEditedData({ ...entries });
    setRenameDrafts(() => {
      const drafts: Record<string, string> = {};
      for (const k of Object.keys(entries)) drafts[k] = k;
      return drafts;
    });
  }, []);

  const handleToggleAddKey = useCallback(() => {
    setIsAdding((v) => !v);
    setNewKeyName('');
    setNewKeyValue('');
  }, []);

  useEffect(() => {
    if (isAdding) {
      newKeyNameRef.current?.focus();
    }
  }, [isAdding]);

  const isAddValid = useMemo(() => {
    const key = newKeyName.trim();
    return !!key && editedData[key] === undefined;
  }, [newKeyName, editedData]);

  const handleConfirmAddKey = useCallback(() => {
    const key = newKeyName.trim();
    if (!key || editedData[key] !== undefined) return;
    setEditedData((prev) => ({ ...prev, [key]: newKeyValue }));
    setRenameDrafts((prev) => ({ ...prev, [key]: key }));
    setNewKeyName('');
    setNewKeyValue('');
    setIsAdding(keepAddOpen);
    if (keepAddOpen) newKeyNameRef.current?.focus();
  }, [newKeyName, newKeyValue, editedData, keepAddOpen]);

  const handleRemoveKey = useCallback((key: string) => {
    setEditedData((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setRenameDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleDataChange = useCallback((key: string, value: string) => {
    setEditedData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleKeyNameChange = useCallback((origKey: string, draft: string) => {
    setRenameDrafts((prev) => ({ ...prev, [origKey]: draft }));
  }, []);

  const cancelRename = useCallback((origKey: string) => {
    setRenameDrafts((prev) => ({ ...prev, [origKey]: origKey }));
  }, []);

  const commitRename = useCallback(
    (origKey: string): RenameResult => {
      const draft = (renameDrafts[origKey] ?? '').trim();
      if (!draft || draft === origKey) {
        cancelRename(origKey);
        return { ok: true };
      }
      if (editedData[draft] !== undefined) {
        cancelRename(origKey);
        return { ok: false, error: 'Key already exists' };
      }
      setEditedData((prev) => {
        const next = { ...prev };
        const value = next[origKey];
        delete next[origKey];
        next[draft] = value;
        return next;
      });
      setRenameDrafts((prev) => {
        const next = { ...prev };
        delete next[origKey];
        next[draft] = draft;
        return next;
      });
      return { ok: true };
    },
    [renameDrafts, editedData, cancelRename]
  );

  useEffect(() => {
    setRenameDrafts((prev) => {
      const next: Record<string, string> = { ...prev };
      for (const k of Object.keys(editedData)) if (next[k] === undefined) next[k] = k;
      for (const k of Object.keys(next)) if (editedData[k] === undefined) delete next[k];
      return next;
    });
  }, [editedData]);

  return {
    editedData,
    setEditedData,
    load,
    isAdding,
    handleToggleAddKey,
    newKeyName,
    setNewKeyName,
    newKeyValue,
    setNewKeyValue,
    newKeyNameRef,
    isAddValid,
    handleConfirmAddKey,
    handleRemoveKey,
    handleDataChange,
    renameDrafts,
    handleKeyNameChange,
    commitRename,
    cancelRename,
  };
}
