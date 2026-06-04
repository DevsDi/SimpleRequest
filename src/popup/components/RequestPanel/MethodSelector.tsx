import React from 'react';
import './MethodSelector.scss';

/**
 * HTTP方法选择器组件
 * 下拉选择HTTP请求方法
 */
interface MethodSelectorProps {
  /** 当前选中的方法 */
  value: string;
  /** 方法变化回调 */
  onChange: (method: string) => void;
}

const MethodSelector: React.FC<MethodSelectorProps> = ({ value, onChange }) => {
  /** 方法颜色映射 */
  const methodColors: Record<string, string> = {
    GET: 'var(--method-get)',
    POST: 'var(--method-post)',
    PUT: 'var(--method-put)',
    DELETE: 'var(--method-delete)',
    PATCH: 'var(--method-patch)',
    HEAD: '#17a2b8',
    OPTIONS: '#6c757d',
  };

  return (
    <div className="method-selector">
      <select
        className="method-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ color: methodColors[value] || 'var(--text-primary)' }}
      >
        {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].map((method) => (
          <option key={method} value={method} style={{ color: methodColors[method] }}>
            {method}
          </option>
        ))}
      </select>
    </div>
  );
};

export default MethodSelector;