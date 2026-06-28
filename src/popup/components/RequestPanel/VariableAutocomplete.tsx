import React, { useState, useEffect, useRef } from 'react';
import { Variable } from '@/types';
import './VariableAutocomplete.scss';

/**
 * VariableAutocomplete 组件 Props
 */
interface VariableAutocompleteProps {
  /** 可用变量列表 */
  variables: Variable[];
  /** 选择变量回调 */
  onSelect: (variableName: string) => void;
  /** 关闭回调 */
  onClose: () => void;
  /** 过滤文本 */
  filter: string;
  /** 下拉菜单位置 */
  position: { top: number; left: number };
}

/**
 * 变量自动提示组件
 * 输入 {{ 时显示变量列表
 */
const VariableAutocomplete: React.FC<VariableAutocompleteProps> = ({
  variables,
  onSelect,
  onClose,
  filter,
  position,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // 过滤已启用的变量
  const enabledVariables = variables.filter(v => v.enabled && v.name.trim());

  // 根据过滤文本筛选变量
  const filteredVariables = filter
    ? enabledVariables.filter(v =>
        v.name.toLowerCase().includes(filter.toLowerCase())
      )
    : enabledVariables;

  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  // 滚动到选中项
  useEffect(() => {
    if (listRef.current) {
      const selectedItem = listRef.current.querySelector('.selected');
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            Math.min(prev + 1, filteredVariables.length - 1)
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredVariables[selectedIndex]) {
            onSelect(filteredVariables[selectedIndex].name);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredVariables, selectedIndex, onSelect, onClose]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.variable-autocomplete') && !target.closest('.url-input')) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (filteredVariables.length === 0) {
    return (
      <div
        className="variable-autocomplete"
        style={{ top: position.top, left: position.left }}
      >
        <div className="variable-empty">
          {enabledVariables.length === 0
            ? 'No variables, add in Variables panel'
            : 'No matching variables'}
        </div>
      </div>
    );
  }

  return (
    <div
      className="variable-autocomplete"
      style={{ top: position.top, left: position.left }}
      ref={listRef}
    >
      {filteredVariables.map((variable, index) => (
        <div
          key={variable.name}
          className={`variable-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(variable.name)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span className="variable-name">
            {highlightMatch(variable.name, filter)}
          </span>
          <span className="variable-value" title={variable.value}>
            {variable.value.length > 30
              ? `${variable.value.slice(0, 30)}...`
              : variable.value}
          </span>
        </div>
      ))}
    </div>
  );
};

/**
 * 高亮匹配文本
 */
function highlightMatch(text: string, filter: string): React.ReactNode {
  if (!filter) return text;

  const lowerText = text.toLowerCase();
  const lowerFilter = filter.toLowerCase();
  const index = lowerText.indexOf(lowerFilter);

  if (index === -1) return text;

  const before = text.slice(0, index);
  const match = text.slice(index, index + filter.length);
  const after = text.slice(index + filter.length);

  return (
    <>
      {before}
      <span className="highlight">{match}</span>
      {after}
    </>
  );
}

export default VariableAutocomplete;