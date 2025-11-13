import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { parse } from 'yaml';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';
import '@/styles/yaml-dark.css';

interface YamlEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  heightClass?: string;
  readOnly?: boolean;
  onError?: (error: string | null) => void;
  searchQuery?: string;
  currentMatchIndex?: number;
  isCaseSensitive?: boolean;
  isRegex?: boolean;
}

export function YamlEditor({
  value,
  onChange,
  height = '400px',
  heightClass,
  readOnly = false,
  onError,
  searchQuery,
  currentMatchIndex,
  isCaseSensitive = false,
  isRegex = false,
}: YamlEditorProps) {
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const lineNumbersContentRef = useRef<HTMLDivElement>(null);

  const validateYaml = useCallback(
    (yamlString: string) => {
      if (!yamlString.trim()) {
        setIsValid(true);
        setErrorMessage(null);
        onError?.(null);
        return;
      }

      try {
        parse(yamlString);
        setIsValid(true);
        setErrorMessage(null);
        onError?.(null);
      } catch (error) {
        setIsValid(false);
        const errorMsg = error instanceof Error ? error.message : 'Invalid YAML format';
        setErrorMessage(errorMsg);
        onError?.(errorMsg);
      }
    },
    [onError]
  );

  useEffect(() => {
    validateYaml(value);
  }, [value, validateYaml]);

  const lines = useMemo(() => {
    const lineCount = value.split('\n').length;
    return Array.from({ length: Math.max(1, lineCount) }, (_, i) => i + 1);
  }, [value]);

  const escapeRegExp = useCallback((s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), []);

  const highlightedHtml = useMemo(() => {
    const code = value || '';
    try {
      let html = Prism.highlight(code, Prism.languages.yaml, 'yaml');
      if (searchQuery && searchQuery.trim()) {
        let source = searchQuery;
        if (!isRegex) {
          source = escapeRegExp(source);
        }
        const flags = isCaseSensitive ? 'g' : 'gi';
        const pattern = new RegExp(source, flags);
        let idx = 0;
        html = html.replace(pattern, (m) => {
          const markClass = 'bg-yellow-300 text-black';
          const out = `<mark data-idx="${idx}" class="${markClass}">${m}</mark>`;
          idx += 1;
          return out;
        });
      }
      return html;
    } catch (error) {
      console.warn('Prism highlighting failed:', error);
      return code;
    }
  }, [value, searchQuery, escapeRegExp, isCaseSensitive, isRegex]);

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.innerHTML = highlightedHtml;
    }
  }, [highlightedHtml]);

  // Emphasize current match in the highlighted layer
  useEffect(() => {
    const root = highlightRef.current;
    if (!root) return;
    const marks = root.querySelectorAll('mark[data-idx]');
    marks.forEach((el) => {
      el.classList.remove('ring-2', 'ring-amber-500', 'bg-amber-300');
      el.classList.add('bg-yellow-300');
    });
    if (currentMatchIndex == null || currentMatchIndex < 0) return;
    const current = root.querySelector(`mark[data-idx="${currentMatchIndex}"]`);
    if (current) {
      current.classList.remove('bg-yellow-300');
      current.classList.add('bg-amber-300', 'ring-2', 'ring-amber-500');
    }
  }, [currentMatchIndex, highlightedHtml]);

  // Jump to a specific match index by selecting it in the textarea
  useEffect(() => {
    if (!textareaRef.current) return;
    if (!searchQuery || !searchQuery.trim()) return;
    if (currentMatchIndex == null || currentMatchIndex < 0) return;

    try {
      const pattern = new RegExp(escapeRegExp(searchQuery), 'gi');
      const matches: Array<{ start: number; end: number }> = [];
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(value)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length });
        if (m.index === pattern.lastIndex) pattern.lastIndex++;
      }

      const target = matches[currentMatchIndex];
      if (!target) return;
      const ta = textareaRef.current;
      ta.focus();
      ta.setSelectionRange(target.start, target.end);
      // Nudge scroll to center the selection approximately
      const preText = value.slice(0, target.start);
      const lineCount = (preText.match(/\n/g) || []).length;
      const approxLineHeight = 14 * 1.5; // matches our CSS line-height and font-size
      ta.scrollTop = Math.max(0, lineCount * approxLineHeight - ta.clientHeight / 2);
    } catch {
      // ignore
    }
  }, [currentMatchIndex, searchQuery, value, escapeRegExp, isCaseSensitive, isRegex]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      onChange(newValue);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Tab' && !readOnly) {
        e.preventDefault();
        const textarea = e.currentTarget as HTMLTextAreaElement;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        onChange(newValue);

        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = start + 2;
            textareaRef.current.selectionEnd = start + 2;
          }
        }, 0);
      }
    },
    [value, onChange, readOnly]
  );

  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => setIsFocused(false), []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = e.currentTarget.scrollTop;
      highlightRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
    // Keep line numbers vertically in sync with the textarea without showing a scrollbar
    if (lineNumbersContentRef.current) {
      const y = e.currentTarget.scrollTop;
      lineNumbersContentRef.current.style.transform = `translateY(-${y}px)`;
    }
  }, []);

  const borderClass = useMemo(
    () => (isValid ? (isFocused ? 'border-blue-500' : 'border-white/20') : 'border-red-500'),
    [isValid, isFocused]
  );

  const textareaClass = useMemo(
    () =>
      `absolute inset-0 z-20 h-full w-full resize-none bg-transparent px-4 pt-4 pb-4 pl-20 font-mono text-[14px] leading-[1.5] whitespace-pre text-transparent caret-white focus:outline-none ${
        readOnly ? 'cursor-not-allowed' : ''
      }`,
    [readOnly]
  );

  return (
    <div className="flex h-full w-full flex-col">
      <div
        className={`relative flex-1 overflow-hidden rounded-md border bg-black ${
          borderClass
        } ${readOnly ? 'opacity-70' : ''} ${heightClass ?? ''}`}
        style={!heightClass ? { height } : undefined}
      >
        <div
          ref={lineNumbersRef}
          className="absolute top-0 left-0 z-[5] h-full w-16 overflow-hidden bg-neutral-900 px-2 py-4 text-right font-mono text-[14px] leading-[1.5] text-gray-500 select-none"
        >
          <div ref={lineNumbersContentRef} className="will-change-transform">
            {lines.map((line) => (
              <div key={line} className="leading-[1.5]">
                {line}
              </div>
            ))}
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onScroll={handleScroll}
          readOnly={readOnly}
          className={textareaClass}
          placeholder="Enter YAML content..."
          spellCheck={false}
        />

        <pre
          ref={highlightRef}
          className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-auto bg-transparent px-4 pt-4 pb-4 pl-20 font-mono text-[14px] leading-[1.5] whitespace-pre"
        />
      </div>

      {errorMessage && (
        <div className="mt-2 rounded border border-red-500 bg-red-900/50 p-2 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      {!isValid && !readOnly && (
        <div className="mt-2 text-sm text-yellow-400">
          YAML syntax error. Please fix before saving.
        </div>
      )}
    </div>
  );
}
