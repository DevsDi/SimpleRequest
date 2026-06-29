import React, { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { storageService } from '@/services';
import RequestPanel from './components/RequestPanel';
import ResponsePanel from './components/ResponsePanel';
import HistoryPanel from './components/HistoryPanel';
import VariablesPanel from './components/VariablesPanel';
import TabBar from './components/TabBar';
import DonateModal from './components/DonateModal';
import './App.scss';

/**
 * Main App component
 */
const App: React.FC = () => {
  const {
    tabs,
    requests,
    activeTabId,
    initTabs,
    addTab,
    closeTab,
    switchTab,
    duplicateTab,
    closeOtherTabs,
    closeAllTabs,
    getTabsData,
    getCurrentResponse,
    isLoading,
    error,
    setHistory,
    variables,
    setVariables,
    loadRequestToNewTab,
  } = useStore();

  // Request section height (null = use CSS flex default 50:50)
  const [requestHeight, setRequestHeight] = useState<number | null>(null);
  const [isDraggingH, setIsDraggingH] = useState(false);
  // Sidebar width
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isDraggingW, setIsDraggingW] = useState(false);
  // Sidebar active tab
  const [sidebarTab, setSidebarTab] = useState<'history' | 'variables'>('history');
  // Donate modal
  const [showDonate, setShowDonate] = useState(false);

  /** Initialize and load data */
  useEffect(() => {
    const loadData = async () => {
      // Load tab data
      const tabsData = await storageService.loadTabsData();
      if (tabsData) {
        initTabs(tabsData);
      } else {
        // No stored data, initialize default tab
        initTabs({
          tabs: [],
          requests: {},
          responses: {},
          activeTabId: null,
        });
      }

      // Load history records
      const history = await storageService.getHistory();
      setHistory(history);
    };
    loadData();

    // Load saved layout settings
    const savedHeight = localStorage.getItem('requestHeight');
    const savedWidth = localStorage.getItem('sidebarWidth');
    if (savedHeight) {
      const h = parseInt(savedHeight, 10);
      if (!isNaN(h) && h >= 40) {
        setRequestHeight(h);
      }
    }
    if (savedWidth) {
      const w = parseInt(savedWidth, 10);
      if (!isNaN(w) && w >= 150) {
        setSidebarWidth(w);
      }
    }
  }, [initTabs, setHistory]);

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

  /** Auto-save tab data */
  useEffect(() => {
    const saveData = () => {
      const data = getTabsData();
      storageService.saveTabsData(data);
    };

    // Empty state also needs saving to ensure old data in storage is cleared
    if (tabs.length === 0) {
      saveData();
      return;
    }

    // Debounce save
    const timer = setTimeout(saveData, 300);
    return () => clearTimeout(timer);
  }, [tabs, requests, activeTabId, getTabsData]);

  /** Save before page close */
  useEffect(() => {
    const handleBeforeUnload = () => {
      const data = getTabsData();
      storageService.saveTabsData(data);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [getTabsData]);

  /** Horizontal drag - request/response divider */
  const handleHMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingH(true);
  };

  /** Double-click divider to reset to default 50:50 */
  const handleHDoubleClick = () => {
    setRequestHeight(null);
    localStorage.removeItem('requestHeight');
  };

  useEffect(() => {
    if (!isDraggingH) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.querySelector('.app-content');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newHeight = e.clientY - rect.top;
      // Relax drag boundaries: keep 40px at top and bottom, basically can drag to limit
      const minHeight = 40;
      const maxHeight = rect.height - 40;
      if (newHeight >= minHeight && newHeight <= maxHeight) {
        setRequestHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingH(false);
      if (requestHeight) {
        localStorage.setItem('requestHeight', requestHeight.toString());
      }
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
      if (newWidth >= 150 && newWidth <= 500) {
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
        <div className="header-left">
          <h1 className="app-title">SimpleRequest</h1>
          <button
            className="donate-header-btn"
            onClick={() => setShowDonate(true)}
            title="Support this project"
          >
            ☕
          </button>
        </div>
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
          {/* Tab Bar - above URL */}
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            requests={requests}
            onAddTab={addTab}
            onCloseTab={closeTab}
            onSwitchTab={switchTab}
            onDuplicateTab={duplicateTab}
            onCloseOtherTabs={closeOtherTabs}
            onCloseAllTabs={closeAllTabs}
          />

          {/* Request panel */}
          <section
            className="request-section"
            style={
              requestHeight
                ? { flex: '0 0 auto', height: requestHeight }
                : undefined
            }
          >
            <RequestPanel />
          </section>

          {/* Horizontal divider */}
          <div
            className={`resize-handle-h ${isDraggingH ? 'dragging' : ''}`}
            onMouseDown={handleHMouseDown}
            onDoubleClick={handleHDoubleClick}
            title="Drag to resize, double-click to reset"
          >
            <div className="resize-line-h" />
          </div>

          {/* Response panel */}
          <section className="response-section">
            {error && <div className="error-message">{error}</div>}
            {isLoading ? <div className="loading">Loading...</div> : (
              <ResponsePanel response={getCurrentResponse()} />
            )}
          </section>
        </main>
      </div>

      {/* Donate Modal */}
      <DonateModal isOpen={showDonate} onClose={() => setShowDonate(false)} />
    </div>
  );
};

export default App;