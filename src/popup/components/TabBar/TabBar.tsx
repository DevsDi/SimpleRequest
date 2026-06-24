import React from 'react';
import { Tab, HttpRequest } from '@/types';
import './TabBar.scss';

/**
 * TabBar 组件 Props
 */
interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  requests: Record<string, HttpRequest>;
  onAddTab: () => void;
  onCloseTab: (id: string) => void;
  onSwitchTab: (id: string) => void;
}

/**
 * HTTP 方法对应的颜色类名
 */
const METHOD_COLORS: Record<string, string> = {
  GET: 'method-get',
  POST: 'method-post',
  PUT: 'method-put',
  PATCH: 'method-patch',
  DELETE: 'method-delete',
  HEAD: 'method-head',
  OPTIONS: 'method-options',
};

/**
 * TabBar 组件
 * Postman 风格的标签栏
 */
const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  requests,
  onAddTab,
  onCloseTab,
  onSwitchTab,
}) => {
  return (
    <div className="tab-bar">
      <div className="tabs-container">
        {tabs.map((tab) => {
          const request = requests[tab.id];
          const method = request?.method || 'GET';
          const isActive = tab.id === activeTabId;
          const isOnlyTab = tabs.length === 1;

          return (
            <div
              key={tab.id}
              className={`tab-item ${isActive ? 'active' : ''}`}
              onClick={() => onSwitchTab(tab.id)}
              title={tab.name}
            >
              <span className={`tab-method ${METHOD_COLORS[method] || ''}`}>
                {method}
              </span>
              <span className="tab-name">{tab.name}</span>
              <button
                className="tab-close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isOnlyTab) {
                    onCloseTab(tab.id);
                  }
                }}
                disabled={isOnlyTab}
                title={isOnlyTab ? '至少保留一个标签页' : '关闭标签页'}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <button
        className="add-tab-btn"
        onClick={onAddTab}
        title="新建标签页"
      >
        +
      </button>
    </div>
  );
};

export default TabBar;