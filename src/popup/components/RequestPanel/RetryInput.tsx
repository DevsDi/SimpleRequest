import React from 'react';
import { RETRY_COUNT_OPTIONS, DEFAULT_RETRY_DELAY } from '@/utils/constants';
import './RetryInput.scss';

interface RetryInputProps {
  retryCount: number;
  retryDelay: number;
  onRetryCountChange: (count: number) => void;
  onRetryDelayChange: (delay: number) => void;
}

/**
 * 重试配置组件
 * 用于设置请求失败后的重试次数和间隔
 */
const RetryInput: React.FC<RetryInputProps> = ({
  retryCount,
  retryDelay,
  onRetryCountChange,
  onRetryDelayChange,
}) => {
  return (
    <div className="retry-input">
      <label className="retry-label">Retry:</label>
      <select
        className="retry-count-select"
        value={retryCount}
        onChange={(e) => onRetryCountChange(parseInt(e.target.value, 10))}
        title="重试次数"
      >
        {RETRY_COUNT_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {retryCount > 0 && (
        <input
          type="number"
          className="retry-delay-input"
          value={retryDelay}
          onChange={(e) => onRetryDelayChange(parseInt(e.target.value, 10) || DEFAULT_RETRY_DELAY)}
          placeholder="间隔(ms)"
          min={100}
          max={30000}
          title="重试间隔（毫秒）"
        />
      )}
    </div>
  );
};

export default RetryInput;