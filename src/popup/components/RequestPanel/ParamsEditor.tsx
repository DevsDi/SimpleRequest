import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useStore } from '@/store';
import './ParamsEditor.scss';

/**
 * Param item interface
 */
interface ParamItem {
  key: string;
  value: string;
  enabled: boolean;
}

/**
 * Params editor component
 * Parse URL query params, add/edit/delete params
 * Params stored independently, synced with URL
 */
const ParamsEditor: React.FC = () => {
  const { getCurrentRequest, updateCurrentRequest } = useStore();
  const currentRequest = getCurrentRequest();

  if (!currentRequest) return null;

  /** Parse initial params from URL */
  const parseParamsFromUrl = (url: string): ParamItem[] => {
    const queryIndex = url.indexOf('?');
    if (queryIndex === -1) return [];

    const queryString = url.slice(queryIndex + 1);
    const hashIndex = queryString.indexOf('#');
    const query = hashIndex === -1 ? queryString : queryString.slice(0, hashIndex);

    if (!query) return [];

    return query.split('&').map((pair) => {
      const [key, value] = pair.split('=').map((s) => {
        try { return decodeURIComponent(s || ''); } catch { return s || ''; }
      });
      return { key, value, enabled: true };
    });
  };

  /** Independent params state */
  const [params, setParams] = useState<ParamItem[]>(() => parseParamsFromUrl(currentRequest.url));

  /** Keep a ref to params to avoid stale closure in useEffect */
  const paramsRef = useRef(params);
  paramsRef.current = params;

  /** Sync params when URL changes from outside (e.g. paste curl, user edits URL bar) */
  useEffect(() => {
    const parsed = parseParamsFromUrl(currentRequest.url);
    const currentQuery = paramsRef.current.filter(p => p.key.trim()).map(p => `${p.key}=${p.value}`).join('&');
    const newQuery = parsed.map(p => `${p.key}=${p.value}`).join('&');
    // Sync when queries differ (including when URL query is removed -> parsed becomes empty)
    if (currentQuery !== newQuery) {
      setParams(parsed);
    }
  }, [currentRequest.url]);

  /** Build URL from params */
  const buildUrl = useCallback((baseUrl: string, newParams: ParamItem[]) => {
    const hashIndex = baseUrl.indexOf('#');
    const baseWithoutHash = hashIndex === -1 ? baseUrl : baseUrl.slice(0, hashIndex);
    const hash = hashIndex === -1 ? '' : baseUrl.slice(hashIndex);

    const queryIndex = baseWithoutHash.indexOf('?');
    const urlBase = queryIndex === -1 ? baseWithoutHash : baseWithoutHash.slice(0, queryIndex);

    const enabledParams = newParams.filter((p) => p.enabled && p.key.trim());
    if (enabledParams.length === 0) {
      return urlBase + hash;
    }

    const queryString = enabledParams
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&');

    return `${urlBase}?${queryString}${hash}`;
  }, []);

  /** Update URL when params change */
  const syncUrl = useCallback((newParams: ParamItem[]) => {
    const newUrl = buildUrl(currentRequest.url, newParams);
    if (newUrl !== currentRequest.url) {
      updateCurrentRequest({ url: newUrl });
    }
  }, [currentRequest.url, buildUrl, updateCurrentRequest]);

  /** Add new param */
  const addParam = () => {
    const newParams = [...params, { key: '', value: '', enabled: true }];
    setParams(newParams);
    // Don't sync URL yet - empty key won't be added
  };

  /** Update param and sync URL */
  const updateParam = (index: number, field: keyof ParamItem, value: string | boolean) => {
    const newParams = [...params];
    newParams[index] = { ...newParams[index], [field]: value };
    setParams(newParams);
    // Sync URL if key has value
    if (field === 'key' && typeof value === 'string' && value.trim()) {
      syncUrl(newParams);
    } else if (field === 'value' && newParams[index].key.trim()) {
      syncUrl(newParams);
    }
  };

  /** Remove param */
  const removeParam = (index: number) => {
    const newParams = params.filter((_, i) => i !== index);
    setParams(newParams);
    syncUrl(newParams);
  };

  /** Toggle param enabled */
  const toggleParam = (index: number) => {
    const newParams = [...params];
    newParams[index] = { ...newParams[index], enabled: !newParams[index].enabled };
    setParams(newParams);
    syncUrl(newParams);
  };

  /** Move param up */
  const moveParamUp = (index: number) => {
    if (index === 0) return;
    const newParams = [...params];
    [newParams[index - 1], newParams[index]] = [newParams[index], newParams[index - 1]];
    setParams(newParams);
    syncUrl(newParams);
  };

  /** Move param down */
  const moveParamDown = (index: number) => {
    if (index === params.length - 1) return;
    const newParams = [...params];
    [newParams[index], newParams[index + 1]] = [newParams[index + 1], newParams[index]];
    setParams(newParams);
    syncUrl(newParams);
  };

  return (
    <div className="params-editor">
      {/* Params list */}
      <div className="params-list">
        {params.map((param, index) => (
          <div key={index} className={`param-row ${!param.enabled ? 'disabled' : ''}`}>
            <input
              type="checkbox"
              className="param-checkbox"
              checked={param.enabled}
              onChange={() => toggleParam(index)}
            />
            <input
              type="text"
              className="param-key"
              placeholder="Key"
              value={param.key}
              onChange={(e) => updateParam(index, 'key', e.target.value)}
              onBlur={() => syncUrl(params)}
            />
            <input
              type="text"
              className="param-value"
              placeholder="Value"
              value={param.value}
              onChange={(e) => updateParam(index, 'value', e.target.value)}
              onBlur={() => syncUrl(params)}
            />
            <div className="param-actions">
              <button
                className="action-btn"
                onClick={() => moveParamUp(index)}
                disabled={index === 0}
                title="Move up"
              >
                ↑
              </button>
              <button
                className="action-btn"
                onClick={() => moveParamDown(index)}
                disabled={index === params.length - 1}
                title="Move down"
              >
                ↓
              </button>
              <button
                className="remove-btn"
                onClick={() => removeParam(index)}
                title="Remove"
              >
                ×
              </button>
            </div>
          </div>
        ))}

        {/* Empty state */}
        {params.length === 0 && (
          <div className="empty-hint">
            No query parameters. Add params to build URL query string.
          </div>
        )}
      </div>

      {/* Add button */}
      <button className="btn btn-secondary add-param-btn" onClick={addParam}>
        + Add Param
      </button>

      {/* URL preview */}
      {params.filter(p => p.key.trim()).length > 0 && (
        <div className="url-preview">
          <span className="preview-label">URL Preview:</span>
          <div className="preview-url">{currentRequest.url}</div>
        </div>
      )}
    </div>
  );
};

export default ParamsEditor;