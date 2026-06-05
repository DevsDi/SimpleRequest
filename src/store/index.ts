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
  /** 清空历史记录 */
  clearHistory: () => void;
  /** 设置变量 */
  setVariables: (variables: Variable[]) => void;
  /** 重置状态 */
  reset: () => void;
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

  setCurrentRequest: (request) => set({ currentRequest: request }),

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
      const newHistory = [entry, ...state.history].slice(0, 100);
      return { history: newHistory };
    }),

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