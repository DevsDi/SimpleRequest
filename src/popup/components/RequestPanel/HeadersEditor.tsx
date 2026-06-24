import React, { useState } from 'react';
import { useStore } from '@/store';
import { Header } from '@/types';
import { COMMON_HEADERS, HEADER_SUGGESTIONS } from '@/utils/constants';
import './HeadersEditor.scss';

/**
 * Headers editor component
 * Add, edit, delete, enable/disable headers with autocomplete
 */
const HeadersEditor: React.FC = () => {
  const { getCurrentRequest, updateCurrentRequest } = useStore();
  const currentRequest = getCurrentRequest();

  if (!currentRequest) return null;

  const [suggestions, setSuggestions] = useState<typeof HEADER_SUGGESTIONS>([]);
  const [suggestIndex, setSuggestIndex] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  /** Add new header */
  const addHeader = () => {
    const newHeader: Header = {
      key: '',
      value: '',
      enabled: true,
    };
    updateCurrentRequest({
      headers: [...currentRequest.headers, newHeader],
    });
  };

  /** Add preset header */
  const addPresetHeader = (header: Header) => {
    updateCurrentRequest({
      headers: [...currentRequest.headers, { ...header }],
    });
  };

  /** Update header */
  const updateHeader = (index: number, field: keyof Header, value: string | boolean) => {
    const newHeaders = [...currentRequest.headers];
    newHeaders[index] = { ...newHeaders[index], [field]: value };
    updateCurrentRequest({ headers: newHeaders });
  };

  /** Remove header */
  const removeHeader = (index: number) => {
    const newHeaders = currentRequest.headers.filter((_, i) => i !== index);
    updateCurrentRequest({ headers: newHeaders });
    setFocusedIndex(null);
    setSuggestions([]);
  };

  /** Handle key input - show suggestions */
  const handleKeyInput = (index: number, value: string) => {
    updateHeader(index, 'key', value);
    setFocusedIndex(index);

    if (value.trim()) {
      const filtered = HEADER_SUGGESTIONS.filter(h =>
        h.key.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 10));
      setSuggestIndex(0);
    } else {
      setSuggestions(HEADER_SUGGESTIONS.slice(0, 10));
      setSuggestIndex(0);
    }
  };

  /** Handle focus - show suggestions */
  const handleFocus = (index: number, value: string) => {
    setFocusedIndex(index);
    if (value.trim()) {
      const filtered = HEADER_SUGGESTIONS.filter(h =>
        h.key.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 10));
    } else {
      setSuggestions(HEADER_SUGGESTIONS.slice(0, 10));
    }
    setSuggestIndex(0);
  };

  /** Select suggestion */
  const selectSuggestion = (index: number, suggestion: typeof HEADER_SUGGESTIONS[0]) => {
    updateHeader(index, 'key', suggestion.key);
    setSuggestions([]);
    setFocusedIndex(null);
  };

  /** Handle keyboard navigation */
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSuggestIndex(Math.min(suggestIndex + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSuggestIndex(Math.max(suggestIndex - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      selectSuggestion(index, suggestions[suggestIndex]);
    } else if (e.key === 'Escape') {
      setSuggestions([]);
    }
  };

  /** Blur handler - close suggestions */
  const handleBlur = () => {
    setTimeout(() => {
      setSuggestions([]);
      setFocusedIndex(null);
    }, 150);
  };

  return (
    <div className="headers-editor">
      {/* Quick presets */}
      <div className="preset-headers">
        <span className="preset-label">Quick:</span>
        {COMMON_HEADERS.map((header, idx) => (
          <button
            key={idx}
            className="preset-btn"
            onClick={() => addPresetHeader(header)}
            title={`${header.key}: ${header.value}`}
          >
            {header.key}
          </button>
        ))}
      </div>

      {/* Headers list */}
      <div className="headers-list">
        {currentRequest.headers.map((header, index) => (
          <div key={index} className="header-row">
            <input
              type="checkbox"
              className="header-checkbox"
              checked={header.enabled}
              onChange={(e) => updateHeader(index, 'enabled', e.target.checked)}
            />
            <div className="header-key-wrapper">
              <input
                type="text"
                className="header-key"
                placeholder="Header name"
                value={header.key}
                onChange={(e) => handleKeyInput(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onFocus={() => handleFocus(index, header.key)}
                onBlur={handleBlur}
              />
              {/* Suggestion dropdown */}
              {focusedIndex === index && suggestions.length > 0 && (
                <div className="header-suggestions">
                  {suggestions.map((s, sidx) => (
                    <div
                      key={s.key}
                      className={`suggestion-item ${sidx === suggestIndex ? 'active' : ''}`}
                      onMouseDown={() => selectSuggestion(index, s)}
                    >
                      <span className="suggestion-key">{s.key}</span>
                      <span className="suggestion-desc">{s.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <input
              type="text"
              className="header-value"
              placeholder="Header value"
              value={header.value}
              onChange={(e) => updateHeader(index, 'value', e.target.value)}
            />
            <button
              className="remove-btn"
              onClick={() => removeHeader(index)}
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}

        {/* Empty state */}
        {currentRequest.headers.length === 0 && (
          <div className="empty-hint">No custom headers</div>
        )}
      </div>

      {/* Add button */}
      <button className="btn btn-secondary add-header-btn" onClick={addHeader}>
        + Add Header
      </button>
    </div>
  );
};

export default HeadersEditor;