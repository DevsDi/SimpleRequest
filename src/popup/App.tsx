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
    getTabsData,
    getCurrentResponse,
    isLoading,
    error,
    setHistory,
    variables,
    setVariables,
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

  /** 初始化加载 */
  useEffect(() => {
    const loadData = async () => {
      // 加载 Tab 数据
      const tabsData = await storageService.loadTabsData();
      if (tabsData) {
        initTabs(tabsData);
      } else {
        // 没有存储数据，初始化默认 Tab
        initTabs({
          tabs: [],
          requests: {},
          responses: {},
          activeTabId: null,
        });
      }

      // 加载历史记录
      const history = await storageService.getHistory();
      setHistory(history);
    };
    loadData();

    // 加载保存的布局设置
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

  /** 自动保存 Tab 数据 */
  useEffect(() => {
    // 跳过初始加载
    if (tabs.length === 0) return;

    const saveData = () => {
      const data = getTabsData();
      storageService.saveTabsData(data);
    };

    // debounce 保存
    const timer = setTimeout(saveData, 300);
    return () => clearTimeout(timer);
  }, [tabs, requests, activeTabId, getTabsData]);

  /** 页面关闭前保存 */
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

  /** 双击分隔条重置到默认 50:50 */
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
      // 放宽拖拽边界：上下各保留 40px,基本可拖到极限
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

      {/* Tab Bar */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        requests={requests}
        onAddTab={addTab}
        onCloseTab={closeTab}
        onSwitchTab={switchTab}
      />

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
            title="拖动调整高度,双击重置"
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