/**
 * 时间格式化工具
 */

/**
 * 格式化时间为本地时间字符串
 * @param timestamp 时间戳(ms)
 * @returns 格式化后的时间字符串 yyyy-MM-dd HH:mm:ss
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  // 北京时间 UTC+8
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 格式化响应时间
 * @param ms 毫秒数
 * @returns 格式化后的时间字符串
 */
export function formatResponseTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * 格式化响应大小
 * @param bytes 字节数
 * @returns 格式化后的大小字符串
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)}KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}