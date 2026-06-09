import { create } from 'zustand';
import { HttpRequest, HttpResponse, HistoryEntry, Variable } from '@/types';
import { DEFAULT_REQUEST } from '@/utils/constants';

/**
 * 应用状态
 */
interface AppState {
  /** 当前请求配置 */
  currentRequest: HttpRequest;
  /** 当前响应 */
  response: HttpResponse | null;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 历史记录列表 */
  history: HistoryEntry[];
  /** 变量列表 */
  variables: Variable[];

  /** 设置当前请求 */
  setCurrentRequest: (request: HttpRequest) => void;
  /** 更新请求部分字段 */
  updateRequest: (partial: Partial<HttpRequest>) => void;
  /** 设置响应 */
  setResponse: (response: HttpResponse | null) => void;
  /** 设置加载状态 */
  setLoading: (loading: boolean) => void;
  /** 设置错误 */
  setError: (error: string | null) => void;
  /** 设置历史记录 */
  setHistory: (history: HistoryEntry[]) => void;
  /** 添加历史记录 */
  addHistory: (entry: HistoryEntry) => void;
  /** 删除单条历史记录 */
  removeHistory: (id: string) => void;
  /** 清空历史记录 */
  clearHistory: () => void;
  /** 设置变量 */
  setVariables: (variables: Variable[]) => void;
  /** 重置状态 */
  reset: () => void;
}

/**
 * 生成请求的唯一标识（用于判断是否相同请求）
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
export const useStore = create<AppState>((set) => ({
  currentRequest: { ...DEFAULT_REQUEST, id: generateId() },
  response: null,
  isLoading: false,
  error: null,
  history: [],
  variables: [],

  setCurrentRequest: (request) => {
    // Migrate legacy 'json' body type to 'raw' (JSON was merged into raw subtype)
    if ((request.body?.type as string) === 'json') {
      request = {
        ...request,
        body: { ...request.body, type: 'raw' },
      };
    }
    // Ensure auth field exists (legacy entries may not have it)
    if (!request.auth) {
      request = { ...request, auth: { type: 'no-auth' } };
    }
    set({ currentRequest: request });
  },

  updateRequest: (partial) =>
    set((state) => ({
      currentRequest: {
        ...state.currentRequest,
        ...partial,
        updatedAt: Date.now(),
      },
    })),

  setResponse: (response) => set({ response }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setHistory: (history) => set({ history }),

  addHistory: (entry) =>
    set((state) => {
      const requestKey = getRequestKey(entry.request);
      const existingIndex = state.history.findIndex(
        (h) => getRequestKey(h.request) === requestKey
      );

      let newHistory: HistoryEntry[];

      if (existingIndex >= 0) {
        // 更新现有记录并移到最前面
        newHistory = [...state.history];
        newHistory[existingIndex] = { ...newHistory[existingIndex], response: entry.response, timestamp: entry.timestamp };
        const updated = newHistory.splice(existingIndex, 1)[0];
        newHistory.unshift(updated);
      } else {
        // 添加新记录
        newHistory = [entry, ...state.history].slice(0, 100);
      }

      return { history: newHistory };
    }),

  removeHistory: (id) =>
    set((state) => ({
      history: state.history.filter((entry) => entry.id !== id),
    })),

  clearHistory: () => set({ history: [] }),

  setVariables: (variables) => set({ variables }),

  reset: () =>
    set({
      currentRequest: { ...DEFAULT_REQUEST, id: generateId() },
      response: null,
      isLoading: false,
      error: null,
    }),
}));

/**
 * 生成唯一ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}