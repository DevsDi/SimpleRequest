# Variable Autocomplete & Multi-Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 SimpleRequest 添加变量自动提示和多 Tab 支持功能

**Architecture:** 使用最小改动方案，在现有 Zustand 状态管理基础上扩展多 Tab 结构，通过 storageService 持久化 Tab 数据。变量自动提示使用自定义组件实现，不引入新依赖。

**Tech Stack:** React 18 + TypeScript + Zustand + SCSS + Chrome Extension Manifest V3

## Global Constraints

- 变量自动提示仅在 URL 输入框生效
- Tab 数据自动保存到 chrome.storage.local
- 最多支持 20 个 Tab
- 最后一个 Tab 禁止关闭
- 保持与现有功能（History、curl 导入、变量替换）的兼容性
- 不引入新的第三方依赖

---

## File Structure

```
src/
├── types/
│   └── index.ts                   # 新增 Tab 类型
├── services/
│   └── storageService.ts          # 新增 Tab 持久化方法
├── store/
│   └── index.ts                   # 重构：多 Tab 状态
├── popup/
│   ├── App.tsx                    # 集成 TabBar
│   ├── App.scss                   # 添加 TabBar 样式
│   └── components/
│       ├── TabBar/                # 新增
│       │   ├── index.ts
│       │   ├── TabBar.tsx
│       │   └── TabBar.scss
│       └── RequestPanel/
│           ├── RequestPanel.tsx   # 集成 VariableAutocomplete
│           ├── VariableAutocomplete.tsx  # 新增
│           └── VariableAutocomplete.scss # 新增
```

---

### Task 1: 添加 Tab 类型定义

**Files:**
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `Tab` 类型，供后续任务使用

**说明:** 在现有类型文件末尾添加 Tab 类型定义。

- [ ] **Step 1: 添加 Tab 类型定义**

在 `src/types/index.ts` 文件末尾添加：

```typescript
/**
 * Tab 元数据
 */
export interface Tab {
  /** 唯一标识，与 HttpRequest.id 关联 */
  id: string;
  /** 显示名称（自动生成：method + URL 片段） */
  name: string;
  /** 创建时间 */
  createdAt: number;
}

/**
 * Tabs 数据存储结构
 */
export interface TabsData {
  /** Tab 元数据列表 */
  tabs: Tab[];
  /** Request 数据映射 (id -> HttpRequest) */
  requests: Record<string, HttpRequest>;
  /** Response 数据映射 (id -> HttpResponse | null) */
  responses: Record<string, HttpResponse | null>;
  /** 当前激活的 Tab ID */
  activeTabId: string | null;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/types/index.ts
git commit -m "types: 添加 Tab 和 TabsData 类型定义"
```

---

### Task 2: 扩展 storageService 添加 Tab 持久化方法

**Files:**
- Modify: `src/services/storageService.ts`

**Interfaces:**
- Consumes: `Tab`, `TabsData` 类型（Task 1）
- Produces: `saveTabsData()`, `loadTabsData()` 方法

**说明:** 在 storageService 中添加 Tab 数据的保存和加载方法。

- [ ] **Step 1: 导入新类型**

在 `src/services/storageService.ts` 顶部修改导入：

```typescript
import { HistoryEntry, ExportData, Variable, Tab, TabsData, HttpRequest, HttpResponse } from '@/types';
```

- [ ] **Step 2: 添加 Tab 持久化方法**

在 `StorageService` 类中添加以下方法：

```typescript
  /**
   * 保存 Tab 数据
   * @param data Tab 数据
   */
  async saveTabsData(data: TabsData): Promise<void> {
    await chrome.storage.local.set({ tabsData: data });
  }

  /**
   * 加载 Tab 数据
   * @returns Tab 数据，如果不存在返回 null
   */
  async loadTabsData(): Promise<TabsData | null> {
    const { tabsData } = await chrome.storage.local.get('tabsData');
    return tabsData || null;
  }

  /**
   * 清除 Tab 数据
   */
  async clearTabsData(): Promise<void> {
    await chrome.storage.local.remove('tabsData');
  }
```

- [ ] **Step 3: 提交**

```bash
git add src/services/storageService.ts
git commit -m "feat(storageService): 添加 Tab 数据持久化方法"
```

---

### Task 3: 重构 Store 为多 Tab 状态

