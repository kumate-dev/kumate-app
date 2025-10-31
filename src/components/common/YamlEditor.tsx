import { useState, useEffect, useRef, useMemo } from 'react';
import { parse } from 'yaml';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';
import '@/styles/yaml-dark.css';

interface YamlEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  readOnly?: boolean;
  onError?: (error: string | null) => void;
}

export function YamlEditor({
  value,
  onChange,
  height = '400px',
  readOnly = false,
  onError,
}: YamlEditorProps) {
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const validateYaml = (yamlString: string) => {
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
    };

    validateYaml(value);
  }, [value, onError]);

  const lines = useMemo(() => {
    const lineCount = value.split('\n').length;
    return Array.from({ length: Math.max(1, lineCount) }, (_, i) => i + 1);
  }, [value]);

  const highlightedHtml = useMemo(() => {
    const code = value || '';
    try {
      return Prism.highlight(code, Prism.languages.yaml, 'yaml');
    } catch (error) {
      console.warn('Prism highlighting failed:', error);
      return code;
    }
  }, [value]);

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.innerHTML = highlightedHtml;
    }
  }, [highlightedHtml]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
  };

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = e.currentTarget.scrollTop;
      highlightRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div
        className={`relative flex-1 overflow-hidden rounded-md border ${
          isValid ? (isFocused ? 'border-blue-500' : 'border-white/20') : 'border-red-500'
        } ${readOnly ? 'opacity-70' : ''}`}
        style={{ height }}
      >
        <div
          className="absolute top-0 left-0 h-full overflow-hidden bg-gray-900 text-right"
          style={{
            width: '4rem',
            padding: '1rem 0.5rem',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '14px',
            lineHeight: '1.5',
            color: '#6b7280',
            userSelect: 'none',
            zIndex: 5,
          }}
        >
          {lines.map((line) => (
            <div key={line} className="leading-6">
              {line}
            </div>
          ))}
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
          className={`absolute inset-0 h-full w-full resize-none bg-transparent font-mono caret-white focus:outline-none ${
            readOnly ? 'cursor-not-allowed' : ''
          }`}
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '14px',
            lineHeight: '1.5',
            zIndex: 20,
            color: 'transparent',
            padding: '1rem 1rem 1rem 5rem',
            whiteSpace: 'pre',
            overflowWrap: 'normal',
          }}
          placeholder="Enter YAML content..."
          spellCheck={false}
        />

        <pre
          ref={highlightRef}
          className="absolute inset-0 h-full w-full overflow-auto font-mono text-sm"
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '14px',
            lineHeight: '1.5',
            background: 'transparent',
            pointerEvents: 'none',
            padding: '1rem 1rem 1rem 5rem',
            whiteSpace: 'pre',
            overflowWrap: 'normal',
            zIndex: 10,
          }}
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
