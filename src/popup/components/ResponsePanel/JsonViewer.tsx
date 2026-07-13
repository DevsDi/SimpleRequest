import React, { useMemo, useCallback, useRef } from 'react';
import Editor, { OnMount, BeforeMount, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import type { editor } from 'monaco-editor';
import { useEditorFontSize, FONT_SIZE_OPTIONS } from '@/popup/hooks/useEditorFontSize';
import './JsonViewer.scss';

// 配置 Monaco 使用本地 worker（Chrome 扩展 CSP 兼容）
(self as any).MonacoEnvironment = {
  getWorker(_: any, label: string) {
    if (label === 'json') {
      return new jsonWorker();
    }
    return new editorWorker();
  },
};

// 配置 loader 使用本地 monaco，避免从 CDN 加载
loader.config({ monaco });

/**
 * JSON viewer component with Monaco Editor (read-only)
 * Provides code folding and syntax highlighting
 */
interface JsonViewerProps {
  /** JSON content string */
  content: string;
}

const JsonViewer: React.FC<JsonViewerProps> = ({ content }) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [fontSize, setFontSize] = useEditorFontSize();

  /** Monaco editor mount handler - define custom theme */
  const handleEditorWillMount: BeforeMount = (monaco) => {
    monaco.editor.defineTheme('custom-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1e1e2e',
        'editor.lineHighlightBackground': '#313244',
      }
    });
  };

  /** Parse and format JSON */
  const formattedContent = useMemo(() => {
    if (!content.trim()) return '';
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
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

  /** Expand all folded regions */
  const expandAll = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.unfoldAll')?.run();
    }
  }, []);

  /** Collapse all regions */
  const collapseAll = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.foldAll')?.run();
    }
  }, []);

  /** Editor mount handler */
  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  if (!content.trim()) {
    return <div className="json-viewer empty">Empty response body</div>;
  }

  return (
    <div className="json-viewer">
      {isJson && (
        <div className="json-actions">
          <button className="json-action-btn" onClick={expandAll}>
            Expand All
          </button>
          <button className="json-action-btn" onClick={collapseAll}>
            Collapse All
          </button>
          {/* 字体大小选择器 */}
          <div className="font-size-selector">
            {FONT_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`font-btn ${fontSize === opt.value ? 'active' : ''}`}
                onClick={() => setFontSize(opt.value)}
                title={opt.title}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {isJson ? (
        <div className="monaco-viewer-container">
          <Editor
            height="100%"
            language="json"
            value={formattedContent}
            beforeMount={handleEditorWillMount}
            onMount={handleEditorMount}
            theme="custom-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize,
              fontFamily: "'JetBrains Mono', Monaco, monospace",
              lineNumbers: 'on',
              folding: true,
              foldingStrategy: 'indentation',
              foldingHighlight: true,
              showFoldingControls: 'always',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              padding: { top: 8 },
              renderLineHighlight: 'none',
              scrollbar: {
                vertical: 'auto',
                horizontal: 'auto',
              },
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              overviewRulerBorder: false,
            }}
          />
        </div>
      ) : (
        <pre className="raw-content">{content}</pre>
      )}
    </div>
  );
};

export default JsonViewer;
