import { HttpRequest, HttpResponse, HistoryEntry } from '@/types';
import { MAX_HISTORY_ITEMS, MAX_RESPONSE_SIZE } from '@/utils/constants';

/**
 * 请求服务
 * 处理HTTP请求执行、响应处理、历史记录保存
 */
class RequestService {
  /**
   * 执行HTTP请求
   * @param request 请求配置
   * @returns 响应数据
   */
  async execute(request: HttpRequest): Promise<HttpResponse> {
    // 通过background service worker发送请求(处理跨域)
    const message = {
      type: 'executeRequest',
      request,
    };

    const response = await chrome.runtime.sendMessage(message);

    if (!response.success) {
      throw new Error(response.error || '请求失败');
    }

    return response.data;
  }

  /**
   * 保存请求到历史记录
   * @param request 请求配置
   * @param response 响应数据
   */
  async saveToHistory(request: HttpRequest, response: HttpResponse): Promise<void> {
    const historyEntry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      request,
      response: this.truncateResponse(response),
      timestamp: Date.now(),
    };

    // 获取现有历史
    const { history } = await chrome.storage.local.get({ history: [] });

    // 添加新条目并限制数量
    const newHistory = [historyEntry, ...history].slice(0, MAX_HISTORY_ITEMS);

    // 保存
    await chrome.storage.local.set({ history: newHistory });
  }

  /**
   * 截断过大的响应体
   * @param response 响应数据
   * @returns 截断后的响应
   */
  private truncateResponse(response: HttpResponse): HttpResponse {
    if (response.size > MAX_RESPONSE_SIZE) {
      return {
        ...response,
        body: '[响应体过大,已截断]',
        size: MAX_RESPONSE_SIZE,
      };
    }
    return response;
  }

  /**
   * 获取历史记录
   * @returns 历史记录列表
   */
  async getHistory(): Promise<HistoryEntry[]> {
    const { history } = await chrome.storage.local.get({ history: [] });
    return history;
  }

  /**
   * 清空历史记录
   */
  async clearHistory(): Promise<void> {
    await chrome.storage.local.set({ history: [] });
  }
}

export const requestService = new RequestService();