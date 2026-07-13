import {
  HistoryEntry,
  ExportData,
  Variable,
  TabsData,
  HttpRequest,
} from '@/types';
import { normalizeRequest } from '@/utils/requestUtils';

/**
 * Storage service
 * Wraps chrome.storage operations, provides data persistence functionality
 *
 * Storage strategy:
 * - Variables: chrome.storage.sync (cross-device sync, usually small data)
 * - History: chrome.storage.local (may contain many records, sync quota too small)
 * - TabsData: chrome.storage.local (may contain large request data)
 * - Response: localStorage (cleared with browser cache)
 */
class StorageService {
  // ==================== History (local) ====================

  /**
   * Get history records from local storage
   * @returns History list
   */
  async getHistory(): Promise<HistoryEntry[]> {
    const { history } = await chrome.storage.local.get({ history: [] });
    return history;
  }

  /**
   * Set history records to local storage
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

  // ==================== Variables (sync) ====================

  /**
   * Get variables list from sync storage
   * @returns Variables list
   */
  async getVariables(): Promise<Variable[]> {
    const { variables } = await chrome.storage.sync.get({ variables: [] });
    return variables;
  }

  /**
   * Set variables list to sync storage
   * @param variables Variables list
   */
  async setVariables(variables: Variable[]): Promise<void> {
    await chrome.storage.sync.set({ variables });
  }

  // ==================== TabsData (local) ====================

  /**
   * 保存 Tab 数据到 local storage
   * @param data Tab 数据
   */
  async saveTabsData(data: TabsData): Promise<void> {
    // 不保存 responses 到 storage，改为 localStorage
    const dataToSave = {
      ...data,
      responses: {}, // 清空 responses
    };
    await chrome.storage.local.set({ tabsData: dataToSave });
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
   */
  async migrateOldData(): Promise<boolean> {
    // 检查 sync 存储中的旧 variables 和 history
    const { variables: oldVariables, history: oldHistory } = await chrome.storage.sync.get(['variables', 'history']);
    // 检查 local 存储中的旧数据
    const { currentRequest } = await chrome.storage.local.get('currentRequest');

    // 如果没有旧数据，直接返回
    if (!currentRequest && !oldVariables && !oldHistory) {
      return false;
    }

    // 检查是否已有 tabs 数据
    const { tabsData: existingTabsData } = await chrome.storage.local.get('tabsData');
    if (existingTabsData && existingTabsData.tabs && existingTabsData.tabs.length > 0) {
      // 已有新数据，清理旧的 local 数据
      if (currentRequest) {
        await chrome.storage.local.remove('currentRequest');
      }
      return true;
    }

    // 迁移：将 currentRequest 转为第一个 Tab
    const id = currentRequest?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = Date.now();

    let request: HttpRequest;
    if (currentRequest) {
      request = normalizeRequest({
        ...currentRequest,
        id,
        updatedAt: now,
      });
    } else {
      request = {
        id,
        name: '',
        method: 'GET',
        url: '',
        headers: [],
        body: { type: 'raw', content: '', rawType: 'json' },
        auth: { type: 'no-auth' },
        createdAt: now,
        updatedAt: now,
      };
    }

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
      responses: {},
      activeTabId: id,
      variables: [], // variables 现在存储在 sync 中
    };

    await this.saveTabsData(tabsData);

    // 清理旧的 local 数据
    if (currentRequest) {
      await chrome.storage.local.remove('currentRequest');
    }

    return true;
  }

  /**
   * 清除 Tab 数据
   */
  async clearTabsData(): Promise<void> {
    await chrome.storage.local.remove('tabsData');
  }

  // ==================== Export/Import ====================

  /**
   * Export data as JSON
   * @returns JSON string
   */
  async exportData(): Promise<string> {
    const history = await this.getHistory();
    const variables = await this.getVariables();
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
}

export const storageService = new StorageService();
