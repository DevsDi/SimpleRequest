import React from 'react';
import { useStore } from '@/store';
import { storageService } from '@/services';
import { formatTime } from '@/utils/timeUtils';
import { HistoryEntry } from '@/types';
import './HistoryPanel.scss';

/**
 * History panel component
 * Shows request history list, click to reload
 */
const HistoryPanel: React.FC = () => {
  const { history, setCurrentRequest, clearHistory } = useStore();

  /** Click history item to load into current request */
  const handleItemClick = (entry: HistoryEntry) => {
    setCurrentRequest(entry.request);
  };

  /** Clear history */
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
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryPanel;