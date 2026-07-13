import { HttpRequest, HttpResponse, HistoryEntry } from '@/types';
import { MAX_HISTORY_ITEMS } from '@/utils/constants';

/**
 * Request service
 * Handles HTTP request execution, response processing, history saving
 */
class RequestService {
  /**
   * Execute HTTP request
   * @param request Request configuration
   * @returns Response data
   */
  async execute(request: HttpRequest): Promise<HttpResponse> {
    // Send request through background service worker (handles cross-origin)
    const message = {
      type: 'executeRequest',
      request,
    };

    const response = await chrome.runtime.sendMessage(message);

    if (!response.success) {
      throw new Error(response.error || 'Request failed');
    }

    return response.data;
  }

  /**
   * Cancel current request
   */
  async cancel(): Promise<void> {
    const response = await chrome.runtime.sendMessage({ type: 'cancelRequest' });
    if (!response.success) {
      throw new Error(response.error || 'Cancel failed');
    }
  }

  /**
   * Generate unique key for request (used to check if same request)
   * @param request Request configuration
   * @returns Unique key string
   */
  private getRequestKey(request: HttpRequest): string {
    // Sort headers then serialize, ensure order doesn't affect comparison
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
   * Save request to history (local storage, without response body)
   * @param request Request configuration
   * @param response Response data
   * @param tabId Tab ID for response cleanup
   */
  async saveToHistory(request: HttpRequest, response: HttpResponse, tabId?: string): Promise<void> {
    const requestKey = this.getRequestKey(request);

    // Get existing history from local storage
    const { history } = await chrome.storage.local.get({ history: [] });

    // 只保存响应元数据，不保存 body
    const responseMeta = {
      status: response.status,
      statusText: response.statusText,
      time: response.time,
      size: response.size,
      headers: response.headers,
    };

    // Check if same request already exists
    const existingIndex = history.findIndex((entry: HistoryEntry) =>
      this.getRequestKey(entry.request) === requestKey
    );

    if (existingIndex >= 0) {
      // Update existing record timestamp and response meta
      history[existingIndex] = {
        ...history[existingIndex],
        response: responseMeta as any,
        timestamp: Date.now(),
        tabId, // 更新 tabId
      };
      // Move to front
      const updatedEntry = history.splice(existingIndex, 1)[0];
      history.unshift(updatedEntry);
    } else {
      // Add new entry
      const historyEntry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        request,
        response: responseMeta as any,
        timestamp: Date.now(),
        tabId,
      };
      history.unshift(historyEntry);
    }

    // Limit count (超过50条覆盖最早的) and save to local
    const newHistory = history.slice(0, MAX_HISTORY_ITEMS);
    await chrome.storage.local.set({ history: newHistory });
  }

  /**
   * Get history records from local storage
   * @returns History list
   */
  async getHistory(): Promise<HistoryEntry[]> {
    const { history } = await chrome.storage.local.get({ history: [] });
    return history;
  }

  /**
   * Clear history
   */
  async clearHistory(): Promise<void> {
    await chrome.storage.local.set({ history: [] });
  }
}

export const requestService = new RequestService();