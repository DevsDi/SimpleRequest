import React, { useState } from 'react';
import { HttpResponse } from '@/types';
import JsonViewer from './JsonViewer';
import HeadersViewer from './HeadersViewer';
import { formatResponseTime, formatSize } from '@/utils/timeUtils';
import './ResponsePanel.scss';

/**
 * Response tab type
 */
type ResponseTab = 'body' | 'headers';

/**
 * ResponsePanel 组件 Props
 */
interface ResponsePanelProps {
  response: HttpResponse | null;
}

/**
 * Response panel component
 * Displays HTTP response data: status code, body, headers
 */
const ResponsePanel: React.FC<ResponsePanelProps> = ({ response }) => {
  const [activeTab, setActiveTab] = useState<ResponseTab>('body');
  const [showRaw, setShowRaw] = useState(false);

  /** Copy response body */
  const handleCopyBody = async () => {
    if (!response) return;
    try {
      await navigator.clipboard.writeText(response.body);
    } catch {}
  };

  /** Copy all headers */
  const handleCopyHeaders = async () => {
    if (!response) return;
    const headerText = Object.entries(response.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(headerText);
    } catch {}
  };

  if (!response) {
    return (
      <div className="response-panel empty">
        <p className="empty-hint">Send request to view response</p>
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

  /** Check if JSON */
  const isJson = (): boolean => {
    try {
      JSON.parse(response.body);
      return true;
    } catch {
      return false;
    }
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
        <div className="tab-actions">
          {activeTab === 'body' && (
            <>
              {isJson() && (
                <button
                  className={`action-btn ${showRaw ? 'active' : ''}`}
                  onClick={() => setShowRaw(!showRaw)}
                  title="Toggle raw view"
                >
                  Raw
                </button>
              )}
              <button className="action-btn" onClick={handleCopyBody} title="Copy body">
                Copy
              </button>
            </>
          )}
          {activeTab === 'headers' && (
            <button className="action-btn" onClick={handleCopyHeaders} title="Copy headers">
              Copy
            </button>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="response-content">
        {activeTab === 'body' && (
          showRaw ? (
            <pre className="raw-body">{response.body}</pre>
          ) : (
            <JsonViewer content={response.body} />
          )
        )}
        {activeTab === 'headers' && <HeadersViewer headers={response.headers} />}
      </div>
    </div>
  );
};

export default ResponsePanel;