import React, { useState, useCallback, useRef, useEffect } from 'react';
import Editor, { OnMount, BeforeMount, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import type { editor } from 'monaco-editor';
import { useStore } from '@/store';
import { BODY_TYPES, BodyType } from '@/utils/constants';
import { RawContentType } from '@/types';
import { useEditorFontSize, FONT_SIZE_OPTIONS } from '@/popup/hooks/useEditorFontSize';
import FormdataEditor from './FormdataEditor';
import './BodyEditor.scss';

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
 * Body editor component - Postman style
 * Supports: none, form-data, x-www-form-urlencoded, raw
 * Uses Monaco Editor for raw content (JSON folding support)
 */
const BodyEditor: React.FC = () => {
  const { getCurrentRequest, updateCurrentRequest } = useStore();
  const currentRequest = getCurrentRequest();

  // 所有 hooks 必须在条件返回之前调用
  const [fontSize, setFontSize] = useEditorFontSize();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [rawType, setRawType] = useState<RawContentType>('json');
  const lastBodyTypeRef = useRef<BodyType>('none');

  /** Per-type content storage - each body type keeps its own content */
  const contentStore = useRef<Record<string, string>>({
    'form-data': '',
    'x-www-form-urlencoded': '',
    'raw': '',
  });

  /** Monaco editor mount handler - define custom theme */
  const handleEditorWillMount: BeforeMount = (monaco) => {
    // 定义自定义主题，背景色与项目统一
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

  /** Monaco editor mount handler */
  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  // 条件返回放在所有 hooks 之后
  if (!currentRequest) return null;

  const { body } = currentRequest;

  // 同步 rawType 与 body.rawType
  useEffect(() => {
    if (body.rawType && body.rawType !== rawType) {
      setRawType(body.rawType);
    }
  }, [body.rawType, rawType]);

  /** Keep contentStore synced when body type or content changes externally */
  useEffect(() => {
    if (body.type !== lastBodyTypeRef.current) {
      lastBodyTypeRef.current = body.type;
      if (body.type !== 'none') {
        contentStore.current[body.type] = body.content;
      }
    }
  }, [body.type, body.content]);

  /** Handle type change */
  const handleTypeChange = (type: BodyType) => {
    if (body.type !== 'none') {
      contentStore.current[body.type] = body.content;
    }
    const savedContent = type !== 'none' ? (contentStore.current[type] ?? '') : '';
    const newRawType = type === 'raw' ? rawType : undefined;
    updateCurrentRequest({ body: { type, content: savedContent, rawType: newRawType } });
  };

  /** Handle content change from Monaco */
  const handleEditorChange = useCallback((value: string | undefined) => {
    updateCurrentRequest({ body: { ...body, content: value || '' } });
  }, [body, updateCurrentRequest]);

  /** Handle raw type change */
  const handleRawTypeChange = (type: RawContentType) => {
    setRawType(type);
    updateCurrentRequest({ body: { ...body, rawType: type } });
  };

  /** Format JSON */
  const formatJson = useCallback(() => {
    if (!body.content.trim()) return;
    try {
      const parsed = JSON.parse(body.content);
      const formatted = JSON.stringify(parsed, null, 2);
      updateCurrentRequest({ body: { ...body, content: formatted } });
      if (editorRef.current) {
        editorRef.current.setValue(formatted);
      }
    } catch {}
  }, [body, updateCurrentRequest]);

  /** Check if valid JSON */
  const isValidJson = useCallback(() => {
    if (!body.content.trim()) return true;
    try {
      JSON.parse(body.content);
      return true;
    } catch {
      return false;
    }
  }, [body.content]);

  /** Get Monaco language from raw type */
  const getLanguage = (): string => {
    switch (rawType) {
      case 'json': return 'json';
      case 'xml': return 'xml';
      case 'html': return 'html';
      case 'javascript': return 'javascript';
      default: return 'plaintext';
    }
  };

  return (
    <div className="body-editor">
      {/* Type selector */}
      <div className="body-type-bar">
        {BODY_TYPES.map((type) => (
          <button
            key={type}
            className={`type-tab ${body.type === type ? 'active' : ''}`}
            onClick={() => handleTypeChange(type)}
          >
            {type === 'none' ? 'none' : type}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="body-content-area">
        {body.type === 'none' && (
          <div className="none-hint">This request does not have a body</div>
        )}

        {(body.type === 'form-data' || body.type === 'x-www-form-urlencoded') && (
          <FormdataEditor
            value={body.content}
            onChange={(v) => updateCurrentRequest({ body: { ...body, content: v } })}
            type={body.type}
          />
        )}

        {body.type === 'raw' && (
          <>
            <div className="raw-toolbar">
              <div className="raw-type-selector">
                {(['json', 'text', 'xml', 'html', 'javascript'] as RawContentType[]).map((t) => (
                  <button
                    key={t}
                    className={`type-btn ${rawType === t ? 'active' : ''}`}
                    onClick={() => handleRawTypeChange(t)}
                  >
                    {t === 'json' ? 'JSON' : t === 'text' ? 'Text' : t === 'xml' ? 'XML' : t === 'html' ? 'HTML' : 'JavaScript'}
                  </button>
                ))}
              </div>
              <div className="toolbar-right">
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
                {rawType === 'json' && (
                  <button className="toolbar-btn" onClick={formatJson}>Beautify</button>
                )}
                {rawType === 'json' && !isValidJson() && body.content.trim() && (
                  <span className="error-hint">Invalid JSON</span>
                )}
              </div>
            </div>

            {/* Monaco Editor */}
            <div className="monaco-container">
              <Editor
                height="100%"
                language={getLanguage()}
                value={body.content}
                onChange={handleEditorChange}
                beforeMount={handleEditorWillMount}
                onMount={handleEditorMount}
                theme="custom-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize,
                  fontFamily: "'JetBrains Mono', Monaco, monospace",
                  lineNumbers: 'on',
                  folding: true,
                  foldingStrategy: 'indentation',
                  foldingHighlight: true,
                  showFoldingControls: 'always',
                  unfoldOnClickAfterEndOfLine: true,
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  padding: { top: 8 },
                  renderLineHighlight: 'line',
                  cursorBlinking: 'smooth',
                  tabSize: 2,
                  insertSpaces: true,
                  formatOnPaste: true,
                  quickSuggestions: rawType === 'json',
                  suggestOnTriggerCharacters: rawType === 'json',
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BodyEditor;
