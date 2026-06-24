import { HistoryEntry, ExportData, Variable, Tab, TabsData, HttpRequest, HttpResponse } from '@/types';

/**
 * Storage service
 * Wraps chrome.storage operations, provides data persistence functionality
 */
class StorageService {
  /**
   * Get history records
   * @returns History list
   */
  async getHistory(): Promise<HistoryEntry[]> {
    const { history } = await chrome.storage.local.get({ history: [] });
    return history;
  }

  /**
   * Set history records
   * @param history History list
   */
  async setHistory(history: HistoryEntry[]): Promise<void> {
    await chrome.storage.local.set({ history });
  }

  /**
   * Clear history records
   */
  async clearHistory(): Promise<void> {
    await chrome.storage.local.set({ history: [] });
  }

  /**
   * Export data as JSON
   * @returns JSON string
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
   * Import JSON data
   * @param json JSON string
   */
  async importData(json: string): Promise<void> {
    try {
      const data: ExportData = JSON.parse(json);
      if (data.history && Array.isArray(data.history)) {
        await this.setHistory(data.history);
      }
    } catch {
      throw new Error('Invalid import data format');
    }
  }

  /**
   * Get variables list
   * @returns Variables list
   */
  async getVariables(): Promise<Variable[]> {
    const { variables } = await chrome.storage.local.get({ variables: [] });
    return variables;
  }

  /**
   * Set variables list
   * @param variables Variables list
   */
  async setVariables(variables: Variable[]): Promise<void> {
    await chrome.storage.local.set({ variables });
  }

  /**
   * 保存 Tab 数据
   * @param data Tab 数据
   */
  async saveTabsData(data: TabsData): Promise<void> {
    await chrome.storage.local.set({ tabsData: data });
  }

  /**
   * 加载 Tab 数据
   * @returns Tab 数据，如果不存在返回 null
   */
  async loadTabsData(): Promise<TabsData | null> {
    const { tabsData } = await chrome.storage.local.get('tabsData');
    return tabsData || null;
  }

  /**
   * 清除 Tab 数据
   */
  async clearTabsData(): Promise<void> {
    await chrome.storage.local.remove('tabsData');
  }
}

export const storageService = new StorageService();