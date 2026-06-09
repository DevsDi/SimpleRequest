import { HttpRequest, HttpResponse, HistoryEntry } from '@/types';
import { MAX_HISTORY_ITEMS, MAX_RESPONSE_SIZE } from '@/utils/constants';

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
   * Save request to history
   * @param request Request configuration
   * @param response Response data
   */
  async saveToHistory(request: HttpRequest, response: HttpResponse): Promise<void> {
    const requestKey = this.getRequestKey(request);

    // Get existing history
    const { history } = await chrome.storage.local.get({ history: [] });

    // Check if same request already exists
    const existingIndex = history.findIndex((entry: HistoryEntry) =>
      this.getRequestKey(entry.request) === requestKey
    );

    if (existingIndex >= 0) {
      // Update existing record timestamp and response
      history[existingIndex] = {
        ...history[existingIndex],
        response: this.truncateResponse(response),
        timestamp: Date.now(),
      };
      // Move to front
      const updatedEntry = history.splice(existingIndex, 1)[0];
      history.unshift(updatedEntry);
    } else {
      // Add new entry
      const historyEntry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        request,
        response: this.truncateResponse(response),
        timestamp: Date.now(),
      };
      history.unshift(historyEntry);
    }

    // Limit count and save
    const newHistory = history.slice(0, MAX_HISTORY_ITEMS);
    await chrome.storage.local.set({ history: newHistory });
  }

  /**
   * Truncate oversized response body
   * @param response Response data
   * @returns Truncated response
   */
  private truncateResponse(response: HttpResponse): HttpResponse {
    if (response.size > MAX_RESPONSE_SIZE) {
      return {
        ...response,
        body: '[Response body too large, truncated]',
        size: MAX_RESPONSE_SIZE,
      };
    }
    return response;
  }

  /**
   * Get history records
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