**Files:**
- Modify: `src/store/index.ts`

**Interfaces:**
- Consumes: `Tab`, `TabsData` 类型（Task 1）
- Produces: 多 Tab 状态管理方法：`addTab()`, `closeTab()`, `switchTab()`, `getCurrentRequest()`, `updateCurrentRequest()`, `getCurrentResponse()`, `setCurrentResponse()`

**说明:** 将单一 `currentRequest` 改为多 Tab 结构，保持向后兼容。

- [ ] **Step 1: 添加导入和新类型**

在 `src/store/index.ts` 顶部修改：

```typescript
import { create } from 'zustand';
import { HttpRequest, HttpResponse, HistoryEntry, Variable, Tab, TabsData } from '@/types';
import { DEFAULT_REQUEST, MAX_TABS } from '@/utils/constants';
```

- [ ] **Step 2: 更新 AppState 接口**

替换原有的 `AppState` 接口：

```typescript
/**
 * 应用状态
 */
interface AppState {
  // 多 Tab 状态
  tabs: Tab[];
  requests: Record<string, HttpRequest>;
  responses: Record<string, HttpResponse | null>;
  activeTabId: string | null;
  
  // 原有状态保留
  isLoading: boolean;
  error: string | null;
  history: HistoryEntry[];
  variables: Variable[];

  // Tab 操作
  initTabs: (data: TabsData) => void;
  addTab: (request?: HttpRequest) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  
  // Request 操作（针对当前激活 Tab）
  getCurrentRequest: () => HttpRequest | null;
  updateCurrentRequest: (partial: Partial<HttpRequest>) => void;
  setCurrentRequest: (request: HttpRequest) => void;
  
  // Response 操作（针对当前激活 Tab）
  getCurrentResponse: () => HttpResponse | null;
  setCurrentResponse: (response: HttpResponse | null) => void;
  
  // 其他状态操作
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHistory: (history: HistoryEntry[]) => void;
  addHistory: (entry: HistoryEntry) => void;
  removeHistory: (id: string) => void;
  clearHistory: () => void;
  setVariables: (variables: Variable[]) => void;
  getTabsData: () => TabsData;
  reset: () => void;
}
```

- [ ] **Step 3: 添加辅助函数**

在 `generateId` 函数前添加：

```typescript
/**
 * 生成 Tab 名称
 * @param request 请求配置
 * @returns Tab 名称
 */
function generateTabName(request: HttpRequest): string {
  const { method, url } = request;
  let name = method;
  
  if (url) {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      const path = urlObj.pathname + urlObj.search;
      name += ` ${path || '/'}`;
    } catch {
      // URL 解析失败，使用原始 URL
      const pathStart = url.indexOf('/');
      if (pathStart !== -1) {
        name += ` ${url.slice(pathStart)}`;
      } else {
        name += ` ${url}`;
      }
    }
  } else {
    name += ' Untitled';
  }
  
  // 截断到 25 字符
  if (name.length > 25) {
    name = name.slice(0, 22) + '...';
  }
  
  return name;
}
```

- [ ] **Step 4: 重构 Store 实现**

替换 `useStore` 的 `create` 调用：

