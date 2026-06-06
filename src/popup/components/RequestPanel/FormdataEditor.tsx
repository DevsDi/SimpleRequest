import React, { useState } from 'react';
import './FormdataEditor.scss';

/**
 * Form data item interface
 */
interface FormDataItem {
  key: string;
  value: string;
  enabled: boolean;
}

/**
 * Form data editor component
 * Key-value pairs for multipart/form-data
 */
interface FormdataEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const FormdataEditor: React.FC<FormdataEditorProps> = ({ value, onChange }) => {
  /** Parse initial data from value */
  const parseData = (content: string): FormDataItem[] => {
    if (!content.trim()) return [];
    // Try to parse as key=value format (each line)
    try {
      return content.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [key, ...valueParts] = line.split('=');
          return {
            key: key.trim(),
            value: valueParts.join('=').trim(),
            enabled: true
          };
        });
    } catch {
      return [];
    }
  };

  const [items, setItems] = useState<FormDataItem[]>(() => parseData(value));

  /** Serialize items to string */
  const serialize = (newItems: FormDataItem[]): string => {
    return newItems
      .filter(item => item.enabled && item.key.trim())
      .map(item => `${item.key}=${item.value}`)
      .join('\n');
  };

  /** Sync with parent */
  const syncValue = (newItems: FormDataItem[]) => {
    const serialized = serialize(newItems);
    onChange(serialized);
  };

  /** Add new item */
  const addItem = () => {
    const newItems = [...items, { key: '', value: '', enabled: true }];
    setItems(newItems);
  };

  /** Update item */
  const updateItem = (index: number, field: keyof FormDataItem, value: string | boolean) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
    if (typeof value === 'string' && newItems[index].key.trim()) {
      syncValue(newItems);
    }
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

  return (
    <div className="formdata-editor">
      <div className="formdata-list">
        {items.map((item, index) => (
          <div key={index} className={`formdata-row ${!item.enabled ? 'disabled' : ''}`}>
            <input
              type="checkbox"
              className="formdata-checkbox"
              checked={item.enabled}
              onChange={() => toggleItem(index)}
            />
            <input
              type="text"
              className="formdata-key"
              placeholder="Key"
              value={item.key}
              onChange={(e) => updateItem(index, 'key', e.target.value)}
              onBlur={() => syncValue(items)}
            />
            <input
              type="text"
              className="formdata-value"
              placeholder="Value"
              value={item.value}
              onChange={(e) => updateItem(index, 'value', e.target.value)}
              onBlur={() => syncValue(items)}
            />
            <button
              className="remove-btn"
              onClick={() => removeItem(index)}
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}

        {items.length === 0 && (
          <div className="empty-hint">
            No form data. Add key-value pairs.
          </div>
        )}
      </div>

      <button className="btn btn-secondary add-btn" onClick={addItem}>
        + Add Field
      </button>
    </div>
  );
};

export default FormdataEditor;