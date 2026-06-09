import { create } from 'zustand';
import { HttpRequest, HttpResponse, HistoryEntry, Variable } from '@/types';
import { DEFAULT_REQUEST } from '@/utils/constants';

/**
 * Application state
 */
interface AppState {
  /** Current request configuration */
  currentRequest: HttpRequest;
  /** Current response */
  response: HttpResponse | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** History list */
  history: HistoryEntry[];
  /** Variables list */
  variables: Variable[];

  /** Set current request */
  setCurrentRequest: (request: HttpRequest) => void;
  /** Update request partial fields */
  updateRequest: (partial: Partial<HttpRequest>) => void;
  /** Set response */
  setResponse: (response: HttpResponse | null) => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Set error */
  setError: (error: string | null) => void;
  /** Set history */
  setHistory: (history: HistoryEntry[]) => void;
  /** Add history entry */
  addHistory: (entry: HistoryEntry) => void;
  /** Remove single history entry */
  removeHistory: (id: string) => void;
  /** Clear history */
  clearHistory: () => void;
  /** Set variables */
  setVariables: (variables: Variable[]) => void;
  /** Reset state */
  reset: () => void;
}

/**
 * Generate unique key for request (used to check if same request)
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
 * Global state management
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
        // Update existing entry and move to front
        newHistory = [...state.history];
        newHistory[existingIndex] = { ...newHistory[existingIndex], response: entry.response, timestamp: entry.timestamp };
        const updated = newHistory.splice(existingIndex, 1)[0];
        newHistory.unshift(updated);
      } else {
        // Add new entry
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
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}