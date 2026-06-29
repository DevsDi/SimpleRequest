import React, { useState } from 'react';
import { useStore } from '@/store';
import { Variable } from '@/types';
import './VariablesPanel.scss';

/**
 * Variables panel component
 * 单一变量管理面板，支持添加、编辑、删除变量
 */
const VariablesPanel: React.FC = () => {
  const { variables, setVariables } = useStore();

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');

  /** 添加新变量 */
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

  /** 删除变量 */
  const handleDeleteVariable = (index: number) => {
    const newVars = variables.filter((_, i) => i !== index);
    setVariables(newVars);
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  /** 切换变量启用状态 */
  const handleToggleVariable = (index: number) => {
    const newVars = variables.map((v, i) =>
      i === index ? { ...v, enabled: !v.enabled } : v
    );
    setVariables(newVars);
  };

  /** 开始编辑变量 */
  const handleEditVariable = (index: number) => {
    setEditingIndex(index);
  };

  /** 保存变量编辑 */
  const handleSaveEdit = (index: number, name: string, value: string) => {
    const newVars = variables.map((v, i) =>
      i === index ? { ...v, name: name.trim(), value } : v
    );
    setVariables(newVars);
    setEditingIndex(null);
  };

  /** 取消变量编辑 */
  const handleCancelEdit = () => {
    setEditingIndex(null);
  };

  return (
    <div className="variables-panel">
      {/* 标题 */}
      <div className="panel-header">
        <h3>Variables</h3>
        <span className="count">{variables.length}</span>
      </div>

      {/* 添加新变量 */}
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

      {/* 变量列表 */}
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
              // 编辑模式
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
              // 显示模式
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