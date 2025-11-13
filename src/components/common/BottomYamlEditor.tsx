import { useEffect, useMemo, useState, useCallback } from 'react';
import { parse } from 'yaml';
import { YamlEditor } from './YamlEditor';
import { ButtonCancel } from './ButtonCancel';
import { ButtonSave } from './ButtonSave';
import { YamlEditorProps } from '@/types/yaml';
import { startResizing } from '@/utils/resizing';
import { ButtonExpand } from './ButtonExpand';
import { Search } from '@/components/common/Search';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [isRegex, setIsRegex] = useState(false);

  const matchesCount = useMemo(() => {
    if (!searchQuery.trim()) return 0;
    try {
      const source = isRegex ? searchQuery : searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flags = isCaseSensitive ? 'g' : 'gi';
      const pattern = new RegExp(source, flags);
      return (yamlText.match(pattern) || []).length;
    } catch {
      return 0;
    }
  }, [yamlText, searchQuery, isCaseSensitive, isRegex]);

  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery]);

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
          <div
            className="min-w-0 flex-1 flex items-center gap-2"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                  matchesCount > 0 && setCurrentMatchIndex((i) => (i - 1 + matchesCount) % matchesCount);
                } else {
                  matchesCount > 0 && setCurrentMatchIndex((i) => (i + 1) % matchesCount);
                }
              }
            }}
          >
            {headerChildren}
            <Search query={searchQuery} onQueryChange={setSearchQuery} className="max-w-xs min-w-0 flex-shrink" />
            <div className="flex items-center gap-1 text-xs text-white/70">
              <label className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-white/10">
                <input type="checkbox" checked={isCaseSensitive} onChange={(e) => setIsCaseSensitive(e.target.checked)} />
                <span title="Match case">Aa</span>
              </label>
              <label className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-white/10">
                <input type="checkbox" checked={isRegex} onChange={(e) => setIsRegex(e.target.checked)} />
                <span title="Regex">.*</span>
              </label>
              <button
                type="button"
                className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-50"
                onClick={() => matchesCount > 0 && setCurrentMatchIndex((i) => (i - 1 + matchesCount) % matchesCount)}
                disabled={matchesCount === 0}
                aria-label="Previous match"
                title="Previous match"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>{matchesCount > 0 ? currentMatchIndex + 1 : 0}/{matchesCount}</span>
              <button
                type="button"
                className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-50"
                onClick={() => matchesCount > 0 && setCurrentMatchIndex((i) => (i + 1) % matchesCount)}
                disabled={matchesCount === 0}
                aria-label="Next match"
                title="Next match"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
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
            searchQuery={searchQuery}
            currentMatchIndex={matchesCount > 0 ? currentMatchIndex : -1}
            isCaseSensitive={isCaseSensitive}
            isRegex={isRegex}
          />
        </div>
      </div>
    </>
  );
}
