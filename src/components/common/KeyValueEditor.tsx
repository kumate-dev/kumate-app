import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ButtonTrash } from '@/components/common/ButtonTrash';
import { ButtonAdd } from '@/components/common/ButtonAdd';
import { useKeyValueEditor } from '@/hooks/useKeyValueEditor';
import { IconEye } from '@/components/common/IconEye';

export interface KeyValueEditorProps {
  hook: ReturnType<typeof useKeyValueEditor>;
  saving?: boolean;
  canSave?: boolean;
  onSave?: () => void | Promise<void>;
  inputType?: 'text' | 'password';
  perEntryMaskToggle?: boolean;
}

export const KeyValueEditor: React.FC<KeyValueEditorProps> = ({
  hook,
  saving = false,
  canSave = false,
  onSave,
  inputType = 'text',
  perEntryMaskToggle = false,
}) => {
  const {
    editedData,
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
  } = hook;

  const entriesCount = Object.keys(editedData).length;

  const [maskedByKey, setMaskedByKey] = useState<Record<string, boolean>>({});
  const [newValueMasked, setNewValueMasked] = useState(true);

  useEffect(() => {
    setMaskedByKey((prev) => {
      const next = { ...prev } as Record<string, boolean>;
      for (const k of Object.keys(editedData)) if (next[k] === undefined) next[k] = true;
      for (const k of Object.keys(next)) if (editedData[k] === undefined) delete next[k];
      return next;
    });
  }, [editedData]);

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5 p-2">
      <div className="mb-2 flex items-center justify-end">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleToggleAddKey}>
            {isAdding ? 'Cancel' : 'Add key'}
          </Button>
          {onSave && (
            <Button onClick={() => onSave()} disabled={!canSave}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
        {entriesCount === 0 && (
          <div className="text-sm text-white/60">No data entries. Add one to begin.</div>
        )}
        {isAdding && (
          <div className="rounded border border-white/10 bg-neutral-900/60 p-3">
            <div className="mb-2 grid grid-cols-2 items-start gap-2">
              <div>
                <label className="text-xs text-white/60">Key name</label>
                <input
                  className="h-9 w-full rounded border border-white/10 bg-neutral-800/80 px-2 py-1 text-sm text-white outline-none focus:border-white/20"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (isAddValid) handleConfirmAddKey();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      handleToggleAddKey();
                    }
                  }}
                  placeholder="MY_KEY"
                  ref={newKeyNameRef}
                />
                {!newKeyName.trim() && (
                  <p className="mt-1 text-xs text-white/50">Enter a key name</p>
                )}
                {newKeyName.trim() && editedData[newKeyName.trim()] !== undefined && (
                  <p className="mt-1 text-xs text-red-300">Key already exists</p>
                )}
              </div>
              <div>
                <label className="text-xs text-white/60">Value</label>
                <div className="flex items-center gap-2">
                  <div className="relative w-full">
                    <textarea
                      className={`h-9 w-full resize-y rounded border border-white/10 bg-neutral-800/80 px-2 py-1 text-sm text-white outline-none focus:border-white/20 ${
                        perEntryMaskToggle && newValueMasked
                          ? 'secret-masked overflow-x-auto overflow-y-hidden whitespace-nowrap'
                          : 'overflow-auto'
                      }`}
                      value={newKeyValue}
                      onChange={(e) => setNewKeyValue(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                          e.preventDefault();
                          if (isAddValid) handleConfirmAddKey();
                        }
                      }}
                      placeholder=""
                      rows={1}
                    />
                  </div>
                  {perEntryMaskToggle && (
                    <button
                      type="button"
                      onClick={() => setNewValueMasked((v) => !v)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-white/10 bg-neutral-800/80 hover:border-white/20"
                      title={newValueMasked ? 'Reveal value' : 'Hide value'}
                      aria-label={newValueMasked ? 'Reveal value' : 'Hide value'}
                    >
                      <IconEye masked={newValueMasked} className="h-4 w-4" onClick={() => {}} />
                    </button>
                  )}
                  <ButtonAdd onClick={handleConfirmAddKey} disabled={!isAddValid} />
                </div>
              </div>
            </div>
          </div>
        )}

        {Object.entries(editedData).map(([key, value]) => (
          <div key={key} className="rounded border border-white/10 bg-neutral-900/60 p-3">
            <div className="mb-2 grid grid-cols-2 items-start gap-2">
              <div>
                <label className="text-xs text-white/60">Key name</label>
                <input
                  className="h-9 w-full rounded border border-white/10 bg-neutral-800/80 px-2 py-1 text-sm text-white outline-none focus:border-white/20"
                  value={renameDrafts[key] ?? key}
                  onChange={(e) => handleKeyNameChange(key, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const result = commitRename(key);
                      if (!result.ok) cancelRename(key);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelRename(key);
                    }
                  }}
                  onBlur={() => commitRename(key)}
                />
                {renameDrafts[key] &&
                  editedData[renameDrafts[key].trim()] !== undefined &&
                  renameDrafts[key].trim() !== key && (
                    <p className="mt-1 text-xs text-red-300">Key already exists</p>
                  )}
              </div>
              <div>
                <label className="text-xs text-white/60">Value</label>
                <div className="flex items-center gap-2">
                  <div className="relative w-full">
                    <textarea
                      className={`h-9 w-full resize-y rounded border border-white/10 bg-neutral-800/80 px-2 py-1 text-sm text-white outline-none focus:border-white/20 ${
                        perEntryMaskToggle && maskedByKey[key]
                          ? 'secret-masked overflow-x-auto overflow-y-hidden whitespace-nowrap'
                          : 'overflow-auto'
                      }`}
                      value={value}
                      onChange={(e) => handleDataChange(key, e.target.value)}
                      rows={1}
                    />
                  </div>
                  {perEntryMaskToggle && (
                    <button
                      type="button"
                      onClick={() => setMaskedByKey((prev) => ({ ...prev, [key]: !prev[key] }))}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-white/10 bg-neutral-800/80 hover:border-white/20"
                      title={maskedByKey[key] ? 'Reveal value' : 'Hide value'}
                      aria-label={maskedByKey[key] ? 'Reveal value' : 'Hide value'}
                    >
                      <IconEye masked={!!maskedByKey[key]} className="h-4 w-4" onClick={() => {}} />
                    </button>
                  )}
                  <ButtonTrash onClick={() => handleRemoveKey(key)} disabled={saving} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