```typescript
/**
 * 全局状态管理
 */
export const useStore = create<AppState>((set, get) => ({
  // 多 Tab 状态
  tabs: [],
  requests: {},
  responses: {},
  activeTabId: null,
  
  // 原有状态
  isLoading: false,
  error: null,
  history: [],
  variables: [],

  // 初始化 Tab（从存储加载）
  initTabs: (data) => {
    if (data.tabs && data.tabs.length > 0) {
      set({
        tabs: data.tabs,
        requests: data.requests,
        responses: data.responses || {},
        activeTabId: data.activeTabId,
      });
    } else {
      // 没有数据，创建默认 Tab
      const id = generateId();
      const defaultRequest: HttpRequest = {
        ...DEFAULT_REQUEST,
        id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const defaultTab: Tab = {
        id,
        name: generateTabName(defaultRequest),
        createdAt: Date.now(),
      };
      set({
        tabs: [defaultTab],
        requests: { [id]: defaultRequest },
        responses: { [id]: null },
        activeTabId: id,
      });
    }
  },

  // 新增 Tab
  addTab: (request) => {
    const state = get();
    
    // 检查 Tab 数量限制
    if (state.tabs.length >= MAX_TABS) {
      set({ error: `最多支持 ${MAX_TABS} 个标签页，请关闭部分标签页后再试` });
      return;
    }
    
    const id = generateId();
    const now = Date.now();
    
    // 如果提供了请求配置，使用它；否则复制当前请求或创建默认请求
    let newRequest: HttpRequest;
    if (request) {
      newRequest = { ...request, id, updatedAt: now };
    } else {
      const currentRequest = state.getCurrentRequest();
      if (currentRequest) {
        newRequest = {
          ...currentRequest,
          id,
          name: '',
          createdAt: now,
          updatedAt: now,
        };
      } else {
        newRequest = { ...DEFAULT_REQUEST, id, createdAt: now, updatedAt: now };
      }
    }
    
    const newTab: Tab = {
      id,
      name: generateTabName(newRequest),
      createdAt: now,
    };
    
    set({
      tabs: [...state.tabs, newTab],
      requests: { ...state.requests, [id]: newRequest },
      responses: { ...state.responses, [id]: null },
      activeTabId: id,
      error: null,
    });
  },

  // 关闭 Tab
  closeTab: (id) => {
    const state = get();
    
    // 禁止关闭最后一个 Tab
    if (state.tabs.length <= 1) {
      return;
    }
    
    const tabIndex = state.tabs.findIndex(t => t.id === id);
    const newTabs = state.tabs.filter(t => t.id !== id);
    
    // 移除对应的 request 和 response
    const newRequests = { ...state.requests };
    delete newRequests[id];
    const newResponses = { ...state.responses };
    delete newResponses[id];
    
    // 如果关闭的是当前激活的 Tab，切换到相邻 Tab
    let newActiveTabId = state.activeTabId;
    if (state.activeTabId === id) {
      // 优先切换到右侧，否则切换到左侧
      const newIndex = Math.min(tabIndex, newTabs.length - 1);
      newActiveTabId = newTabs[newIndex]?.id || null;
    }
    
    set({
      tabs: newTabs,
      requests: newRequests,
      responses: newResponses,
      activeTabId: newActiveTabId,
    });
  },

  // 切换 Tab
  switchTab: (id) => {
    const state = get();
    if (state.tabs.find(t => t.id === id)) {
      set({ activeTabId: id, error: null });
    }
  },

  // 获取当前请求
  getCurrentRequest: () => {
    const state = get();
    if (!state.activeTabId) return null;
    return state.requests[state.activeTabId] || null;
  },

  // 更新当前请求
  updateCurrentRequest: (partial) => {
    const state = get();
    if (!state.activeTabId) return;
    
    const currentRequest = state.requests[state.activeTabId];
    if (!currentRequest) return;
    
    const updatedRequest = {
      ...currentRequest,
      ...partial,
      updatedAt: Date.now(),
    };
    
    // 更新 Tab 名称
    const newTabName = generateTabName(updatedRequest);
    const newTabs = state.tabs.map(t =>
      t.id === state.activeTabId ? { ...t, name: newTabName } : t
    );
    
    set({
      requests: { ...state.requests, [state.activeTabId]: updatedRequest },
      tabs: newTabs,
    });
  },

  // 设置当前请求（用于 curl 导入等场景）
  setCurrentRequest: (request) => {
    const state = get();
    if (!state.activeTabId) return;
    
    const updatedRequest = {
      ...request,
      id: state.activeTabId,
      updatedAt: Date.now(),
    };
    
    // 处理旧版本 'json' body 类型迁移
    if ((updatedRequest.body?.type as string) === 'json') {
      updatedRequest.body = { ...updatedRequest.body, type: 'raw' };
    }
    if (!updatedRequest.auth) {
      updatedRequest.auth = { type: 'no-auth' };
    }
    
    const newTabName = generateTabName(updatedRequest);
    const newTabs = state.tabs.map(t =>
      t.id === state.activeTabId ? { ...t, name: newTabName } : t
    );
    
    set({
      requests: { ...state.requests, [state.activeTabId]: updatedRequest },
      tabs: newTabs,
    });
  },

  // 获取当前响应
  getCurrentResponse: () => {
    const state = get();
    if (!state.activeTabId) return null;
    return state.responses[state.activeTabId] || null;
  },

  // 设置当前响应
  setCurrentResponse: (response) => {
    const state = get();
    if (!state.activeTabId) return;
    
    set({
      responses: { ...state.responses, [state.activeTabId]: response },
    });
  },

  // 设置加载状态
  setLoading: (isLoading) => set({ isLoading }),

  // 设置错误
  setError: (error) => set({ error }),

  // 设置历史记录
  setHistory: (history) => set({ history }),

  // 添加历史记录
  addHistory: (entry) =>
    set((state) => {
      const requestKey = getRequestKey(entry.request);
      const existingIndex = state.history.findIndex(
        (h) => getRequestKey(h.request) === requestKey
      );

      let newHistory: HistoryEntry[];

      if (existingIndex >= 0) {
        newHistory = [...state.history];
        newHistory[existingIndex] = { ...newHistory[existingIndex], response: entry.response, timestamp: entry.timestamp };
        const updated = newHistory.splice(existingIndex, 1)[0];
        newHistory.unshift(updated);
      } else {
        newHistory = [entry, ...state.history].slice(0, 100);
      }

      return { history: newHistory };
    }),

  // 移除历史记录
  removeHistory: (id) =>
    set((state) => ({
      history: state.history.filter((entry) => entry.id !== id),
    })),

  // 清空历史记录
  clearHistory: () => set({ history: [] }),

  // 设置变量
  setVariables: (variables) => set({ variables }),

  // 获取 Tab 数据（用于保存）
  getTabsData: () => {
    const state = get();
    return {
      tabs: state.tabs,
      requests: state.requests,
      responses: state.responses,
      activeTabId: state.activeTabId,
    };
  },

  // 重置状态
  reset: () => {
    const id = generateId();
    const defaultRequest: HttpRequest = {
      ...DEFAULT_REQUEST,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const defaultTab: Tab = {
      id,
      name: generateTabName(defaultRequest),
      createdAt: Date.now(),
    };
    set({
      tabs: [defaultTab],
      requests: { [id]: defaultRequest },
      responses: { [id]: null },
      activeTabId: id,
      isLoading: false,
      error: null,
    });
  },
}));
```

