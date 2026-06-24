import { create } from 'zustand';
import { HttpRequest, HttpResponse, HistoryEntry, Variable, Tab, TabsData } from '@/types';
import { DEFAULT_REQUEST, MAX_TABS } from '@/utils/constants';

/**
 * 应用状态
 */
interface AppState {
  // 多 Tab 状态
  tabs: Tab[];
  requests: Record<string, HttpRequest>;
  responses: Record<string, HttpResponse | null>;
  activeTabId: string | null;

  // 原有状态
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

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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

/**
 * 生成请求唯一键（用于检查是否相同请求）
 */
function getRequestKey(request: HttpRequest): string {
  const sortedHeaders = [...request.headers]
    .filter(h => h.enabled)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(h => `${h.key}:${h.value}`);

  const keyParts = [
    request.method,
    request.url,
    sortedHeaders.join('|'),
    request.body.type,
    request.body.content,
    request.auth.type,
  ];

  return keyParts.join('::');
}

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