import {
  HistoryEntry,
  ExportData,
  Variable,
  TabsData,
  HttpRequest,
} from '@/types';
import { normalizeRequest } from '@/utils/requestUtils';
import { normalizeRequestContent } from '@/utils/formDataNormalize';

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

    // 迁移结果一次性归一化：与 migrateLegacyFormDataQuotes 相同语义（仅 form-data 生效、幂等），
    // pre-tabs 版本升级用户无需二次启动即可去除 form-data 文本值的成对包裹双引号
    request = normalizeRequestContent(request);

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
   * 迁移历史数据中 form-data 文本条目的成对包裹双引号
   * 旧版 curlParser/导入逻辑会把 form-data 文本值序列化为 name="value"（带一层成对双引号），
   * background 发送时原样发送会引号翻倍、且历史去重键（含 body.content）会新旧分裂。
   * 此方法在启动时一次性把 tabsData.requests 与 history 中的所有 form-data 请求归一化写回，
   * 幂等：二次执行且数据已归一化时无任何改动，返回 false。
   * @returns 本次迁移是否发生了写回（未发生改动或失败时返回 false）
   */
  async migrateLegacyFormDataQuotes(): Promise<boolean> {
    try {
      const { tabsData, history } = await chrome.storage.local.get(['tabsData', 'history']);
      let changed = false;

      // tabsData：作用于 requests 映射中每个 form-data 请求的 body.content
      if (tabsData && tabsData.requests && typeof tabsData.requests === 'object') {
        const before = JSON.stringify(tabsData.requests);
        const newRequests: Record<string, HttpRequest> = {};
        for (const [id, request] of Object.entries(tabsData.requests)) {
          newRequests[id] =
            request && typeof request === 'object'
              ? normalizeRequestContent(request as HttpRequest)
              : (request as HttpRequest);
        }
        const after = JSON.stringify(newRequests);
        if (before !== after) {
          changed = true;
          await chrome.storage.local.set({ tabsData: { ...tabsData, requests: newRequests } });
        }
      }

      // history：作用于数组中每项 entry.request
      if (Array.isArray(history)) {
        const before = JSON.stringify(history);
        const newHistory = history.map((entry) => {
          if (entry && entry.request) {
            const normalized = normalizeRequestContent(entry.request);
            return normalized === entry.request ? entry : { ...entry, request: normalized };
          }
          return entry;
        });
        const after = JSON.stringify(newHistory);
        if (before !== after) {
          // 归一化会把 form-data 的 name="value" 与 name=value 两种旧形态统一为相同 body.content，
          // 使历史去重键（含 body.content）相同的条目变成重复，写回前需合并去重：
          // 只合并本次归一化确实改变过的请求键（不触碰迁移前历史里已存在的重复），
          // 保留该键首次出现的位置、内容取 timestamp 最新的一条（含其 response）；
          // 无重复键时保持原顺序。去重键与 store/requestService 的 getRequestKey 语义一致。
          const historyToWrite = mergeDuplicateHistory(newHistory, history);
          changed = true;
          await chrome.storage.local.set({ history: historyToWrite });
        }
      }

      return changed;
    } catch (err) {
      // 迁移失败不抛给上层，仅记录警告，保证启动流程不受影响
      console.warn('[migrateLegacyFormDataQuotes] form-data 引号迁移失败:', err);
      return false;
    }
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
        // 导入旧版格式 JSON 时对每个 form-data 请求归一化，避免带引号的分裂数据写入历史
        const normalizedHistory = data.history.map((entry) => {
          if (entry && entry.request) {
            const normalized = normalizeRequestContent(entry.request);
            return normalized === entry.request ? entry : { ...entry, request: normalized };
          }
          return entry;
        });
        await this.setHistory(normalizedHistory);
      }
    } catch {
      throw new Error('Invalid import data format');
    }
  }
}

/**
 * 计算历史去重键，与 store/index.ts 与 requestService.getRequestKey 语义一致：
 * method / url / enabled 排序后的 headers / body.type / body.content / auth.type。
 * 未直接 import store 中的 getRequestKey：该函数未导出，且 store 是 zustand 状态层，
 * 服务层反向依赖状态层会破坏“状态层→服务层”的依赖方向（storageService 被 popup/background 广泛引用），
 * 故在此内联等价实现，覆盖到含 body.content 的最小键即可满足迁移期去重需要。
 */
function historyDedupKey(request: HttpRequest): string {
  const sortedHeaders = (request.headers || [])
    .filter((h) => h.enabled)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((h) => `${h.key}:${h.value}`);

  return [
    request.method,
    request.url,
    sortedHeaders.join('|'),
    request.body?.type,
    request.body?.content,
    request.auth?.type,
  ].join('::');
}

/**
 * 合并归一化产生的重复历史条目（供 migrateLegacyFormDataQuotes 写回前调用）：
 * - 仅合并本次归一化确实改变过（body.content 被剥引号）的请求键：这样的重复组是
 *   name="value" 与 name=value 两种旧形态统一后产生的，合并时保留该键首次出现的
 *   位置、内容取 timestamp 最新的一条（含其 response）；
 * - 未受归一化影响的重复组（迁移前历史里已存在）原样保留，不改变顺序；
 * - 无可合并的重复组时返回 newEntries 原引用，保证顺序稳定。
 * @param newEntries 归一化后的历史数组
 * @param oldEntries 归一化前对应的历史数组，用于判断哪些请求被实际改动
 */
function mergeDuplicateHistory(
  newEntries: HistoryEntry[],
  oldEntries: HistoryEntry[],
): HistoryEntry[] {
  const keyOf = (entry: HistoryEntry | undefined, idx: number): string =>
    entry && entry.request ? historyDedupKey(entry.request) : `__no_request__${idx}`;

  // 第一遍：统计每个键的条目数、timestamp 最新的一条，并标记被本次归一化改动的键
  const newestByKey = new Map<string, HistoryEntry>();
  const countByKey = new Map<string, number>();
  const changedKeys = new Set<string>();

  newEntries.forEach((entry, idx) => {
    const key = keyOf(entry, idx);
    countByKey.set(key, (countByKey.get(key) ?? 0) + 1);

    // 取 timestamp 最新的一条；同值时保留首次出现（更早索引）的内容
    const prevNewest = newestByKey.get(key);
    if (!prevNewest || (entry?.timestamp ?? 0) > (prevNewest?.timestamp ?? 0)) {
      newestByKey.set(key, entry);
    }

    // 该位置的请求引用被 normalizeRequestContent 替换，说明本次归一化确实改动了它
    if (oldEntries[idx]?.request && entry?.request && entry.request !== oldEntries[idx].request) {
      changedKeys.add(key);
    }
  });

  // 仅当存在“被归一化改动且出现重复”的键时才需要合并；否则保持原顺序、原数量
  let needMerge = false;
  for (const key of changedKeys) {
    if ((countByKey.get(key) ?? 0) > 1) {
      needMerge = true;
      break;
    }
  }
  if (!needMerge) {
    return newEntries;
  }

  // 第二遍：按首次出现顺序输出；被归一化改动且重复的键只输出 timestamp 最新的一条
  const out: HistoryEntry[] = [];
  const collapsed = new Set<string>();
  newEntries.forEach((entry, idx) => {
    const key = keyOf(entry, idx);
    if (changedKeys.has(key) && (countByKey.get(key) ?? 0) > 1) {
      if (collapsed.has(key)) return;
      collapsed.add(key);
      out.push(newestByKey.get(key) || entry);
      return;
    }
    out.push(entry);
  });

  return out;
}

export const storageService = new StorageService();