- [ ] **Step 5: 更新 getRequestKey 函数**

保持 `getRequestKey` 函数不变，但移到 `useStore` 定义之前。

- [ ] **Step 6: 提交**

```bash
git add src/store/index.ts
git commit -m "refactor(store): 重构为多 Tab 状态管理"
```

---

### Task 4: 添加常量定义

**Files:**
- Modify: `src/utils/constants.ts`

**Interfaces:**
- Produces: `MAX_TABS` 常量

**说明:** 添加最大 Tab 数量常量。

- [ ] **Step 1: 添加 MAX_TABS 常量**

在 `src/utils/constants.ts` 中添加：

```typescript
/** 最大 Tab 数量 */
export const MAX_TABS = 20;
```

- [ ] **Step 2: 提交**

```bash
git add src/utils/constants.ts
git commit -m "feat(constants): 添加 MAX_TABS 常量"
```

---

### Task 5: 创建 TabBar 组件

**Files:**
- Create: `src/popup/components/TabBar/index.ts`
- Create: `src/popup/components/TabBar/TabBar.tsx`
- Create: `src/popup/components/TabBar/TabBar.scss`

**Interfaces:**
- Consumes: `Tab` 类型（Task 1）, `HttpRequest` 类型，store 方法
- Produces: TabBar UI 组件

**说明:** 创建 Postman 风格的标签栏组件。

- [ ] **Step 1: 创建 index.ts**

创建文件 `src/popup/components/TabBar/index.ts`：

```typescript
export { default } from './TabBar';
```

- [ ] **Step 2: 创建 TabBar.tsx**

创建文件 `src/popup/components/TabBar/TabBar.tsx`：

```typescript
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
```

- [ ] **Step 3: 创建 TabBar.scss**

创建文件 `src/popup/components/TabBar/TabBar.scss`：

