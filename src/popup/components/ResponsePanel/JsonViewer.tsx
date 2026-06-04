import React, { useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './JsonViewer.scss';

/**
 * JSON viewer component
 * Formats and highlights JSON response
 */
interface JsonViewerProps {
  /** JSON content string */
  content: string;
}

const JsonViewer: React.FC<JsonViewerProps> = ({ content }) => {
  /** Parse and format JSON */
  const formattedContent = useMemo(() => {
    if (!content.trim()) return '';
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // Not JSON format, return raw content
      return content;
    }
  }, [content]);

  /** Check if JSON */
  const isJson = useMemo(() => {
    if (!content.trim()) return false;
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }, [content]);

  if (!content.trim()) {
    return <div className="json-viewer empty">Empty response body</div>;
  }

  return (
    <div className="json-viewer">
      {isJson ? (
        <SyntaxHighlighter
          language="json"
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '10px',
            borderRadius: '4px',
            fontSize: '13px',
            maxHeight: 'none',
            overflow: 'auto',
            background: '#1e1e2e',
          }}
        >
          {formattedContent}
        </SyntaxHighlighter>
      ) : (
        <pre className="raw-content">{content}</pre>
      )}
    </div>
  );
};

export default JsonViewer;