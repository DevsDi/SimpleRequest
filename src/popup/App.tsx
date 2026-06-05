import React, { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { storageService } from '@/services';
import RequestPanel from './components/RequestPanel';
import ResponsePanel from './components/ResponsePanel';
import HistoryPanel from './components/HistoryPanel';
import VariablesPanel from './components/VariablesPanel';
import './App.scss';

/**
 * Main App component
 */
const App: React.FC = () => {
  const { isLoading, error, setHistory, variables, setVariables } = useStore();
  // Request section height
  const [requestHeight, setRequestHeight] = useState(280);
  const [isDraggingH, setIsDraggingH] = useState(false);
  // Sidebar width
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [isDraggingW, setIsDraggingW] = useState(false);
  // Sidebar active tab
  const [sidebarTab, setSidebarTab] = useState<'history' | 'variables'>('history');

  /** Initialize and load history */
  useEffect(() => {
    const loadHistory = async () => {
      const history = await storageService.getHistory();
      setHistory(history);
    };
    loadHistory();

    // Load saved settings
    const savedHeight = localStorage.getItem('requestHeight');
    const savedWidth = localStorage.getItem('sidebarWidth');
    if (savedHeight) setRequestHeight(parseInt(savedHeight));
    if (savedWidth) setSidebarWidth(parseInt(savedWidth));
  }, [setHistory]);

  /** Load variables */
  useEffect(() => {
    const loadVariables = async () => {
      const vars = await storageService.getVariables();
      setVariables(vars);
    };
    loadVariables();
  }, [setVariables]);

  /** Save variables when changed */
  useEffect(() => {
    if (variables.length > 0 || useStore.getState().variables.length === 0) {
      storageService.setVariables(variables);
    }
  }, [variables]);

  /** Horizontal drag - request/response divider */
  const handleHMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingH(true);
  };

  useEffect(() => {
    if (!isDraggingH) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.querySelector('.app-content');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newHeight = e.clientY - rect.top;
      if (newHeight >= 120 && newHeight <= rect.height - 100) {
        setRequestHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingH(false);
      localStorage.setItem('requestHeight', requestHeight.toString());
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingH, requestHeight]);

  /** Vertical drag - sidebar divider */
  const handleWMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingW(true);
  };

  useEffect(() => {
    if (!isDraggingW) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      if (newWidth >= 150 && newWidth <= 400) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingW(false);
      localStorage.setItem('sidebarWidth', sidebarWidth.toString());
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingW, sidebarWidth]);

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h1 className="app-title">SimpleRequest</h1>
      </header>

      {/* Main content */}
      <div className="app-main">
        {/* Left sidebar - history/variables */}
        <aside
          className="app-sidebar"
          style={{ width: sidebarWidth, minWidth: sidebarWidth }}
        >
          {/* Sidebar tabs */}
          <div className="sidebar-tabs">
            <button
              className={`tab-btn ${sidebarTab === 'history' ? 'active' : ''}`}
              onClick={() => setSidebarTab('history')}
            >
              History
            </button>
            <button
              className={`tab-btn ${sidebarTab === 'variables' ? 'active' : ''}`}
              onClick={() => setSidebarTab('variables')}
            >
              Variables
            </button>
          </div>
          {/* Tab content */}
          <div className="sidebar-content">
            {sidebarTab === 'history' && <HistoryPanel />}
            {sidebarTab === 'variables' && <VariablesPanel />}
          </div>
        </aside>

        {/* Sidebar divider */}
        <div
          className={`resize-handle-v ${isDraggingW ? 'dragging' : ''}`}
          onMouseDown={handleWMouseDown}
        />

        {/* Right content - request/response */}
        <main className="app-content">
          {/* Request panel */}
          <section
            className="request-section"
            style={{ height: requestHeight, minHeight: requestHeight }}
          >
            <RequestPanel />
          </section>

          {/* Horizontal divider */}
          <div
            className={`resize-handle-h ${isDraggingH ? 'dragging' : ''}`}
            onMouseDown={handleHMouseDown}
          >
            <div className="resize-line-h" />
          </div>

          {/* Response panel */}
          <section className="response-section">
            {error && <div className="error-message">{error}</div>}
            {isLoading ? <div className="loading">Loading...</div> : <ResponsePanel />}
          </section>
        </main>
      </div>
    </div>
  );
};

export default App;