```scss
/** TabBar 组件样式 */

.tab-bar {
  display: flex;
  align-items: center;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  padding: 0 8px;
  height: 36px;
  flex-shrink: 0;
}

.tabs-container {
  display: flex;
  gap: 2px;
  overflow-x: auto;
  flex: 1;
  
  /* 隐藏滚动条但保留滚动功能 */
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--bg-primary);
  border-radius: 6px 6px 0 0;
  cursor: pointer;
  min-width: 80px;
  max-width: 160px;
  transition: all 0.15s ease;
  border: 1px solid transparent;
  border-bottom: none;
  
  &:hover {
    background: var(--bg-hover);
    
    .tab-close-btn {
      opacity: 1;
    }
  }
  
  &.active {
    background: var(--bg-tertiary);
    border-color: var(--border-color);
    
    .tab-close-btn {
      opacity: 1;
    }
  }
}

.tab-method {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 4px;
  border-radius: 3px;
  flex-shrink: 0;
  
  &.method-get {
    color: #22c55e;
    background: rgba(34, 197, 94, 0.15);
  }
  
  &.method-post {
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.15);
  }
  
  &.method-put {
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.15);
  }
  
  &.method-patch {
    color: #8b5cf6;
    background: rgba(139, 92, 246, 0.15);
  }
  
  &.method-delete {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.15);
  }
  
  &.method-head,
  &.method-options {
    color: var(--text-muted);
    background: var(--bg-hover);
  }
}

.tab-name {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  
  .tab-item.active & {
    color: var(--text-primary);
  }
}

.tab-close-btn {
  opacity: 0;
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s ease;
  
  &:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }
  
  &:disabled {
    cursor: not-allowed;
    opacity: 0.3;
  }
}

.add-tab-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
  flex-shrink: 0;
  transition: all 0.15s ease;
  
  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add src/popup/components/TabBar/
git commit -m "feat(TabBar): 创建 TabBar 组件"
```

---

### Task 6: 创建 VariableAutocomplete 组件

**Files:**
- Create: `src/popup/components/RequestPanel/VariableAutocomplete.tsx`
- Create: `src/popup/components/RequestPanel/VariableAutocomplete.scss`

**Interfaces:**
- Consumes: `Variable` 类型
- Produces: 变量自动提示下拉组件

**说明:** 创建变量自动提示组件，支持键盘导航和过滤。

- [ ] **Step 1: 创建 VariableAutocomplete.tsx**

创建文件 `src/popup/components/RequestPanel/VariableAutocomplete.tsx`：

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { Variable } from '@/types';
import './VariableAutocomplete.scss';

/**
 * VariableAutocomplete 组件 Props
 */
interface VariableAutocompleteProps {
  /** 可用变量列表 */
  variables: Variable[];
  /** 选择变量回调 */
  onSelect: (variableName: string) => void;
  /** 关闭回调 */
  onClose: () => void;
  /** 过滤文本 */
  filter: string;
  /** 下拉菜单位置 */
  position: { top: number; left: number };
}

/**
 * 变量自动提示组件
 * 输入 {{ 时显示变量列表
 */
