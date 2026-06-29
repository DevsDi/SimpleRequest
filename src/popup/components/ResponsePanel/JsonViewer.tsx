import React, { useMemo, useState, useCallback, useRef } from 'react';
import './JsonViewer.scss';

/**
 * JSON viewer component with collapse/expand functionality
 * Formats and highlights JSON response
 */
interface JsonViewerProps {
  /** JSON content string */
  content: string;
}

/** Generate unique ID */
let idCounter = 0;
const generateId = () => `json-block-${idCounter++}`;

const JsonViewer: React.FC<JsonViewerProps> = ({ content }) => {
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set());

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

  /** Collapse all - collect IDs by traversing the parsed JSON structure */
  const collapseAll = useCallback(() => {
    if (!content.trim()) return;
    try {
      idCounter = 0;
      const allIds: string[] = [];
      const collectIds = (data: unknown) => {
        if (Array.isArray(data)) {
          if (data.length > 0) {
            allIds.push(generateId());
            data.forEach(collectIds);
          }
        } else if (data && typeof data === 'object') {
          const keys = Object.keys(data);
          if (keys.length > 0) {
            allIds.push(generateId());
            keys.forEach(k => collectIds((data as Record<string, unknown>)[k]));
          }
        }
      };
      const parsed = JSON.parse(content);
      collectIds(parsed);
      setCollapsedBlocks(new Set(allIds));
    } catch {}
  }, [content]);

  /** Escape HTML */
  const escapeHtml = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  /** Render JSON with highlighting and collapse markers */
  const renderJson = (data: unknown, depth = 0): string => {
    const id = generateId();

    if (data === null) {
      return '<span class="v-null">null</span>';
    }

    if (data === true || data === false) {
      return `<span class="v-bool">${data}</span>`;
    }

    if (typeof data === 'number') {
      return `<span class="v-number">${data}</span>`;
    }

    if (typeof data === 'string') {
      return `<span class="v-string">"${escapeHtml(data)}"</span>`;
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return '<span class="v-bracket">[]</span>';
      }
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
      if (keys.length === 0) {
        return '<span class="v-bracket">{}</span>';
      }
      const items = keys.map((k, i) => {
        const val = renderJson(data[k as keyof typeof data], depth + 1);
        const comma = i < keys.length - 1 ? '<span class="v-comma">,</span>' : '';
        const keyText = `<span class="v-key">"${escapeHtml(k)}"</span>`;
        return `<div class="line">${keyText}: ${val}${comma}</div>`;
      }).join('');
      const isCollapsed = collapsedBlocks.has(id);
      return `<span class="toggle" data-block-id="${id}">${isCollapsed ? '▶' : '▼'}</span><span class="v-bracket">{</span><span class="v-count">${keys.length}</span><div class="block ${isCollapsed ? 'hide' : ''}" data-block-id="${id}">${items}</div><span class="v-bracket">}</span>`;
    }

    return String(data);
  };

  /** Rendered JSON HTML */
  const renderedJson = useMemo(() => {
    if (!isJson || !content.trim()) return '';
    try {
      idCounter = 0; // Reset counter for each render
      const parsed = JSON.parse(content);
      return renderJson(parsed);
    } catch {
      return '';
    }
  }, [content, isJson, collapsedBlocks]);

  /** Handle click on toggle */
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('toggle')) {
      const blockId = target.getAttribute('data-block-id');
      if (blockId) {
        toggleBlock(blockId);
      }
    }
  }, [toggleBlock]);

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
        </div>
      )}
      {isJson ? (
        <div
          className="json-content"
          onClick={handleClick}
          dangerouslySetInnerHTML={{ __html: renderedJson }}
        />
      ) : (
        <pre className="raw-content">{content}</pre>
      )}
    </div>
  );
};

export default JsonViewer;
