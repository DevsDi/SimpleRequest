import { create } from 'zustand';
import { HttpRequest, HttpResponse, HistoryEntry, Variable, Tab, TabsData } from '@/types';
import { DEFAULT_REQUEST, MAX_TABS } from '@/utils/constants';
import { normalizeRequest } from '@/utils/requestUtils';

/**
 * Application state
 */
interface AppState {
  // Multi-tab state
  tabs: Tab[];
  requests: Record<string, HttpRequest>;
  responses: Record<string, HttpResponse | null>;
  activeTabId: string | null;

  // Original state
  isLoading: boolean;
  error: string | null;
  history: HistoryEntry[];
  variables: Variable[];

  // Tab operations
  initTabs: (data: TabsData) => void;
  addTab: (request?: HttpRequest) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  duplicateTab: (id: string) => void;
  closeOtherTabs: (keepId: string) => void;
  closeAllTabs: () => void;

  // Request operations (for the currently active tab)
  getCurrentRequest: () => HttpRequest | null;
  updateCurrentRequest: (partial: Partial<HttpRequest>) => void;
  setCurrentRequest: (request: HttpRequest) => void;
  loadRequestToNewTab: (request: HttpRequest) => void;

  // Response operations (for the currently active tab)
  getCurrentResponse: () => HttpResponse | null;
  setCurrentResponse: (response: HttpResponse | null) => void;

  // Other state operations
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
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generate a tab name
 * @param request The request configuration
 * @returns The tab name
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
      // URL parsing failed; use the raw URL
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

  // Truncate to 25 characters
  if (name.length > 25) {
    name = name.slice(0, 22) + '...';
  }

  return name;
}

