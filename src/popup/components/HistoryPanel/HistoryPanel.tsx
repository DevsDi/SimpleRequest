import React from 'react';
import { useStore } from '@/store';
import { storageService } from '@/services';
import { formatTime } from '@/utils/timeUtils';
import { HistoryEntry } from '@/types';
import './HistoryPanel.scss';

/**
 * History panel component
 * Shows request history list, click to reload, delete single or clear all
 */
const HistoryPanel: React.FC = () => {
  const { history, loadRequestToNewTab, removeHistory, clearHistory } = useStore();

  /** 点击历史记录项，加载到新 Tab */
  const handleItemClick = (entry: HistoryEntry) => {
    loadRequestToNewTab(entry.request);
  };

  /** Delete single history entry */
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent triggering item click
    removeHistory(id);
    // Also remove from persistent storage
    const updated = history.filter((entry) => entry.id !== id);
    await storageService.setHistory(updated);
  };

  /** Clear all history */
  const handleClear = async () => {
    await storageService.clearHistory();
    clearHistory();
  };

  /** Get method color */
  const getMethodColor = (method: string): string => {
    const colors: Record<string, string> = {
      GET: 'var(--method-get)',
      POST: 'var(--method-post)',
      PUT: 'var(--method-put)',
      DELETE: 'var(--method-delete)',
      PATCH: 'var(--method-patch)',
      HEAD: '#17a2b8',
      OPTIONS: '#6c757d',
    };
    return colors[method] || 'var(--text-primary)';
  };

  if (history.length === 0) {
    return (
      <div className="history-panel empty">
        <p className="empty-hint">No history</p>
      </div>
    );
  }

  return (
    <div className="history-panel">
      {/* Title bar */}
      <div className="history-header">
        <h3 className="history-title">History</h3>
        <button className="clear-btn" onClick={handleClear} title="Clear all">
          Clear
        </button>
      </div>

      {/* History list */}
      <div className="history-list">
        {history.map((entry: HistoryEntry) => (
          <div
            key={entry.id}
            className="history-item"
            onClick={() => handleItemClick(entry)}
          >
            <div className="item-method" style={{ color: getMethodColor(entry.request.method) }}>
              {entry.request.method}
            </div>
            <div className="item-info">
              <div className="item-url">{entry.request.url.split('?')[0]}</div>
              <div className="item-time">{formatTime(entry.timestamp)}</div>
            </div>
            {entry.response && (
              <div
                className="item-status"
                style={{
                  color: entry.response.status < 400 ? '#28a745' : '#dc3545',
                }}
              >
                {entry.response.status}
              </div>
            )}
            <button
              className="item-delete-btn"
              onClick={(e) => handleDelete(e, entry.id)}
              title="Delete"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryPanel;
