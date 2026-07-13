import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '@/store';
import { requestService, curlParser, variableService, curlGenerator } from '@/services';
import MethodSelector from './MethodSelector';
import HeadersEditor from './HeadersEditor';
import BodyEditor from './BodyEditor';
import ParamsEditor from './ParamsEditor';
import AuthEditor from './AuthEditor';
import VariableAutocomplete from './VariableAutocomplete';
import TimeoutInput from './TimeoutInput';
import RetryInput from './RetryInput';
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
  const { getCurrentRequest, updateCurrentRequest, isLoading, setLoading, setError, setCurrentResponse, addHistory, variables, activeTabId } = useStore();
  const [activeTab, setActiveTab] = useState<RequestTab>('body');

  // 变量自动提示状态
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteFilter, setAutocompleteFilter] = useState('');
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const urlInputRef = useRef<HTMLInputElement>(null);

  // 获取当前请求
  const currentRequest = getCurrentRequest();

  /**
   * 检测光标位置是否在变量语法内
   * 返回 {{ 后的文本，如果没有则返回 null
   */
  const detectVariableTrigger = useCallback((input: HTMLInputElement): string | null => {
    const value = input.value;
    const cursorPos = input.selectionStart || 0;

    // 查找光标前最近的 {{
    const beforeCursor = value.slice(0, cursorPos);
    const lastBraceIndex = beforeCursor.lastIndexOf('{{');

    if (lastBraceIndex === -1) return null;

    // 检查 {{ 后是否有 }}（如果有说明变量已完整，不触发）
    const afterBrace = value.slice(lastBraceIndex + 2);
    const closeBraceIndex = afterBrace.indexOf('}}');

    // 如果 }} 存在且在光标之前，说明变量已完整
    if (closeBraceIndex !== -1 && closeBraceIndex < cursorPos - lastBraceIndex - 2) {
      return null;
    }

    // 返回 {{ 后到光标位置的文本
    return beforeCursor.slice(lastBraceIndex + 2);
  }, []);

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
        updateCurrentRequest({ url: pastedText });
      }
    }
  };

  /** Handle send request */
  const handleSend = async () => {
    if (!currentRequest?.url?.trim()) {
      setError('Please enter request URL');
      return;
    }

    setLoading(true);
    setError(null);
    setCurrentResponse(null);

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
      setCurrentResponse(response);

      // Save to history (use original request to preserve variable references)
      await requestService.saveToHistory(currentRequest, response, activeTabId || undefined);
      addHistory({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        request: currentRequest,
        response,
        timestamp: Date.now(),
        tabId: activeTabId || undefined,
      });
    } catch (err: any) {
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  /** Handle cancel request */
  const handleCancel = async () => {
    try {
      await requestService.cancel();
      setLoading(false);
      setError('Request cancelled');
    } catch (err) {
      console.warn('Cancel request failed:', err);
      setLoading(false);
    }
  };

  /**
   * 处理 URL 输入框变化
   */
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateCurrentRequest({ url: e.target.value });
  };

  /**
   * 处理 URL 输入框按键和输入事件
   */
  const handleUrlInput = (e: React.FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const trigger = detectVariableTrigger(input);

    if (trigger !== null) {
      setAutocompleteFilter(trigger);

      // 计算下拉菜单位置
      const rect = input.getBoundingClientRect();
      setAutocompletePosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
      setShowAutocomplete(true);
    } else {
      setShowAutocomplete(false);
    }
  };

  /**
   * 处理变量选择
   */
  const handleVariableSelect = (variableName: string) => {
    const input = urlInputRef.current;
    if (!input) return;

    const value = input.value;
    const cursorPos = input.selectionStart || 0;

    // 找到 {{ 的位置
    const beforeCursor = value.slice(0, cursorPos);
    const lastBraceIndex = beforeCursor.lastIndexOf('{{');

    if (lastBraceIndex === -1) return;

    // 构建新值：保留 {{ 前的部分 + {{variableName}} + 光标后的部分
    const newValue =
      value.slice(0, lastBraceIndex) +
      `{{${variableName}}}` +
      value.slice(cursorPos);

    updateCurrentRequest({ url: newValue });
    setShowAutocomplete(false);

    // 设置光标位置到 }} 之后
    const newCursorPos = lastBraceIndex + variableName.length + 4;
    setTimeout(() => {
      input.setSelectionRange(newCursorPos, newCursorPos);
      input.focus();
    }, 0);
  };

  /**
   * 关闭自动提示
   */
  const handleAutocompleteClose = () => {
    setShowAutocomplete(false);
  };

  /** Handle method change */
  const handleMethodChange = (method: string) => {
    updateCurrentRequest({ method: method as any });
  };

  /** Copy request as curl command */
  const handleCopyAsCurl = async () => {
    if (!currentRequest) return;

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

  // 如果没有当前请求，显示空状态
  if (!currentRequest) {
    return (
      <div className="request-panel">
        <div className="empty-state">
          <div className="empty-hint">Click + to create a new request</div>
        </div>
      </div>
    );
  }

  return (
    <div className="request-panel">
      {/* URL input row */}
      <div className="url-bar">
        <MethodSelector
          value={currentRequest.method}
          onChange={handleMethodChange}
        />
        <input
          ref={urlInputRef}
          type="text"
          className="url-input"
          placeholder="Enter URL or paste curl command..."
          value={currentRequest.url}
          onChange={handleUrlChange}
          onInput={handleUrlInput}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !showAutocomplete) {
              handleSend();
            }
          }}
        />
        <button
          className="btn btn-secondary copy-curl-btn"
          onClick={handleCopyAsCurl}
          title="Copy as curl"
        >
          📋
        </button>
        <TimeoutInput
          value={currentRequest.timeout || 30000}
          onChange={(timeout) => updateCurrentRequest({ timeout })}
        />
        <RetryInput
          retryCount={currentRequest.retryCount || 0}
          retryDelay={currentRequest.retryDelay || 1000}
          onRetryCountChange={(retryCount) => updateCurrentRequest({ retryCount })}
          onRetryDelayChange={(retryDelay) => updateCurrentRequest({ retryDelay })}
        />
        <button
          className={`btn ${isLoading ? 'btn-secondary' : 'btn-primary'} send-btn`}
          onClick={isLoading ? handleCancel : handleSend}
          disabled={!isLoading && !currentRequest?.url?.trim()}
        >
          {isLoading ? 'Cancel' : 'Send'}
        </button>
      </div>

      {/* 变量自动提示 */}
      {showAutocomplete && (
        <VariableAutocomplete
          variables={variables}
          filter={autocompleteFilter}
          position={autocompletePosition}
          onSelect={handleVariableSelect}
          onClose={handleAutocompleteClose}
        />
      )}

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