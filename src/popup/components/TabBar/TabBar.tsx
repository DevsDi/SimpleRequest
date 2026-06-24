import React, { useState } from 'react';
import { Tab, HttpRequest } from '@/types';
import ContextMenu, { MenuItem } from '../common/ContextMenu/ContextMenu';
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
  /** 复制 Tab */
  onDuplicateTab: (id: string) => void;
  /** 关闭其他 Tab */
  onCloseOtherTabs: (id: string) => void;
  /** 关闭所有 Tab */
  onCloseAllTabs: () => void;
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
 * Postman 风格的标签栏，支持右键菜单
 */
const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  requests,
  onAddTab,
  onCloseTab,
  onSwitchTab,
  onDuplicateTab,
  onCloseOtherTabs,
  onCloseAllTabs,
}) => {
  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    tabId: string;
    position: { x: number; y: number };
  } | null>(null);

  /**
   * 处理右键菜单事件
   */
  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault(); // 阻止默认右键菜单
    e.stopPropagation();
    setContextMenu({
      tabId,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  /**
   * 关闭右键菜单
   */
  const closeContextMenu = () => {
    setContextMenu(null);
  };

  /**
   * 获取右键菜单项配置
   */
  const getContextMenuItems = (tabId: string): MenuItem[] => {
    const isOnlyTab = tabs.length === 1;

    return [
      {
        label: 'Copy',
        icon: '📋',
        onClick: () => onDuplicateTab(tabId),
      },
      {
        label: 'Close',
        icon: '✕',
        onClick: () => onCloseTab(tabId),
      },
      {
        label: 'Close Others',
        onClick: () => onCloseOtherTabs(tabId),
        disabled: isOnlyTab,
        danger: true,
      },
      {
        label: 'Close All',
        onClick: () => onCloseAllTabs(),
        danger: true,
      },
    ];
  };

  return (
    <>
      <div className="tab-bar">
        <div className="tabs-container">
          {tabs.map((tab) => {
            const request = requests[tab.id];
            const method = request?.method || 'GET';
            const isActive = tab.id === activeTabId;

            return (
              <div
                key={tab.id}
                className={`tab-item ${isActive ? 'active' : ''}`}
                onClick={() => onSwitchTab(tab.id)}
                onContextMenu={(e) => handleContextMenu(e, tab.id)}
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
                    onCloseTab(tab.id);
                  }}
                  title="Close tab"
                >
                  ×
                </button>
              </div>
            );
          })}
          <button
            className="add-tab-btn"
            onClick={onAddTab}
            title="New tab"
          >
            +
          </button>
        </div>
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          items={getContextMenuItems(contextMenu.tabId)}
          position={contextMenu.position}
          onClose={closeContextMenu}
        />
      )}
    </>
  );
};

export default TabBar;