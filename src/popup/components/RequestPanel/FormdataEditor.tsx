import React, { useState, useRef } from 'react';
import './FormdataEditor.scss';

/**
 * Form data item - Postman style
 */
interface FormDataItem {
  key: string;
  value: string;
  type: 'text' | 'file';
  enabled: boolean;
  description?: string;
  fileName?: string;
  file?: File | null; // Store actual file object
}

/**
 * Form data editor component - Postman style
 */
interface FormdataEditorProps {
  value: string;
  onChange: (value: string, files?: Map<number, File>) => void;
  type: 'form-data' | 'x-www-form-urlencoded';
}

const FormdataEditor: React.FC<FormdataEditorProps> = ({ value, onChange, type }) => {
  const [items, setItems] = useState<FormDataItem[]>(() => parseData(value));
  const [editingFileIndex, setEditingFileIndex] = useState<number | null>(null);

  /** Parse initial data */
  const parseData = (content: string): FormDataItem[] => {
    if (!content.trim()) return [];
    return content.split('\n').filter(l => l.trim()).map(line => {
      const [key, ...valueParts] = line.split('=');
      return { key: key.trim(), value: valueParts.join('=').trim(), type: 'text', enabled: true, description: '' };
    });
  };

  /** Serialize items */
  const serialize = (newItems: FormDataItem[]): string => {
    return newItems.filter(i => i.enabled && i.key.trim()).map(i => `${i.key}=${i.type === 'file' ? i.fileName || '' : i.value}`).join('\n');
  };

  /** Sync with parent */
  const syncValue = (newItems: FormDataItem[]) => {
    const files = new Map<number, File>();
    newItems.forEach((item, idx) => {
      if (item.type === 'file' && item.file) files.set(idx, item.file);
    });
    onChange(serialize(newItems), files);
  };

  /** Add new item */
  const addItem = () => {
    setItems([...items, { key: '', value: '', type: 'text', enabled: true, description: '' }]);
  };

  /** Update item */
  const updateItem = (index: number, field: keyof FormDataItem, val: string | boolean) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: val };
    setItems(newItems);
    if (field !== 'description' && field !== 'fileName' && field !== 'file') syncValue(newItems);
  };

  /** Change type */
  const changeType = (index: number, newType: 'text' | 'file') => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], type: newType, value: newType === 'file' ? '' : newItems[index].value, fileName: '', file: null };
    setItems(newItems);
    syncValue(newItems);
  };

  /** Remove item */
  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    syncValue(newItems);
  };

  /** Toggle enabled */
  const toggleItem = (index: number) => {
    const newItems = [...items];
    newItems[index].enabled = !newItems[index].enabled;
    setItems(newItems);
    syncValue(newItems);
  };

  /** Handle file input directly */
  const handleFileInputChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const newItems = [...items];
    newItems[index] = { ...newItems[index], fileName: file.name, file };
    setItems(newItems);
    syncValue(newItems);
    e.target.value = '';
  };

  const isUrlencoded = type === 'x-www-form-urlencoded';

  return (
    <div className="formdata-editor">
      {/* Table header */}
      <div className="formdata-header">
        <div className="col-check"></div>
        <div className="col-key">Key</div>
        {!isUrlencoded && <div className="col-type">Type</div>}
        <div className="col-value">Value</div>
        <div className="col-desc">Description</div>
        <div className="col-actions"></div>
      </div>

      {/* Items */}
      <div className="formdata-list">
        {items.map((item, index) => (
          <div key={index} className={`formdata-row ${!item.enabled ? 'disabled' : ''}`}>
            <div className="col-check">
              <input type="checkbox" checked={item.enabled} onChange={() => toggleItem(index)} />
            </div>
            <div className="col-key">
              <input type="text" placeholder="Key" value={item.key} onChange={(e) => updateItem(index, 'key', e.target.value)} onBlur={() => syncValue(items)} />
            </div>
            {!isUrlencoded && (
              <div className="col-type">
                <select value={item.type} onChange={(e) => changeType(index, e.target.value as 'text' | 'file')}>
                  <option value="text">Text</option>
                  <option value="file">File</option>
                </select>
              </div>
            )}
            <div className="col-value">
              {item.type === 'file' ? (
                <div className="file-input">
                  <input type="text" placeholder="Select file" value={item.fileName || ''} readOnly />
                  <input
                    type="file"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileInputChange(index, e)}
                    id={`file-input-${index}`}
                  />
                  <button className="select-file-btn" onClick={() => document.getElementById(`file-input-${index}`)?.click()}>
                    Select
                  </button>
                </div>
              ) : (
                <input type="text" placeholder="Value" value={item.value} onChange={(e) => updateItem(index, 'value', e.target.value)} onBlur={() => syncValue(items)} />
              )}
            </div>
            <div className="col-desc">
              <input type="text" placeholder="Description" value={item.description || ''} onChange={(e) => updateItem(index, 'description', e.target.value)} />
            </div>
            <div className="col-actions">
              <button className="remove-btn" onClick={() => removeItem(index)}>×</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="empty-row"><span>No data</span></div>}
      </div>

      <button className="btn btn-secondary add-btn" onClick={addItem}>+ Add Field</button>
    </div>
  );
};

export default FormdataEditor;