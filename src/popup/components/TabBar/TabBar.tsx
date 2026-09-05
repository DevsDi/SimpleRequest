import React, { useState } from 'react';
import { Tab, HttpRequest } from '@/types';
import ContextMenu, { MenuItem } from '../common/ContextMenu/ContextMenu';
import './TabBar.scss';

/**
 * TabBar component Props
 */
interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  requests: Record<string, HttpRequest>;
  onAddTab: () => void;
  onCloseTab: (id: string) => void;
  onSwitchTab: (id: string) => void;
  /** Duplicate tab */
  onDuplicateTab: (id: string) => void;
  /** Close other tabs */
  onCloseOtherTabs: (id: string) => void;
  /** Close all tabs */
  onCloseAllTabs: () => void;
}

/**
 * Color class names for HTTP methods
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
 * TabBar component
 * Postman-style tab bar with right-click menu support
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
  // Right-click menu state
  const [contextMenu, setContextMenu] = useState<{
    tabId: string;
    position: { x: number; y: number };
  } | null>(null);

  /**
   * Handle right-click menu event
   */
  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault(); // Prevent the default context menu
    e.stopPropagation();
    setContextMenu({
      tabId,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  /**
   * Close the right-click menu
   */
  const closeContextMenu = () => {
    setContextMenu(null);
  };

  /**
   * Get right-click menu item configuration
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

      {/* Right-click menu */}
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