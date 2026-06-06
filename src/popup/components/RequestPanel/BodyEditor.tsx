import React, { useMemo, useState, useCallback, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useStore } from '@/store';
import { BODY_TYPES, BodyType } from '@/utils/constants';
import './BodyEditor.scss';

/** Generate unique ID for collapsible blocks */
let idCounter = 0;
const generateId = () => `body-block-${idCounter++}`;

/**
 * Body editor component
 * Supports JSON, Form-Data, Raw formats
 * JSON mode: collapsible view + click to edit
 */
const BodyEditor: React.FC = () => {
  const { currentRequest, updateRequest } = useStore();
  const { body } = currentRequest;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  /** View mode state - false = editing, true = viewing with collapse */
  const [isViewMode, setIsViewMode] = useState(false);
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set());

  /** Handle type change */
  const handleTypeChange = (type: BodyType) => {
    updateRequest({
      body: { ...body, type },
    });
    setIsViewMode(false);
    setCollapsedBlocks(new Set());
  };

  /** Handle content change */
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateRequest({
      body: { ...body, content: e.target.value },
    });
  };

  /** Sync scroll */
  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  /** Format JSON and switch to view mode */
  const formatJson = () => {
    if (body.type !== 'json' || !body.content.trim()) return;
    try {
      const parsed = JSON.parse(body.content);
      const formatted = JSON.stringify(parsed, null, 2);
      updateRequest({
        body: { ...body, content: formatted },
      });
      setIsViewMode(true);
      setCollapsedBlocks(new Set());
    } catch {
      // JSON parse failed
    }
  };

  /** Switch to edit mode */
  const switchToEditMode = () => {
    setIsViewMode(false);
  };

  /** Check if valid JSON */
  const isValidJson = useMemo(() => {
    if (body.type !== 'json' || !body.content.trim()) return false;
    try {
      JSON.parse(body.content);
      return true;
    } catch {
      return false;
    }
  }, [body.type, body.content]);

  /** Toggle block collapse */
  const toggleBlock = useCallback((id: string) => {
    setCollapsedBlocks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  /** Expand all */
  const expandAll = useCallback(() => {
    setCollapsedBlocks(new Set());
  }, []);

  /** Collapse all - collect all IDs */
  const collectIds = (data: unknown): string[] => {
    const ids: string[] = [];
    const traverse = (obj: unknown): void => {
      if (Array.isArray(obj)) {
        if (obj.length > 0) {
          ids.push(generateId());
          obj.forEach(traverse);
        }
      } else if (obj && typeof obj === 'object') {
        const keys = Object.keys(obj);
        if (keys.length > 0) {
          ids.push(generateId());
          keys.forEach((k) => traverse(obj[k as keyof typeof obj]));
        }
      }
    };
    traverse(data);
    return ids;
  };

  const collapseAll = useCallback(() => {
    if (!body.content.trim()) return;
    try {
      idCounter = 0;
      const parsed = JSON.parse(body.content);
      const ids = collectIds(parsed);
      setCollapsedBlocks(new Set(ids));
    } catch {}
  }, [body.content]);

  /** Escape HTML */
  const escapeHtml = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  /** Render JSON with collapse markers */
  const renderJson = (data: unknown, depth = 0): string => {
    const id = generateId();

    if (data === null) return '<span class="v-null">null</span>';
    if (data === true || data === false) return `<span class="v-bool">${data}</span>`;
    if (typeof data === 'number') return `<span class="v-number">${data}</span>`;
    if (typeof data === 'string') return `<span class="v-string">"${escapeHtml(data)}"</span>`;

    if (Array.isArray(data)) {
      if (data.length === 0) return '<span class="v-bracket">[]</span>';
      const items = data.map((item, i) => {
        const val = renderJson(item, depth + 1);
        const comma = i < data.length - 1 ? '<span class="v-comma">,</span>' : '';
        return `<div class="line">${val}${comma}</div>`;
      }).join('');
      const isCollapsed = collapsedBlocks.has(id);
      return `<span class="toggle" data-block-id="${id}">${isCollapsed ? '▶' : '▼'}</span><span class="v-bracket">[</span><span class="v-count">${data.length}</span><div class="block ${isCollapsed ? 'hide' : ''}" data-block-id="${id}">${items}</div><span class="v-bracket">]</span>`;
    }

    if (typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length === 0) return '<span class="v-bracket">{}</span>';
      const items = keys.map((k, i) => {
        const val = renderJson(data[k as keyof typeof data], depth + 1);
        const comma = i < keys.length - 1 ? '<span class="v-comma">,</span>' : '';
        return `<div class="line"><span class="v-key">"${escapeHtml(k)}"</span>: ${val}${comma}</div>`;
      }).join('');
      const isCollapsed = collapsedBlocks.has(id);
      return `<span class="toggle" data-block-id="${id}">${isCollapsed ? '▶' : '▼'}</span><span class="v-bracket">{</span><span class="v-count">${keys.length}</span><div class="block ${isCollapsed ? 'hide' : ''}" data-block-id="${id}">${items}</div><span class="v-bracket">}</span>`;
    }

    return String(data);
  };

  /** Rendered JSON HTML */
  const renderedJson = useMemo(() => {
    if (!isValidJson || !body.content.trim()) return '';
    try {
      idCounter = 0;
      const parsed = JSON.parse(body.content);
      return renderJson(parsed);
    } catch {
      return '';
    }
  }, [body.content, isValidJson, collapsedBlocks]);

  /** Handle click in view mode */
  const handleViewClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Click on toggle -> collapse/expand
    if (target.classList.contains('toggle')) {
      const blockId = target.getAttribute('data-block-id');
      if (blockId) {
        toggleBlock(blockId);
        return;
      }
    }
    // Click on content area (not toggle) -> switch to edit mode
    if (!target.classList.contains('toggle') && !target.classList.contains('block')) {
      switchToEditMode();
    }
  }, [toggleBlock]);

  /** Handle tab key */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = body.content.substring(0, start) + '  ' + body.content.substring(end);
      updateRequest({ body: { ...body, content: newValue } });
      setTimeout(() => {
        if (textarea) textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  return (
    <div className="body-editor">
      {/* Type selector */}
      <div className="body-type-selector">
        {BODY_TYPES.filter((t) => t !== 'none').map((type) => (
          <button
            key={type}
            className={`type-btn ${body.type === type ? 'active' : ''}`}
            onClick={() => handleTypeChange(type)}
          >
            {type}
          </button>
        ))}
        <button
          className={`type-btn ${body.type === 'none' ? 'active' : ''}`}
          onClick={() => handleTypeChange('none')}
        >
          none
        </button>
      </div>

      {/* Content area */}
      {body.type !== 'none' && (
        <div className="body-content">
          {body.type === 'json' && (
            <div className="json-actions">
              <button className="btn btn-secondary" onClick={formatJson}>
                Format JSON
              </button>
              {isViewMode && (
                <>
                  <button className="btn btn-secondary" onClick={expandAll}>
                    Expand All
                  </button>
                  <button className="btn btn-secondary" onClick={collapseAll}>
                    Collapse All
                  </button>
                </>
              )}
              {!isValidJson && body.content.trim() && !isViewMode && (
                <span className="json-error">Invalid JSON</span>
              )}
            </div>
          )}

          {/* JSON type */}
          {body.type === 'json' ? (
            isViewMode ? (
              /* View mode: collapsible JSON, click to edit */
              <div className="json-view-container" onClick={handleViewClick}>
                <div className="json-view-content">
                  <div dangerouslySetInnerHTML={{ __html: renderedJson }} />
                </div>
                <div className="json-view-hint">Click anywhere to edit</div>
              </div>
            ) : (
              /* Edit mode: textarea with highlight */
              <div className="json-editor-container">
                <pre className="json-highlight-layer" ref={highlightRef}>
                  <SyntaxHighlighter
                    language="json"
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
                    {body.content || ' '}
                  </SyntaxHighlighter>
                </pre>
                <textarea
                  ref={textareaRef}
                  className="json-textarea"
                  placeholder="Enter JSON data..."
                  value={body.content}
                  onChange={handleContentChange}
                  onScroll={handleScroll}
                  onKeyDown={handleKeyDown}
                  spellCheck={false}
                />
              </div>
            )
          ) : (
            <textarea
              className="body-textarea"
              placeholder={
                body.type === 'form-data'
                  ? 'Enter form data...'
                  : 'Enter raw data...'
              }
              value={body.content}
              onChange={handleContentChange}
            />
          )}

          {body.type === 'json' && (
            <div className="body-hint">
              {isViewMode
                ? 'Tip: Click ▼/▶ to collapse, click content to edit'
                : 'Tip: Press Tab to indent, Format JSON for collapsible view'}
            </div>
          )}
        </div>
      )}

      {body.type === 'none' && (
        <div className="body-empty">No body for this request</div>
      )}
    </div>
  );
};

export default BodyEditor;