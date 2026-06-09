import React from 'react';
import './MethodSelector.scss';

/**
 * HTTP method selector component
 * Dropdown to select HTTP request method
 */
interface MethodSelectorProps {
  /** Currently selected method */
  value: string;
  /** Method change callback */
  onChange: (method: string) => void;
}

const MethodSelector: React.FC<MethodSelectorProps> = ({ value, onChange }) => {
  /** Method color mapping */
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