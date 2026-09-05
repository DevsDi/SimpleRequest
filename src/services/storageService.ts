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
   * Save Tab data to local storage
   * @param data Tab data
   */
  async saveTabsData(data: TabsData): Promise<void> {
    // Don't save responses to storage; use localStorage instead
    const dataToSave = {
      ...data,
      responses: {}, // clear responses
    };
    await chrome.storage.local.set({ tabsData: dataToSave });
  }

  /**
   * Load Tab data
   * @returns Tab data, or null if it doesn't exist
   */
  async loadTabsData(): Promise<TabsData | null> {
    const { tabsData } = await chrome.storage.local.get('tabsData');

    if (tabsData) {
      return tabsData;
    }

    // Try to migrate old data
    const migrated = await this.migrateOldData();
    if (migrated) {
      const { tabsData: newData } = await chrome.storage.local.get('tabsData');
      return newData || null;
    }

    return null;
  }

  /**
   * Check for and migrate old-version data
   */
  async migrateOldData(): Promise<boolean> {
    // Check for old variables and history in the sync storage
    const { variables: oldVariables, history: oldHistory } = await chrome.storage.sync.get(['variables', 'history']);
    // Check for old data in the local storage
    const { currentRequest } = await chrome.storage.local.get('currentRequest');

    // If there is no old data, return directly
    if (!currentRequest && !oldVariables && !oldHistory) {
      return false;
    }

    // Check if tabs data already exists
    const { tabsData: existingTabsData } = await chrome.storage.local.get('tabsData');
    if (existingTabsData && existingTabsData.tabs && existingTabsData.tabs.length > 0) {
      // New data already exists; clean up the old local data
      if (currentRequest) {
        await chrome.storage.local.remove('currentRequest');
      }
      return true;
    }

    // Migrate: turn currentRequest into the first Tab
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

    // Normalize the migration result in one pass: same semantics as migrateLegacyFormDataQuotes (only affects form-data, idempotent),
    // so users upgrading from a pre-tabs version don't need a second launch to remove the paired surrounding double quotes from form-data text values
    request = normalizeRequestContent(request);

    // Generate the tab name
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
      variables: [], // variables are now stored in sync
    };

    await this.saveTabsData(tabsData);

    // Clean up the old local data
    if (currentRequest) {
      await chrome.storage.local.remove('currentRequest');
    }

    return true;
  }

  /**
   * Migrate the paired surrounding double quotes on form-data text entries in historical data
   * The old curlParser/import logic serialized form-data text values as name="value" (with one layer of paired double quotes);
   * when the background sent them as-is the quotes would double up, and the history dedup key (which includes body.content) would split old and new.
   * This method normalizes and writes back all form-data requests in tabsData.requests and history in one pass at startup.
   * Idempotent: running it again when the data is already normalized makes no changes and returns false.
   * @returns Whether this migration wrote anything back (false when nothing changed or on failure)
   */
  async migrateLegacyFormDataQuotes(): Promise<boolean> {
    try {
      const { tabsData, history } = await chrome.storage.local.get(['tabsData', 'history']);
      let changed = false;

      // tabsData: applies to the body.content of every form-data request in the requests map
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

      // history: applies to every entry.request in the array
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
          // Normalization unifies the two old form-data forms name="value" and name=value into the same body.content,
          // making entries with the same history dedup key (which includes body.content) become duplicates, so they must be
          // merged and deduplicated before writing back: only merge keys that this normalization actually changed (without
          // touching duplicates that already existed in the history before migration), keep the first-appearance position of
          // such a key, and take the entry with the newest timestamp for its content (including its response);
          // when there are no duplicate keys, the original order is preserved. The dedup key semantics match store/requestService's getRequestKey.
          const historyToWrite = mergeDuplicateHistory(newHistory, history);
          changed = true;
          await chrome.storage.local.set({ history: historyToWrite });
        }
      }

      return changed;
    } catch (err) {
      // Don't throw migration failures to the caller; just log a warning so the startup flow is unaffected
      console.warn('[migrateLegacyFormDataQuotes] form-data quote migration failed:', err);
      return false;
    }
  }

  /**
   * Clear Tab data
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
        // Normalize every form-data request when importing old-format JSON, to avoid writing split quoted data into history
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
 * Compute the history dedup key, semantically consistent with store/index.ts and requestService.getRequestKey:
 * method / url / headers sorted by enabled / body.type / body.content / auth.type.
 * The getRequestKey in store is not imported directly: it is not exported, and store is the zustand state layer.
 * Having the service layer depend back on the state layer would break the "state layer -> service layer" dependency
 * direction (storageService is widely referenced by popup/background), so an equivalent implementation is inlined here;
 * a minimal key covering body.content is sufficient for dedup during migration.
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
 * Merge duplicate history entries produced by normalization (called before migrateLegacyFormDataQuotes writes back):
 * - Only merge keys that this normalization actually changed (body.content had quotes stripped): such duplicate groups arise
 *   when the name="value" and name=value old forms are unified; keep the first-appearance position of that key,
 *   and take the entry with the newest timestamp for its content (including its response);
 * - Duplicate groups not affected by normalization (already present in the history before migration) are kept as-is, without changing order;
 * - When there are no mergeable duplicate groups, return the original newEntries reference, keeping the order stable.
 * @param newEntries The normalized history array
 * @param oldEntries The corresponding pre-normalization history array, used to determine which requests were actually changed
 */
function mergeDuplicateHistory(
  newEntries: HistoryEntry[],
  oldEntries: HistoryEntry[],
): HistoryEntry[] {
  const keyOf = (entry: HistoryEntry | undefined, idx: number): string =>
    entry && entry.request ? historyDedupKey(entry.request) : `__no_request__${idx}`;

  // Pass 1: count the entries per key, track the newest by timestamp, and mark keys changed by this normalization
  const newestByKey = new Map<string, HistoryEntry>();
  const countByKey = new Map<string, number>();
  const changedKeys = new Set<string>();

  newEntries.forEach((entry, idx) => {
    const key = keyOf(entry, idx);
    countByKey.set(key, (countByKey.get(key) ?? 0) + 1);

    // Take the entry with the newest timestamp; on ties keep the content of the first occurrence (earlier index)
    const prevNewest = newestByKey.get(key);
    if (!prevNewest || (entry?.timestamp ?? 0) > (prevNewest?.timestamp ?? 0)) {
      newestByKey.set(key, entry);
    }

    // The request reference at this position was replaced by normalizeRequestContent, meaning this normalization really changed it
    if (oldEntries[idx]?.request && entry?.request && entry.request !== oldEntries[idx].request) {
      changedKeys.add(key);
    }
  });

  // Merge only when a key was changed by normalization AND appears more than once; otherwise keep the original order and count
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

  // Pass 2: output in first-appearance order; for keys changed by normalization that are duplicated, only output the newest by timestamp
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