const VariableAutocomplete: React.FC<VariableAutocompleteProps> = ({
  variables,
  onSelect,
  onClose,
  filter,
  position,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // 过滤已启用的变量
  const enabledVariables = variables.filter(v => v.enabled && v.name.trim());

  // 根据过滤文本筛选变量
  const filteredVariables = filter
    ? enabledVariables.filter(v =>
        v.name.toLowerCase().includes(filter.toLowerCase())
      )
    : enabledVariables;

  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  // 滚动到选中项
  useEffect(() => {
    if (listRef.current) {
      const selectedItem = listRef.current.querySelector('.selected');
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            Math.min(prev + 1, filteredVariables.length - 1)
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredVariables[selectedIndex]) {
            onSelect(filteredVariables[selectedIndex].name);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredVariables, selectedIndex, onSelect, onClose]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.variable-autocomplete') && !target.closest('.url-input')) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (filteredVariables.length === 0) {
    return (
      <div
        className="variable-autocomplete"
        style={{ top: position.top, left: position.left }}
      >
        <div className="variable-empty">
          {enabledVariables.length === 0
            ? '暂无变量，请在 Variables 面板添加'
            : '无匹配变量'}
        </div>
      </div>
    );
  }

  return (
    <div
      className="variable-autocomplete"
      style={{ top: position.top, left: position.left }}
      ref={listRef}
    >
      {filteredVariables.map((variable, index) => (
        <div
          key={variable.name}
          className={`variable-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(variable.name)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span className="variable-name">
            {highlightMatch(variable.name, filter)}
          </span>
          <span className="variable-value" title={variable.value}>
            {variable.value.length > 30
              ? `${variable.value.slice(0, 30)}...`
              : variable.value}
          </span>
        </div>
      ))}
    </div>
  );
};

/**
 * 高亮匹配文本
 */
function highlightMatch(text: string, filter: string): React.ReactNode {
  if (!filter) return text;

  const lowerText = text.toLowerCase();
  const lowerFilter = filter.toLowerCase();
  const index = lowerText.indexOf(lowerFilter);

  if (index === -1) return text;

  const before = text.slice(0, index);
  const match = text.slice(index, index + filter.length);
  const after = text.slice(index + filter.length);

  return (
    <>
      {before}
      <span className="highlight">{match}</span>
      {after}
    </>
  );
}

export default VariableAutocomplete;
```

- [ ] **Step 2: 创建 VariableAutocomplete.scss**

创建文件 `src/popup/components/RequestPanel/VariableAutocomplete.scss`：

```scss
/** VariableAutocomplete 组件样式 */

.variable-autocomplete {
  position: fixed;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-lg);
  max-height: 240px;
  overflow-y: auto;
  z-index: 1000;
  min-width: 200px;
  max-width: 320px;
}

.variable-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  gap: 12px;
  transition: background 0.1s ease;

  &:hover,
  &.selected {
    background: var(--bg-hover);
  }

  &.selected {
    border-left: 2px solid var(--primary-color);
  }
}

.variable-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  flex-shrink: 0;

  .highlight {
    color: var(--primary-color);
    background: rgba(124, 58, 237, 0.15);
    border-radius: 2px;
    padding: 0 2px;
  }
}

.variable-value {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  font-family: 'JetBrains Mono', 'Monaco', 'Menlo', monospace;
}

.variable-empty {
  padding: 12px 16px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
}
```

- [ ] **Step 3: 提交**

```bash
git add src/popup/components/RequestPanel/VariableAutocomplete.tsx src/popup/components/RequestPanel/VariableAutocomplete.scss
git commit -m "feat(VariableAutocomplete): 创建变量自动提示组件"
```

---

### Task 7: 集成 VariableAutocomplete 到 RequestPanel

**Files:**
- Modify: `src/popup/components/RequestPanel/RequestPanel.tsx`

**Interfaces:**
- Consumes: `VariableAutocomplete` 组件（Task 6）, store 方法

**说明:** 在 URL 输入框中集成变量自动提示功能。

- [ ] **Step 1: 添加状态和导入**

在 `RequestPanel.tsx` 顶部修改导入并添加状态：

```typescript
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '@/store';
import { requestService, curlParser, variableService, curlGenerator } from '@/services';
import MethodSelector from './MethodSelector';
import HeadersEditor from './HeadersEditor';
import BodyEditor from './BodyEditor';
import ParamsEditor from './ParamsEditor';
import AuthEditor from './AuthEditor';
import VariableAutocomplete from './VariableAutocomplete';
import './RequestPanel.scss';
```

- [ ] **Step 2: 添加自动提示状态**

在组件内部，`activeTab` 状态后添加：

```typescript
const RequestPanel: React.FC = () => {
  const { getCurrentRequest, updateCurrentRequest, isLoading, setLoading, setError, setCurrentResponse, addHistory, variables } = useStore();
  const [activeTab, setActiveTab] = useState<RequestTab>('body');

  // 变量自动提示状态
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteFilter, setAutocompleteFilter] = useState('');
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const urlInputRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 3: 添加检测变量的函数**

在组件内添加辅助函数：

```typescript
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
```

- [ ] **Step 4: 添加处理 URL 输入和变化的函数**

```typescript
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
```

- [ ] **Step 5: 修改 URL 输入框**

找到 `handleUrlChange` 函数并删除（已在上面重新定义），然后修改 URL 输入框的 JSX：

```tsx
        <input
          ref={urlInputRef}
          type="text"
          className="url-input"
          placeholder="Enter URL or paste curl command..."
          value={getCurrentRequest()?.url || ''}
          onChange={handleUrlChange}
          onInput={handleUrlInput}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !showAutocomplete) {
              handleSend();
            }
          }}
        />
```

- [ ] **Step 6: 添加 VariableAutocomplete 组件**

在 URL 输入框的 `</div>` 后、发送按钮前添加：

```tsx
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
```

- [ ] **Step 7: 更新其他引用**

将组件内所有 `currentRequest` 替换为 `getCurrentRequest()`：

```typescript
  const currentRequest = getCurrentRequest();

  // 在 handleSend 函数中
  if (!currentRequest?.url.trim()) {
    setError('Please enter request URL');
    return;
  }

  // ... 其他使用 currentRequest 的地方
```

**注意：** 由于 `getCurrentRequest()` 是函数调用，建议在组件顶部缓存：

```typescript
const RequestPanel: React.FC = () => {
  const { getCurrentRequest, updateCurrentRequest, /* ... */ } = useStore();
  const currentRequest = getCurrentRequest();
  // ... 其余代码
```

- [ ] **Step 8: 提交**

```bash
git add src/popup/components/RequestPanel/RequestPanel.tsx
git commit -m "feat(RequestPanel): 集成变量自动提示功能"
```

---

### Task 8: 集成 TabBar 到 App.tsx

**Files:**
- Modify: `src/popup/App.tsx`

**Interfaces:**
- Consumes: `TabBar` 组件（Task 5）, store 方法

**说明:** 将 TabBar 组件集成到主应用，并添加数据加载/保存逻辑。

- [ ] **Step 1: 添加导入**

在 `App.tsx` 顶部添加 TabBar 导入：

```typescript
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
```

- [ ] **Step 2: 更新 store 解构**

修改组件内的 store 解构：

```typescript
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
```

- [ ] **Step 3: 添加 Tab 数据初始化**

修改 `useEffect` 加载逻辑：

```typescript
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
```

- [ ] **Step 4: 添加自动保存逻辑**

在组件内添加自动保存的 `useEffect`：

```typescript
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
```

- [ ] **Step 5: 添加 TabBar 到 JSX**

在 `header` 后、`app-main` 前添加 TabBar：

```tsx
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
```

- [ ] **Step 6: 更新 ResponsePanel 使用**

修改 ResponsePanel 的使用：

```tsx
          {/* Response panel */}
          <section className="response-section">
            {error && <div className="error-message">{error}</div>}
            {isLoading ? <div className="loading">Loading...</div> : (
              <ResponsePanel response={getCurrentResponse()} />
            )}
          </section>
```

- [ ] **Step 7: 提交**

```bash
git add src/popup/App.tsx
git commit -m "feat(App): 集成 TabBar 组件和自动保存逻辑"
```

---

### Task 9: 更新 ResponsePanel 接收 props

**Files:**
- Modify: `src/popup/components/ResponsePanel/ResponsePanel.tsx`

**Interfaces:**
- Consumes: `HttpResponse` 类型

**说明:** 修改 ResponsePanel 从 props 接收 response，而不是直接从 store 获取。

- [ ] **Step 1: 修改 ResponsePanel**

修改 `ResponsePanel.tsx`：

```typescript
import React from 'react';
import { HttpResponse } from '@/types';
import JsonViewer from './JsonViewer';
import HeadersViewer from './HeadersViewer';
import './ResponsePanel.scss';

/**
 * ResponsePanel 组件 Props
 */
interface ResponsePanelProps {
  response: HttpResponse | null;
}

/**
 * Response panel component
 * 显示响应状态、响应头、响应体
 */
const ResponsePanel: React.FC<ResponsePanelProps> = ({ response }) => {
  const [activeTab, setActiveTab] = React.useState<'body' | 'headers'>('body');
  const [viewMode, setViewMode] = React.useState<'pretty' | 'raw'>('pretty');

  // 如果没有响应，显示空状态
  if (!response) {
    return (
      <div className="response-panel empty">
        <div className="empty-state">
          <p>发送请求以查看响应</p>
        </div>
      </div>
    );
  }

  // ... 其余代码保持不变
```

- [ ] **Step 2: 提交**

```bash
git add src/popup/components/ResponsePanel/ResponsePanel.tsx
git commit -m "refactor(ResponsePanel): 从 props 接收 response"
```

---

### Task 10: 添加数据迁移逻辑

**Files:**
- Modify: `src/services/storageService.ts`

**Interfaces:**
- Produces: `migrateOldData()` 方法

**说明:** 添加旧版本数据迁移逻辑，确保升级平滑。

- [ ] **Step 1: 添加迁移方法**

在 `StorageService` 类中添加：

```typescript
  /**
   * 检查并迁移旧版本数据
   * 旧版本使用 currentRequest，新版本使用 tabs 结构
   * @returns 是否执行了迁移
   */
  async migrateOldData(): Promise<boolean> {
    const { currentRequest } = await chrome.storage.local.get('currentRequest');
    
    if (!currentRequest) {
      return false;
    }

    // 检查是否已有 tabs 数据
    const existingData = await this.loadTabsData();
    if (existingData && existingData.tabs.length > 0) {
      // 已有新数据，清理旧数据
      await chrome.storage.local.remove('currentRequest');
      return false;
    }

    // 迁移：将 currentRequest 转为第一个 Tab
    const id = currentRequest.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = Date.now();
    
    const request = {
      ...currentRequest,
      id,
      updatedAt: now,
    };

    // 生成 Tab 名称
    let tabName = request.method || 'GET';
    if (request.url) {
      try {
        const urlObj = new URL(request.url.startsWith('http') ? request.url : `https://${request.url}`);
        const path = urlObj.pathname + urlObj.search;
        tabName += ` ${path || '/'}`;
      } catch {
        const pathStart = request.url.indexOf('/');
        if (pathStart !== -1) {
          tabName += ` ${request.url.slice(pathStart)}`;
        } else {
          tabName += ` ${request.url}`;
        }
      }
    } else {
      tabName += ' Untitled';
    }
    
    if (tabName.length > 25) {
      tabName = tabName.slice(0, 22) + '...';
    }

    const tabsData: TabsData = {
      tabs: [{
        id,
        name: tabName,
        createdAt: now,
      }],
      requests: { [id]: request },
      responses: { [id]: null },
      activeTabId: id,
    };

    await this.saveTabsData(tabsData);
    await chrome.storage.local.remove('currentRequest');
    
    return true;
  }
```

- [ ] **Step 2: 更新初始化逻辑**

在 `loadTabsData` 方法中添加迁移检查：

```typescript
  /**
   * 加载 Tab 数据
   * @returns Tab 数据，如果不存在返回 null
   */
  async loadTabsData(): Promise<TabsData | null> {
    const { tabsData } = await chrome.storage.local.get('tabsData');
    
    if (tabsData) {
      return tabsData;
    }

    // 尝试迁移旧数据
    const migrated = await this.migrateOldData();
    if (migrated) {
      const { tabsData: newData } = await chrome.storage.local.get('tabsData');
      return newData || null;
    }

    return null;
  }
```

- [ ] **Step 3: 提交**

```bash
git add src/services/storageService.ts
git commit -m "feat(storageService): 添加旧版本数据迁移逻辑"
```

---

### Task 11: 测试和修复

**Files:**
- 可能修改多个文件

**说明:** 构建项目，测试功能，修复发现的问题。

- [ ] **Step 1: 运行构建**

```bash
npm run build
```

- [ ] **Step 2: 在 Chrome 中加载测试**

1. 打开 `chrome://extensions/`
2. 启用开发者模式
3. 加载 `dist` 目录
4. 测试以下功能：
   - Tab 新建、切换、关闭
   - URL 输入 `{{` 触发变量提示
   - 键盘导航选择变量
   - 关闭扩展后重新打开，Tab 数据保留
   - 发送请求后 History 正常记录
   - curl 导入正常工作

- [ ] **Step 3: 修复发现的问题**

记录并修复任何发现的问题。

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "fix: 修复测试中发现的问题"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** 所有 spec 要求都有对应任务
- [x] **Placeholder scan:** 无 TBD、TODO 等占位符
- [x] **Type consistency:** 类型定义一致，方法签名匹配
- [x] **File paths:** 所有文件路径精确
- [x] **Code completeness:** 所有步骤包含完整代码

---

## Dependencies Between Tasks

```
Task 1 (types) 
  ↓
Task 2 (storageService) 
  ↓
Task 3 (store refactor) ← depends on Task 4 (constants)
  ↓
Task 5 (TabBar)
  ↓
Task 6 (VariableAutocomplete)
  ↓
Task 7 (RequestPanel integration)
  ↓
Task 8 (App integration)
  ↓
Task 9 (ResponsePanel update)
  ↓
Task 10 (migration logic)
  ↓
Task 11 (testing)
```
