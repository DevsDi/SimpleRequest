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
  fileName?: string; // For file type
}

/**
 * Form data editor component - Postman style
 * Supports text and file types
 */
interface FormdataEditorProps {
  value: string;
  onChange: (value: string) => void;
  type: 'form-data' | 'x-www-form-urlencoded';
}

const FormdataEditor: React.FC<FormdataEditorProps> = ({ value, onChange, type }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeFileIndex, setActiveFileIndex] = useState<number | null>(null);

  /** Parse initial data */
  const parseData = (content: string): FormDataItem[] => {
    if (!content.trim()) return [];
    try {
      return content.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [key, ...valueParts] = line.split('=');
          return {
            key: key.trim(),
            value: valueParts.join('=').trim(),
            type: 'text' as const,
            enabled: true,
            description: ''
          };
        });
    } catch {
      return [];
    }
  };

  const [items, setItems] = useState<FormDataItem[]>(() => parseData(value));

  /** Serialize items */
  const serialize = (newItems: FormDataItem[]): string => {
    return newItems
      .filter(item => item.enabled && item.key.trim())
      .map(item => `${item.key}=${item.type === 'file' ? item.fileName || '' : item.value}`)
      .join('\n');
  };

  /** Sync with parent */
  const syncValue = (newItems: FormDataItem[]) => {
    onChange(serialize(newItems));
  };

  /** Add new item */
  const addItem = () => {
    const newItems = [...items, {
      key: '',
      value: '',
      type: 'text' as const,
      enabled: true,
      description: '',
      fileName: ''
    }];
    setItems(newItems);
  };

  /** Update item */
  const updateItem = (index: number, field: keyof FormDataItem, value: string | boolean) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
    if (field !== 'description' && field !== 'fileName') {
      syncValue(newItems);
    }
  };

  /** Change item type */
  const changeItemType = (index: number, newType: 'text' | 'file') => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      type: newType,
      value: newType === 'file' ? '' : newItems[index].value,
      fileName: newType === 'file' ? '' : newItems[index].fileName
    };
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
    newItems[index] = { ...newItems[index], enabled: !newItems[index].enabled };
    setItems(newItems);
    syncValue(newItems);
  };

  /** Handle file select */
  const handleFileSelect = (index: number) => {
    setActiveFileIndex(index);
    fileInputRef.current?.click();
  };

  /** Process selected file */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (activeFileIndex === null || !e.target.files?.length) return;

    const file = e.target.files[0];
    const newItems = [...items];
    newItems[activeFileIndex] = {
      ...newItems[activeFileIndex],
      fileName: file.name,
      value: '' // File content handled separately in background
    };
    setItems(newItems);
    syncValue(newItems);
    setActiveFileIndex(null);
    e.target.value = ''; // Reset input
  };

  const isUrlencoded = type === 'x-www-form-urlencoded';

  return (
    <div className="formdata-editor">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Table header */}
      <div className="formdata-header">
        <div className="col-check"></div>
        <div className="col-key">Key</div>
        <div className="col-type">Type</div>
        <div className="col-value">Value</div>
        <div className="col-desc">Description</div>
        <div className="col-actions"></div>
      </div>

      {/* Items list */}
      <div className="formdata-list">
        {items.map((item, index) => (
          <div key={index} className={`formdata-row ${!item.enabled ? 'disabled' : ''}`}>
            <div className="col-check">
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={() => toggleItem(index)}
              />
            </div>
            <div className="col-key">
              <input
                type="text"
                placeholder="Key"
                value={item.key}
                onChange={(e) => updateItem(index, 'key', e.target.value)}
                onBlur={() => syncValue(items)}
              />
            </div>
            <div className="col-type">
              {isUrlencoded ? (
                <span className="type-label">Text</span>
              ) : (
                <select
                  value={item.type}
                  onChange={(e) => changeItemType(index, e.target.value as 'text' | 'file')}
                >
                  <option value="text">Text</option>
                  <option value="file">File</option>
                </select>
              )}
            </div>
            <div className="col-value">
              {item.type === 'file' ? (
                <div className="file-input">
                  <input
                    type="text"
                    placeholder="Select file"
                    value={item.fileName || ''}
                    readOnly
                  />
                  <button className="select-file-btn" onClick={() => handleFileSelect(index)}>
                    Select Files
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Value"
                  value={item.value}
                  onChange={(e) => updateItem(index, 'value', e.target.value)}
                  onBlur={() => syncValue(items)}
                />
              )}
            </div>
            <div className="col-desc">
              <input
                type="text"
                placeholder="Description"
                value={item.description || ''}
                onChange={(e) => updateItem(index, 'description', e.target.value)}
              />
            </div>
            <div className="col-actions">
              <button className="remove-btn" onClick={() => removeItem(index)}>
                ×
              </button>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="empty-row">
            <span>No data. Click "Add Field" to add key-value pairs.</span>
          </div>
        )}
      </div>

      {/* Add button */}
      <button className="btn btn-secondary add-btn" onClick={addItem}>
        + Add Field
      </button>
    </div>
  );
};

export default FormdataEditor;