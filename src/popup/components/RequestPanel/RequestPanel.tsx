import React, { useState } from 'react';
import { useStore } from '@/store';
import { requestService, curlParser, variableService, curlGenerator } from '@/services';
import MethodSelector from './MethodSelector';
import HeadersEditor from './HeadersEditor';
import BodyEditor from './BodyEditor';
import ParamsEditor from './ParamsEditor';
import AuthEditor from './AuthEditor';
import './RequestPanel.scss';

/**
 * Request tab type
 */
type RequestTab = 'params' | 'authorization' | 'headers' | 'body';

/**
 * Request panel component
 * URL input, method selection, headers/body/auth editing
 */
const RequestPanel: React.FC = () => {
  const { currentRequest, updateRequest, isLoading, setLoading, setError, setResponse, addHistory, variables } = useStore();
  const [activeTab, setActiveTab] = useState<RequestTab>('body');

  /** Detect pasted content for curl command */
  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');

    // Detect curl command
    if (pastedText.trim().startsWith('curl')) {
      e.preventDefault();

      try {
        const request = curlParser.parse(pastedText);

        // Auto-format JSON body if present
        if (request.body.type === 'raw' && request.body.content.trim()) {
          try {
            const parsed = JSON.parse(request.body.content);
            request.body.content = JSON.stringify(parsed, null, 2);
          } catch {
            // Not valid JSON, keep original
          }
        }

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
      // Process variable substitution
      const processedRequest = variableService.processRequest(currentRequest, variables);

      // Smart add protocol
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

      // Save to history (use original request to preserve variable references)
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

  /** Copy request as curl command */
  const handleCopyAsCurl = async () => {
    // Process variables before generating curl
    const processedRequest = variableService.processRequest(currentRequest, variables);
    processedRequest.url = variableService.normalizeUrl(processedRequest.url);

    const curlCommand = curlGenerator.generate(processedRequest);

    try {
      await navigator.clipboard.writeText(curlCommand);
      // Brief visual feedback could be added here
    } catch {
      // Clipboard write failed
    }
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
          className="btn btn-secondary copy-curl-btn"
          onClick={handleCopyAsCurl}
          title="Copy as curl"
        >
          📋
        </button>
        <button
          className="btn btn-primary send-btn"
          onClick={handleSend}
          disabled={isLoading || !currentRequest.url.trim()}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>

      {/* Tab switcher - Postman style */}
      <div className="request-tabs">
        <button
          className={`tab-btn ${activeTab === 'params' ? 'active' : ''}`}
          onClick={() => setActiveTab('params')}
        >
          Params
        </button>
        <button
          className={`tab-btn ${activeTab === 'authorization' ? 'active' : ''}`}
          onClick={() => setActiveTab('authorization')}
        >
          Authorization
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
        {activeTab === 'params' && <ParamsEditor />}
        {activeTab === 'authorization' && <AuthEditor />}
        {activeTab === 'headers' && <HeadersEditor />}
        {activeTab === 'body' && <BodyEditor />}
      </div>
    </div>
  );
};

export default RequestPanel;