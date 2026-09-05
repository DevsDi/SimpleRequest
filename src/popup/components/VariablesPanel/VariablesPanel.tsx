import React, { useState } from 'react';
import { useStore } from '@/store';
import { Variable } from '@/types';
import './VariablesPanel.scss';

/**
 * Variables panel component
 * A single variable management panel supporting adding, editing, and deleting variables
 */
const VariablesPanel: React.FC = () => {
  const { variables, setVariables } = useStore();

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');

  /** Add a new variable */
  const handleAddVariable = () => {
    if (!newName.trim()) return;

    const newVar: Variable = {
      name: newName.trim(),
      value: newValue,
      enabled: true,
    };

    setVariables([...variables, newVar]);
    setNewName('');
    setNewValue('');
  };

  /** Delete a variable */
  const handleDeleteVariable = (index: number) => {
    const newVars = variables.filter((_, i) => i !== index);
    setVariables(newVars);
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  /** Toggle the enabled state of a variable */
  const handleToggleVariable = (index: number) => {
    const newVars = variables.map((v, i) =>
      i === index ? { ...v, enabled: !v.enabled } : v
    );
    setVariables(newVars);
  };

  /** Start editing a variable */
  const handleEditVariable = (index: number) => {
    setEditingIndex(index);
  };

  /** Save variable edit */
  const handleSaveEdit = (index: number, name: string, value: string) => {
    const newVars = variables.map((v, i) =>
      i === index ? { ...v, name: name.trim(), value } : v
    );
    setVariables(newVars);
    setEditingIndex(null);
  };

  /** Cancel variable edit */
  const handleCancelEdit = () => {
    setEditingIndex(null);
  };

  return (
    <div className="variables-panel">
      {/* Title */}
      <div className="panel-header">
        <h3>Variables</h3>
        <span className="count">{variables.length}</span>
      </div>

      {/* Add new variable */}
      <div className="add-variable">
        <input
          type="text"
          className="var-name-input"
          placeholder="Variable name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddVariable()}
        />
        <input
          type="text"
          className="var-value-input"
          placeholder="Variable value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddVariable()}
        />
        <button className="btn btn-add" onClick={handleAddVariable} disabled={!newName.trim()}>
          +
        </button>
      </div>

      {/* Variable list */}
      <div className="variables-list">
        {variables.length === 0 && (
          <div className="empty-hint">
            <p>No variables</p>
            <p className="tip">Use {'{{'}variableName{'}}'} syntax to reference variables</p>
          </div>
        )}

        {variables.map((variable, index) => (
          <div
            key={`${variable.name}-${index}`}
            className={`variable-item ${variable.enabled ? 'enabled' : 'disabled'} ${editingIndex === index ? 'editing' : ''}`}
          >
            {editingIndex === index ? (
              // Edit mode
              <>
                <input
                  type="text"
                  className="edit-name"
                  defaultValue={variable.name}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const target = e.target as HTMLInputElement;
                      const nextSibling = target.nextSibling as HTMLInputElement;
                      handleSaveEdit(index, target.value, nextSibling?.value || variable.value);
                    }
                    if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                />
                <input
                  type="text"
                  className="edit-value"
                  defaultValue={variable.value}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const target = e.target as HTMLInputElement;
                      const prevSibling = target.previousSibling as HTMLInputElement;
                      handleSaveEdit(index, prevSibling?.value || variable.name, target.value);
                    }
                    if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                />
                <button className="btn btn-save" onClick={() => {
                  const item = document.querySelector(`.variable-item.editing`);
                  const nameInput = item?.querySelector('.edit-name') as HTMLInputElement;
                  const valueInput = item?.querySelector('.edit-value') as HTMLInputElement;
                  handleSaveEdit(index, nameInput?.value || variable.name, valueInput?.value || variable.value);
                }}>
                  ✓
                </button>
                <button className="btn btn-cancel" onClick={handleCancelEdit}>
                  ×
                </button>
              </>
            ) : (
              // Display mode
              <>
                <input
                  type="checkbox"
                  className="var-toggle"
                  checked={variable.enabled}
                  onChange={() => handleToggleVariable(index)}
                />
                <span className="var-name">{variable.name}</span>
                <span className="var-value">{variable.value}</span>
                <button className="btn btn-edit" onClick={() => handleEditVariable(index)}>
                  ✎
                </button>
                <button className="btn btn-delete" onClick={() => handleDeleteVariable(index)}>
                  ×
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VariablesPanel;