import { useState, useEffect, useRef } from 'react';
import yaml from 'js-yaml';

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
  onError 
}: YamlEditorProps) {
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    validateYaml(value);
  }, [value]);

  const validateYaml = (yamlString: string) => {
    if (!yamlString.trim()) {
      setIsValid(true);
      setErrorMessage(null);
      onError?.(null);
      return;
    }

    try {
      yaml.load(yamlString);
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

  return (
    <div className="w-full h-full flex flex-col">
      <div 
        className={`flex-1 border rounded-md overflow-hidden ${
          isValid ? 'border-white/20' : 'border-red-500'
        } ${readOnly ? 'opacity-70' : ''}`}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          className={`w-full h-full font-mono text-sm bg-neutral-800 text-white p-4 resize-none focus:outline-none ${
            readOnly ? 'cursor-not-allowed' : ''
          }`}
          style={{ height }}
          placeholder="Enter YAML content..."
          spellCheck={false}
        />
      </div>
      
      {errorMessage && (
        <div className="mt-2 p-2 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
          {errorMessage}
        </div>
      )}
      
      {!isValid && !readOnly && (
        <div className="mt-2 text-yellow-400 text-sm">
          YAML syntax error. Please fix before saving.
        </div>
      )}
    </div>
  );
}
