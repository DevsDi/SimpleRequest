import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useStore } from '@/store';
import { BODY_TYPES, BodyType } from '@/utils/constants';
import FormdataEditor from './FormdataEditor';
import RawEditor from './RawEditor';
import './BodyEditor.scss';

/** Generate unique ID for collapsible blocks */
let idCounter = 0;
const generateId = () => `body-block-${idCounter++}`;

/**
 * Body editor component - Postman style
 * Supports: none, form-data, x-www-form-urlencoded, raw, json
 */
const BodyEditor: React.FC = () => {
  const { currentRequest, updateRequest } = useStore();
  const { body } = currentRequest;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  /** View mode for JSON */
  const [isViewMode, setIsViewMode] = useState(false);
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set());

  /** Handle type change */
  const handleTypeChange = (type: BodyType) => {
    updateRequest({ body: { ...body, type } });
    setIsViewMode(false);
    setCollapsedBlocks(new Set());
  };

  /** Handle content change */
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateRequest({ body: { ...body, content: e.target.value } });
  };

  /** Sync scroll */
  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  /** Format JSON */
  const formatJson = () => {
    if (!body.content.trim()) return;
    try {
      const parsed = JSON.parse(body.content);
      const formatted = JSON.stringify(parsed, null, 2);
      updateRequest({ body: { ...body, content: formatted } });
      setIsViewMode(true);
      setCollapsedBlocks(new Set());
    } catch {}
  };

  /** Check if valid JSON */
  const isValidJson = useMemo(() => {
    if (!body.content.trim()) return false;
    try {
      JSON.parse(body.content);
      return true;
    } catch {
      return false;
    }
  }, [body.content]);

  /** Toggle block collapse */
  const toggleBlock = useCallback((id: string) => {
    setCollapsedBlocks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  /** Expand/Collapse all */
  const expandAll = useCallback(() => setCollapsedBlocks(new Set()), []);
  const collapseAll = useCallback(() => {
    if (!body.content.trim()) return;
    try {
      idCounter = 0;
      const parsed = JSON.parse(body.content);
      collectIds(parsed);
    } catch {}
  }, [body.content]);

  const collectIds = (data: unknown): string[] => {
    const ids: string[] = [];
    const traverse = (obj: unknown): void => {
      if (Array.isArray(obj) && obj.length > 0) {
        ids.push(generateId());
        obj.forEach(traverse);
      } else if (obj && typeof obj === 'object') {
        const keys = Object.keys(obj);
        if (keys.length > 0) {
          ids.push(generateId());
          keys.forEach(k => traverse(obj[k as keyof typeof obj]));
        }
      }
    };
    traverse(data);
    setCollapsedBlocks(new Set(ids));
    return ids;
  };

  /** Escape HTML */
  const escapeHtml = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /** Render JSON with collapse */
  const renderJson = (data: unknown): string => {
    const id = generateId();
    if (data === null) return '<span class="v-null">null</span>';
    if (typeof data === 'boolean') return `<span class="v-bool">${data}</span>`;
    if (typeof data === 'number') return `<span class="v-number">${data}</span>`;
    if (typeof data === 'string') return `<span class="v-string">"${escapeHtml(data)}"</span>`;
    if (Array.isArray(data)) {
      if (data.length === 0) return '<span class="v-bracket">[]</span>';
      const items = data.map((item, i) => {
        const val = renderJson(item);
        const comma = i < data.length - 1 ? '<span class="v-comma">,</span>' : '';
        return `<div class="line">${val}${comma}</div>`;
      }).join('');
      const collapsed = collapsedBlocks.has(id);
      return `<span class="toggle" data-id="${id}">${collapsed ? '▶' : '▼'}</span><span class="v-bracket">[</span><span class="v-count">${data.length}</span><div class="block ${collapsed ? 'hide' : ''}" data-id="${id}">${items}</div><span class="v-bracket">]</span>`;
    }
    if (typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length === 0) return '<span class="v-bracket">{}</span>';
      const items = keys.map((k, i) => {
        const val = renderJson(data[k as keyof typeof data]);
        const comma = i < keys.length - 1 ? '<span class="v-comma">,</span>' : '';
        return `<div class="line"><span class="v-key">"${escapeHtml(k)}"</span>: ${val}${comma}</div>`;
      }).join('');
      const collapsed = collapsedBlocks.has(id);
      return `<span class="toggle" data-id="${id}">${collapsed ? '▶' : '▼'}</span><span class="v-bracket">{</span><span class="v-count">${keys.length}</span><div class="block ${collapsed ? 'hide' : ''}" data-id="${id}">${items}</div><span class="v-bracket">}</span>`;
    }
    return String(data);
  };

  const renderedJson = useMemo(() => {
    if (!isValidJson) return '';
    idCounter = 0;
    try {
      const parsed = JSON.parse(body.content);
      return renderJson(parsed);
    } catch { return ''; }
  }, [body.content, isValidJson, collapsedBlocks]);

  const handleViewClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('toggle')) {
      const id = target.getAttribute('data-id');
      if (id) toggleBlock(id);
    } else {
      setIsViewMode(false);
    }
  }, [toggleBlock]);

  return (
    <div className="body-editor">
      {/* Type selector - Postman style */}
      <div className="body-type-bar">
        {BODY_TYPES.map((type) => (
          <button
            key={type}
            className={`type-tab ${body.type === type ? 'active' : ''}`}
            onClick={() => handleTypeChange(type)}
          >
            {type === 'none' ? 'None' :
             type === 'form-data' ? 'form-data' :
             type === 'x-www-form-urlencoded' ? 'x-www-form-urlencoded' :
             type === 'raw' ? 'raw' : 'JSON'}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="body-content-area">
        {/* None */}
        {body.type === 'none' && (
          <div className="none-hint">This request does not have a body</div>
        )}

        {/* JSON */}
        {body.type === 'json' && (
          <>
            <div className="json-toolbar">
              <button className="toolbar-btn" onClick={formatJson}>Beautify</button>
              {isViewMode && (
                <>
                  <button className="toolbar-btn" onClick={expandAll}>Expand All</button>
                  <button className="toolbar-btn" onClick={collapseAll}>Collapse All</button>
                </>
              )}
              {!isValidJson && body.content.trim() && <span className="error-hint">Invalid JSON</span>}
            </div>
            {isViewMode ? (
              <div className="json-view-container" onClick={handleViewClick}>
                <div className="json-view-content">
                  <div dangerouslySetInnerHTML={{ __html: renderedJson }} />
                </div>
                <div className="json-view-hint">Click to edit</div>
              </div>
            ) : (
              <div className="json-editor-container">
                <pre className="json-highlight-layer" ref={highlightRef}>
                  <SyntaxHighlighter language="json" style={vscDarkPlus} customStyle={{ margin: 0, padding: '0', fontSize: '13px', lineHeight: '1.5', background: 'transparent', fontFamily: 'JetBrains Mono, Monaco, monospace' }} codeTagProps={{ style: { fontFamily: 'JetBrains Mono, Monaco, monospace' } }}>
                    {body.content || ' '}
                  </SyntaxHighlighter>
                </pre>
                <textarea ref={textareaRef} className="json-textarea" placeholder="Enter JSON..." value={body.content} onChange={handleContentChange} onScroll={handleScroll} spellCheck={false} />
              </div>
            )}
          </>
        )}

        {/* form-data & x-www-form-urlencoded */}
        {(body.type === 'form-data' || body.type === 'x-www-form-urlencoded') && (
          <FormdataEditor value={body.content} onChange={(v) => updateRequest({ body: { ...body, content: v } })} type={body.type} />
        )}

        {/* raw */}
        {body.type === 'raw' && (
          <RawEditor value={body.content} onChange={(v) => updateRequest({ body: { ...body, content: v } })} />
        )}
      </div>
    </div>
  );
};

export default BodyEditor;