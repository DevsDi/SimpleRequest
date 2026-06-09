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
   * 生成请求的唯一标识（用于判断是否相同请求）
   * @param request 请求配置
   * @returns 唯一标识字符串
   */
  private getRequestKey(request: HttpRequest): string {
    // 排序 headers 后序列化，确保顺序不影响比较
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
   * 保存请求到历史记录
   * @param request 请求配置
   * @param response 响应数据
   */
  async saveToHistory(request: HttpRequest, response: HttpResponse): Promise<void> {
    const requestKey = this.getRequestKey(request);

    // 获取现有历史
    const { history } = await chrome.storage.local.get({ history: [] });

    // 检查是否已存在相同请求
    const existingIndex = history.findIndex((entry: HistoryEntry) =>
      this.getRequestKey(entry.request) === requestKey
    );

    if (existingIndex >= 0) {
      // 更新现有记录的时间戳和响应
      history[existingIndex] = {
        ...history[existingIndex],
        response: this.truncateResponse(response),
        timestamp: Date.now(),
      };
      // 移到最前面
      const updatedEntry = history.splice(existingIndex, 1)[0];
      history.unshift(updatedEntry);
    } else {
      // 添加新条目
      const historyEntry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        request,
        response: this.truncateResponse(response),
        timestamp: Date.now(),
      };
      history.unshift(historyEntry);
    }

    // 限制数量并保存
    const newHistory = history.slice(0, MAX_HISTORY_ITEMS);
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