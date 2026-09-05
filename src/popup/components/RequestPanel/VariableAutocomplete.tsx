import React, { useState, useEffect, useRef } from 'react';
import { Variable } from '@/types';
import './VariableAutocomplete.scss';

/**
 * VariableAutocomplete component props
 */
interface VariableAutocompleteProps {
  /** Available variables list */
  variables: Variable[];
  /** Variable selection callback */
  onSelect: (variableName: string) => void;
  /** Close callback */
  onClose: () => void;
  /** Filter text */
  filter: string;
  /** Dropdown menu position */
  position: { top: number; left: number };
}

/**
 * Variable autocomplete component
 * Shows the variable list when typing {{
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

  // Filter enabled variables
  const enabledVariables = variables.filter(v => v.enabled && v.name.trim());

  // Filter variables by the filter text
  const filteredVariables = filter
    ? enabledVariables.filter(v =>
        v.name.toLowerCase().includes(filter.toLowerCase())
      )
    : enabledVariables;

  // Reset the selected index
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  // Scroll the selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedItem = listRef.current.querySelector('.selected');
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Keyboard navigation
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

  // Close on outside click
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
 * Highlight the matching text
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