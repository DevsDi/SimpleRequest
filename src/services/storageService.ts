import { HistoryEntry, ExportData } from '@/types';

/**
 * 存储服务
 * 封装chrome.storage操作,提供数据持久化功能
 */
class StorageService {
  /**
   * 获取历史记录
   * @returns 历史记录列表
   */
  async getHistory(): Promise<HistoryEntry[]> {
    const { history } = await chrome.storage.local.get({ history: [] });
    return history;
  }

  /**
   * 设置历史记录
   * @param history 历史记录列表
   */
  async setHistory(history: HistoryEntry[]): Promise<void> {
    await chrome.storage.local.set({ history });
  }

  /**
   * 清空历史记录
   */
  async clearHistory(): Promise<void> {
    await chrome.storage.local.set({ history: [] });
  }

  /**
   * 导出数据为JSON
   * @returns JSON字符串
   */
  async exportData(): Promise<string> {
    const history = await this.getHistory();
    const exportData: ExportData = {
      version: '1.0.0',
      exportedAt: Date.now(),
      history,
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 导入JSON数据
   * @param json JSON字符串
   */
  async importData(json: string): Promise<void> {
    try {
      const data: ExportData = JSON.parse(json);
      if (data.history && Array.isArray(data.history)) {
        await this.setHistory(data.history);
      }
    } catch {
      throw new Error('导入数据格式无效');
    }
  }
}

export const storageService = new StorageService();