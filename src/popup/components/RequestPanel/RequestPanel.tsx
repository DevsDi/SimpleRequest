import React, { useState } from 'react';
import { useStore } from '@/store';
import { requestService, curlParser, variableService } from '@/services';
import MethodSelector from './MethodSelector';
import HeadersEditor from './HeadersEditor';
import BodyEditor from './BodyEditor';
import './RequestPanel.scss';

/**
 * Request tab type
 */
type RequestTab = 'params' | 'headers' | 'body';

/**
 * Request panel component
 * URL input, method selection, headers/body editing
 */
const RequestPanel: React.FC = () => {
  const { currentRequest, updateRequest, isLoading, setLoading, setError, setResponse, addHistory, variables } = useStore();
  const [activeTab, setActiveTab] = useState<RequestTab>('headers');

  /** Detect pasted content for curl command */
  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');

    // Detect curl command
    if (pastedText.trim().startsWith('curl')) {
      e.preventDefault();

      try {
        const request = curlParser.parse(pastedText);
        useStore.getState().setCurrentRequest(request);

        // Switch to appropriate tab
        if (request.body.type !== 'none' && request.body.content) {
          setActiveTab('body');
        } else if (request.headers.length > 0) {
          setActiveTab('headers');
        }
      } catch {
        // Parse failed, continue normal paste
        updateRequest({ url: pastedText });
      }
    }
  };

  /** Handle send request */
  const handleSend = async () => {
    if (!currentRequest.url.trim()) {
      setError('Please enter request URL');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      // 处理变量替换
      const processedRequest = variableService.processRequest(currentRequest, variables);

      // 智能添加协议
      processedRequest.url = variableService.normalizeUrl(processedRequest.url);

      // Update request name
      const request = {
        ...processedRequest,
        name: processedRequest.url.split('?')[0].slice(-50),
        updatedAt: Date.now(),
      };

      // Send request
      const response = await requestService.execute(request);
      setResponse(response);

      // Save to history (使用原始请求，保留变量引用)
      await requestService.saveToHistory(currentRequest, response);
      addHistory({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        request: currentRequest,
        response,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  /** Handle URL change */
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateRequest({ url: e.target.value });
  };

  /** Handle method change */
  const handleMethodChange = (method: string) => {
    updateRequest({ method: method as typeof currentRequest.method });
  };

  return (
    <div className="request-panel">
      {/* URL input row */}
      <div className="url-bar">
        <MethodSelector
          value={currentRequest.method}
          onChange={handleMethodChange}
        />
        <input
          type="text"
          className="url-input"
          placeholder="Enter URL or paste curl command..."
          value={currentRequest.url}
          onChange={handleUrlChange}
          onPaste={handlePaste}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button
          className="btn btn-primary send-btn"
          onClick={handleSend}
          disabled={isLoading || !currentRequest.url.trim()}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>

      {/* Tab switcher */}
      <div className="request-tabs">
        <button
          className={`tab-btn ${activeTab === 'params' ? 'active' : ''}`}
          onClick={() => setActiveTab('params')}
        >
          Params
        </button>
        <button
          className={`tab-btn ${activeTab === 'headers' ? 'active' : ''}`}
          onClick={() => setActiveTab('headers')}
        >
          Headers
        </button>
        <button
          className={`tab-btn ${activeTab === 'body' ? 'active' : ''}`}
          onClick={() => setActiveTab('body')}
        >
          Body
        </button>
      </div>

      {/* Tab content */}
      <div className="request-content">
        {activeTab === 'params' && (
          <div className="params-tab">
            <p className="hint">URL params are parsed automatically</p>
          </div>
        )}
        {activeTab === 'headers' && <HeadersEditor />}
        {activeTab === 'body' && <BodyEditor />}
      </div>
    </div>
  );
};

export default RequestPanel;