/**
 * Generate a unique request key (used to check whether two requests are identical)
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
export const useStore = create<AppState>((set, get) => ({
  // Multi-tab state
  tabs: [],
  requests: {},
  responses: {},
  activeTabId: null,

  // Original state
  isLoading: false,
  error: null,
  history: [],
  variables: [],

  // Initialize tabs (loaded from storage)
  initTabs: (data) => {
    if (data.tabs && data.tabs.length > 0) {
      // Apply normalizeRequest to each request to ensure all fields are present
      const normalizedRequests: Record<string, HttpRequest> = {};
      for (const [id, request] of Object.entries(data.requests)) {
        normalizedRequests[id] = normalizeRequest(request);
      }
      set({
        tabs: data.tabs,
        requests: normalizedRequests,
        responses: data.responses || {},
        activeTabId: data.activeTabId,
        variables: data.variables || [],
      });
    } else {
      // No data; create a default tab
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
        variables: data.variables || [],
      });
    }
  },

  // Add a tab
  addTab: (request) => {
    const state = get();

    // Check the tab count limit
    if (state.tabs.length >= MAX_TABS) {
      set({ error: `Maximum ${MAX_TABS} tabs allowed. Please close some tabs first.` });
      return;
    }

    const id = generateId();
    const now = Date.now();

    // If a request config is provided, use normalizeRequest to ensure all fields are present
    let newRequest: HttpRequest;
    if (request) {
      newRequest = normalizeRequest({ ...request, id, updatedAt: now });
    } else {
      const currentRequest = state.getCurrentRequest();
      if (currentRequest) {
        newRequest = normalizeRequest({
          ...currentRequest,
          id,
          name: '',
          createdAt: now,
          updatedAt: now,
        });
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

  // Close a tab
  closeTab: (id) => {
    const state = get();

    const tabIndex = state.tabs.findIndex(t => t.id === id);
    const newTabs = state.tabs.filter(t => t.id !== id);

    // Remove the corresponding request and response
    const newRequests = { ...state.requests };
    delete newRequests[id];
    const newResponses = { ...state.responses };
    delete newResponses[id];

    // If the active tab is closed, switch to an adjacent tab
    let newActiveTabId = state.activeTabId;
    if (state.activeTabId === id) {
      if (newTabs.length === 0) {
        newActiveTabId = null;
      } else {
        // Prefer the tab on the right first, otherwise the one on the left
        const newIndex = Math.min(tabIndex, newTabs.length - 1);
        newActiveTabId = newTabs[newIndex]?.id || null;
      }
    }

    set({
      tabs: newTabs,
      requests: newRequests,
      responses: newResponses,
      activeTabId: newActiveTabId,
      error: null,
      isLoading: false,
    });
  },

  // Switch tab
  switchTab: (id) => {
    const state = get();
    if (state.tabs.find(t => t.id === id)) {
      set({ activeTabId: id, error: null });
    }
  },

  // Duplicate tab
  duplicateTab: (id) => {
    const state = get();

    // Check the tab count limit
    if (state.tabs.length >= MAX_TABS) {
      set({ error: `Maximum ${MAX_TABS} tabs allowed. Please close some tabs first.` });
      return;
    }

    // Check whether the source tab exists
    const sourceTab = state.tabs.find(t => t.id === id);
    const sourceRequest = state.requests[id];
    if (!sourceTab || !sourceRequest) {
      return;
    }

    // Generate a new ID
    const newId = generateId();
    const now = Date.now();

    // Copy the request config, using normalizeRequest to ensure all fields are present
    const newRequest = normalizeRequest({
      ...sourceRequest,
      id: newId,
      name: '',
      createdAt: now,
      updatedAt: now,
    });

    // Append the "(Copy)" suffix to the new tab name
    const newTab: Tab = {
      id: newId,
      name: `${sourceTab.name} (Copy)`,
      createdAt: now,
    };

    set({
      tabs: [...state.tabs, newTab],
      requests: { ...state.requests, [newId]: newRequest },
      responses: { ...state.responses, [newId]: null }, // The new tab does not inherit the response
      activeTabId: newId, // Automatically switch to the new tab
      error: null,
    });
  },

  // Close other tabs
  closeOtherTabs: (keepId) => {
    const state = get();

    // Check whether the tab to keep exists
    const keepTab = state.tabs.find(t => t.id === keepId);
    if (!keepTab) {
      return;
    }

    // Get the list of tab IDs to remove
    const tabIdsToRemove = state.tabs.filter(t => t.id !== keepId).map(t => t.id);

    // Delete the requests and responses of the other tabs
    const newRequests = { ...state.requests };
    const newResponses = { ...state.responses };
    for (const id of tabIdsToRemove) {
      delete newRequests[id];
      delete newResponses[id];
    }

    set({
      tabs: [keepTab],
      requests: newRequests,
      responses: newResponses,
      activeTabId: keepId, // Ensure the kept tab is activated
      error: null,
    });
  },

  // Close all tabs (only the "+" button remains afterward)
  closeAllTabs: () => {
    set({
      tabs: [],
      requests: {},
      responses: {},
      activeTabId: null,
      error: null,
      isLoading: false,
    });
  },

  // Get the current request
  getCurrentRequest: () => {
    const state = get();
    if (!state.activeTabId) return null;
    return state.requests[state.activeTabId] || null;
  },

  // Update the current request
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

    // Update the tab name
    const newTabName = generateTabName(updatedRequest);
    const newTabs = state.tabs.map(t =>
      t.id === state.activeTabId ? { ...t, name: newTabName } : t
    );

    set({
      requests: { ...state.requests, [state.activeTabId]: updatedRequest },
      tabs: newTabs,
    });
  },

  // Set the current request (used in scenarios like curl import or clicking a history entry)
  setCurrentRequest: (request) => {
    const state = get();

    // If there is no active tab, create a new one
    if (!state.activeTabId) {
      const newId = generateId();
      const now = Date.now();
      const newRequest = normalizeRequest({
        ...request,
        id: newId,
        updatedAt: now,
      });
      const newTab: Tab = {
        id: newId,
        name: generateTabName(newRequest),
        createdAt: now,
      };

      set({
        tabs: [newTab],
        requests: { [newId]: newRequest },
        responses: { [newId]: null },
        activeTabId: newId,
      });
      return;
    }

    // Use normalizeRequest to ensure all fields are present
    const updatedRequest = normalizeRequest({
      ...request,
      id: state.activeTabId,
      updatedAt: Date.now(),
    });

    const newTabName = generateTabName(updatedRequest);
    const newTabs = state.tabs.map(t =>
      t.id === state.activeTabId ? { ...t, name: newTabName } : t
    );

    set({
      requests: { ...state.requests, [state.activeTabId]: updatedRequest },
      tabs: newTabs,
    });
  },

  // Load a request into a new tab (used when clicking a history entry to avoid overwriting the current tab)
  // If a tab with identical content already exists, switch to it directly
  loadRequestToNewTab: (request) => {
    const state = get();

    // Check whether a tab with an identical request already exists
    const requestKey = getRequestKey(request);
    const existingTab = state.tabs.find(tab => {
      const tabRequest = state.requests[tab.id];
      return tabRequest && getRequestKey(tabRequest) === requestKey;
    });

    if (existingTab) {
      // A matching tab already exists; switch to it directly
      set({ activeTabId: existingTab.id, error: null });
      return;
    }

    // Check the tab count limit
    if (state.tabs.length >= MAX_TABS) {
      set({ error: `Maximum ${MAX_TABS} tabs allowed. Please close some tabs first.` });
      return;
    }

    const newId = generateId();
    const now = Date.now();

    // Use normalizeRequest to ensure all fields are present
    const newRequest = normalizeRequest({
      ...request,
      id: newId,
      updatedAt: now,
    });

    const newTab: Tab = {
      id: newId,
      name: generateTabName(newRequest),
      createdAt: now,
    };

    set({
      tabs: [...state.tabs, newTab],
      requests: { ...state.requests, [newId]: newRequest },
      responses: { ...state.responses, [newId]: null },
      activeTabId: newId,
      error: null,
    });
  },

  // Get the current response (from localStorage)
  getCurrentResponse: () => {
    const state = get();
    if (!state.activeTabId) return null;
    // Read the response from localStorage
    try {
      const key = `response_${state.activeTabId}`;
      const data = localStorage.getItem(key);
      if (data) {
        return JSON.parse(data);
      }
    } catch {}
    return state.responses[state.activeTabId] || null;
  },

  // Set the current response (saved to localStorage)
  setCurrentResponse: (response) => {
    const state = get();
    if (!state.activeTabId) return;

    // Save to localStorage
    try {
      const key = `response_${state.activeTabId}`;
      if (response) {
        localStorage.setItem(key, JSON.stringify(response));
      } else {
        localStorage.removeItem(key);
      }
    } catch {}

    // Also update the in-memory state
    set({
      responses: { ...state.responses, [state.activeTabId]: response },
    });
  },

  // Set the loading state
  setLoading: (isLoading) => set({ isLoading }),

  // Set the error
  setError: (error) => set({ error }),

  // Set the history
  setHistory: (history) => set({ history }),

  // Add a history entry
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

  // Remove a history entry
  removeHistory: (id) =>
    set((state) => ({
      history: state.history.filter((entry) => entry.id !== id),
    })),

  // Clear the history
  clearHistory: () => set({ history: [] }),

  // Set variables
  setVariables: (variables) => {
    set({ variables });
    // Also save to chrome.storage.sync
    chrome.storage.sync.set({ variables });
  },

  // Get tab data (for saving to local storage; excludes responses and variables)
  getTabsData: () => {
    const state = get();
    return {
      tabs: state.tabs,
      requests: state.requests,
      responses: {}, // responses are stored in localStorage
      activeTabId: state.activeTabId,
      variables: [], // variables are stored in chrome.storage.sync
    };
  },

  // Reset state
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