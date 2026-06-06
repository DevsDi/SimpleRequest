import React, { useRef, useMemo, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './RawEditor.scss';

/**
 * Raw content type - Postman style
 */
type RawContentType = 'json' | 'text' | 'xml' | 'html' | 'javascript';

/**
 * Raw editor component - Postman style
 * Content type selector + syntax highlighted editor
 */
interface RawEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const RawEditor: React.FC<RawEditorProps> = ({ value, onChange }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const [contentType, setContentType] = useState<RawContentType>('json');

  /** Language mapping for syntax highlighter */
  const languageMap: Record<RawContentType, string> = {
    json: 'json',
    text: 'text',
    xml: 'xml',
    html: 'html',
    javascript: 'javascript'
  };

  /** Handle content change */
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  /** Sync scroll */
  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  /** Handle type change */
  const handleTypeChange = (type: RawContentType) => {
    setContentType(type);
  };

  /** Check if valid JSON */
  const isValidJson = useMemo(() => {
    if (contentType !== 'json' || !value.trim()) return true;
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }, [contentType, value]);

  return (
    <div className="raw-editor">
      {/* Content type selector */}
      <div className="raw-type-selector">
        {(['json', 'text', 'xml', 'html', 'javascript'] as RawContentType[]).map((type) => (
          <button
            key={type}
            className={`type-btn ${contentType === type ? 'active' : ''}`}
            onClick={() => handleTypeChange(type)}
          >
            {type.toUpperCase()}
          </button>
        ))}
        {!isValidJson && (
          <span className="error-hint">Invalid JSON</span>
        )}
      </div>

      {/* Editor area - textarea with highlight overlay */}
      <div className="raw-editor-container">
        {/* Highlight layer */}
        <pre className="raw-highlight-layer" ref={highlightRef}>
          <SyntaxHighlighter
            language={languageMap[contentType]}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: '0',
              fontSize: '13px',
              lineHeight: '1.5',
              background: 'transparent',
              fontFamily: 'JetBrains Mono, Monaco, monospace',
            }}
            codeTagProps={{
              style: { fontFamily: 'JetBrains Mono, Monaco, monospace' },
            }}
          >
            {value || ' '}
          </SyntaxHighlighter>
        </pre>
        {/* Textarea layer */}
        <textarea
          ref={textareaRef}
          className="raw-textarea"
          placeholder="Enter raw content..."
          value={value}
          onChange={handleContentChange}
          onScroll={handleScroll}
          spellCheck={false}
        />
      </div>
    </div>
  );
};

export default RawEditor;