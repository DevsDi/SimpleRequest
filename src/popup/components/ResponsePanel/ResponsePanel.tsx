import React, { useState } from 'react';
import { useStore } from '@/store';
import JsonViewer from './JsonViewer';
import HeadersViewer from './HeadersViewer';
import { formatResponseTime, formatSize } from '@/utils/timeUtils';
import './ResponsePanel.scss';

/**
 * Response tab type
 */
type ResponseTab = 'body' | 'headers';

/**
 * Response panel component
 * Displays HTTP response data: status code, body, headers
 */
const ResponsePanel: React.FC = () => {
  const { response } = useStore();
  const [activeTab, setActiveTab] = useState<ResponseTab>('body');

  if (!response) {
    return (
      <div className="response-panel empty">
        <p className="empty-hint">Response will appear here after sending request</p>
      </div>
    );
  }

  /** Get status color */
  const getStatusColor = (status: number): string => {
    if (status >= 200 && status < 300) return '#10b981';
    if (status >= 300 && status < 400) return '#3b82f6';
    if (status >= 400 && status < 500) return '#f59e0b';
    if (status >= 500) return '#ef4444';
    return '#cdd6f4';
  };

  return (
    <div className="response-panel">
      {/* Status bar */}
      <div className="status-bar">
        <span className="status-code" style={{ color: getStatusColor(response.status) }}>
          {response.status} {response.statusText}
        </span>
        <span className="response-time">{formatResponseTime(response.time)}</span>
        <span className="response-size">{formatSize(response.size)}</span>
      </div>

      {/* Tab switcher */}
      <div className="response-tabs">
        <button
          className={`tab-btn ${activeTab === 'body' ? 'active' : ''}`}
          onClick={() => setActiveTab('body')}
        >
          Body
        </button>
        <button
          className={`tab-btn ${activeTab === 'headers' ? 'active' : ''}`}
          onClick={() => setActiveTab('headers')}
        >
          Headers
        </button>
      </div>

      {/* Tab content */}
      <div className="response-content">
        {activeTab === 'body' && <JsonViewer content={response.body} />}
        {activeTab === 'headers' && <HeadersViewer headers={response.headers} />}
      </div>
    </div>
  );
};

export default ResponsePanel;