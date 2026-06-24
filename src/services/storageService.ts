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

    if (tabsData) {
      return tabsData;
    }

    // 尝试迁移旧数据
    const migrated = await this.migrateOldData();
    if (migrated) {
      const { tabsData: newData } = await chrome.storage.local.get('tabsData');
      return newData || null;
    }

    return null;
  }

  /**
   * 检查并迁移旧版本数据
   * 旧版本使用 currentRequest，新版本使用 tabs 结构
   * @returns 是否执行了迁移
   */
  async migrateOldData(): Promise<boolean> {
    const { currentRequest } = await chrome.storage.local.get('currentRequest');

    if (!currentRequest) {
      return false;
    }

    // 检查是否已有 tabs 数据（直接读取，避免循环调用）
    const { tabsData: existingTabsData } = await chrome.storage.local.get('tabsData');
    if (existingTabsData && existingTabsData.tabs && existingTabsData.tabs.length > 0) {
      // 已有新数据，清理旧数据
      await chrome.storage.local.remove('currentRequest');
      return false;
    }

    // 迁移：将 currentRequest 转为第一个 Tab
    const id = currentRequest.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = Date.now();

    const request: HttpRequest = {
      ...currentRequest,
      id,
      updatedAt: now,
    };

    // 生成 Tab 名称
    let tabName = request.method || 'GET';
    if (request.url) {
      try {
        const urlObj = new URL(request.url.startsWith('http') ? request.url : `https://${request.url}`);
        const path = urlObj.pathname + urlObj.search;
        tabName += ` ${path || '/'}`;
      } catch {
        const pathStart = request.url.indexOf('/');
        if (pathStart !== -1) {
          tabName += ` ${request.url.slice(pathStart)}`;
        } else {
          tabName += ` ${request.url}`;
        }
      }
    } else {
      tabName += ' Untitled';
    }

    if (tabName.length > 25) {
      tabName = tabName.slice(0, 22) + '...';
    }

    const tabsData: TabsData = {
      tabs: [{
        id,
        name: tabName,
        createdAt: now,
      }],
      requests: { [id]: request },
      responses: { [id]: null },
      activeTabId: id,
    };

    await this.saveTabsData(tabsData);
    await chrome.storage.local.remove('currentRequest');

    return true;
  }

  /**
   * 清除 Tab 数据
   */
  async clearTabsData(): Promise<void> {
    await chrome.storage.local.remove('tabsData');
  }
}

export const storageService = new StorageService();