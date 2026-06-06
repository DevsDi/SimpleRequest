import React, { useState, useRef, useCallback } from 'react';
import './FormdataEditor.scss';

interface FormDataItem {
  key: string;
  value: string;
  type: 'text' | 'file';
  enabled: boolean;
  description?: string;
  /** File name for display */
  fileName?: string;
  /** File MIME type */
  fileType?: string;
  /** File content as base64 (only for file type) */
  fileData?: string;
}

interface FormdataEditorProps {
  value: string;
  onChange: (value: string) => void;
  type: 'form-data' | 'x-www-form-urlencoded';
}

/**
 * Serialize items to string format.
 * For file items: key=@filename;type=mimetype;base64,data
 * For text items: key=value
 */
const serialize = (items: FormDataItem[]): string => {
  return items
    .filter(i => i.enabled && i.key.trim())
    .map(i => {
      if (i.type === 'file' && i.fileData) {
        // File format: key=@filename;type=mimetype;base64,<data>
        const mimeType = i.fileType || 'application/octet-stream';
        return `${i.key}=@${i.fileName || 'file'};type=${mimeType};base64,${i.fileData}`;
      }
      if (i.type === 'file' && i.fileName) {
        // File selected but not yet loaded (shouldn't happen, but fallback)
        return `${i.key}=@${i.fileName}`;
      }
      return `${i.key}=${i.value}`;
    })
    .join('\n');
};

/**
 * Parse serialized content back to items
 */
const parseFormData = (content: string): FormDataItem[] => {
  if (!content.trim()) return [];
  return content.split('\n').filter(l => l.trim()).map(line => {
    // Check if this is a file entry: key=@filename;type=mimetype;base64,data
    // Only match when '=' is immediately followed by '@' (file marker)
    const fileMarkerIdx = line.indexOf('=@');
    // Must have a key before =@ and after @ must look like a file entry (has ;type= or ;base64,)
    if (fileMarkerIdx > 0) {
      const afterMarker = line.slice(fileMarkerIdx + 2);
      if (afterMarker.includes(';type=') || afterMarker.includes(';base64,')) {
        const key = line.slice(0, fileMarkerIdx).trim();
        const filePart = afterMarker;
        // Parse: filename;type=mimetype;base64,data
        const semicolonIdx = filePart.indexOf(';');
        const fileName = semicolonIdx > 0 ? filePart.slice(0, semicolonIdx) : filePart;
        let fileType = 'application/octet-stream';
        let fileData = '';
        if (semicolonIdx > 0) {
          const rest = filePart.slice(semicolonIdx + 1);
          const typeMatch = rest.match(/^type=([^;]+);/);
          if (typeMatch) fileType = typeMatch[1];
          const base64Match = rest.match(/base64,(.+)$/);
          if (base64Match) fileData = base64Match[1];
        }
        return { key, value: '', type: 'file' as const, enabled: true, description: '', fileName, fileType, fileData };
      }
    }
    const [key, ...valueParts] = line.split('=');
    return { key: key.trim(), value: valueParts.join('=').trim(), type: 'text' as const, enabled: true, description: '' };
  });
};

const FormdataEditor: React.FC<FormdataEditorProps> = ({ value, onChange, type }) => {
  const [items, setItems] = useState<FormDataItem[]>(() => parseFormData(value));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingIndexRef = useRef<number>(-1);

  const isUrlencoded = type === 'x-www-form-urlencoded';

  /** Sync items when external value changes (e.g. curl import, history load) */
  const isInternalUpdate = useRef(false);
  React.useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    // Force all items to 'text' type for urlencoded (no file support)
    const parsed = parseFormData(value).map(item => ({
      ...item,
      type: isUrlencoded ? 'text' as const : item.type,
    }));
    setItems(parsed);
  }, [value, isUrlencoded]);

  const syncValue = (newItems: FormDataItem[]) => {
    isInternalUpdate.current = true;
    onChange(serialize(newItems));
  };

  const addItem = () => {
    const newItem: FormDataItem = { key: '', value: '', type: 'text', enabled: true, description: '' };
    setItems([...items, newItem]);
  };

  const updateItem = (index: number, field: keyof FormDataItem, val: string | boolean) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: val };
    setItems(newItems);
    if (field !== 'description' && field !== 'fileName' && field !== 'fileData' && field !== 'fileType') syncValue(newItems);
  };

  const changeType = (index: number, newType: 'text' | 'file') => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], type: newType, value: newType === 'file' ? '' : newItems[index].value, fileName: '', fileData: '', fileType: '' };
    setItems(newItems);
    syncValue(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    syncValue(items.filter((_, i) => i !== index));
  };

  const toggleItem = (index: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], enabled: !newItems[index].enabled };
    setItems(newItems);
    syncValue(newItems);
  };

  /** Handle file selection - read file content as base64 */
  const handleFileSelect = useCallback((index: number) => {
    pendingIndexRef.current = index;
    fileInputRef.current?.click();
  }, []);

  /** Process selected file - read content and store as base64 */
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const idx = pendingIndexRef.current;
    if (file && idx >= 0) {
      // Read file content as base64
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]; // Remove data:xxx;base64, prefix
        const newItems = [...items];
        newItems[idx] = {
          ...newItems[idx],
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileData: base64,
        };
        setItems(newItems);
        syncValue(newItems);
      };
      reader.readAsDataURL(file);
      pendingIndexRef.current = -1;
    }
    e.target.value = '';
  }, [items]);

  return (
    <div className="formdata-editor">
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />

      <div className="formdata-header">
        <div className="col-check"></div>
        <div className="col-key">Key</div>
        {!isUrlencoded && <div className="col-type">Type</div>}
        <div className="col-value">Value</div>
        <div className="col-desc">Description</div>
        <div className="col-actions"></div>
      </div>

      <div className="formdata-list">
        {items.map((item, index) => (
          <div key={index} className={`formdata-row ${!item.enabled ? 'disabled' : ''}`}>
            <div className="col-check"><input type="checkbox" checked={item.enabled} onChange={() => toggleItem(index)} /></div>
            <div className="col-key"><input type="text" placeholder="Key" value={item.key} onChange={(e) => updateItem(index, 'key', e.target.value)} onBlur={() => syncValue(items)} /></div>
            {!isUrlencoded && (
              <div className="col-type"><select value={item.type} onChange={(e) => changeType(index, e.target.value as 'text' | 'file')}><option value="text">Text</option><option value="file">File</option></select></div>
            )}
            <div className="col-value">
              {item.type === 'file' ? (
                <div className="file-input">
                  <input
                    type="text"
                    placeholder="Select file"
                    value={item.fileName || ''}
                    readOnly
                  />
                  <button className="select-file-btn" onClick={() => handleFileSelect(index)}>Browse</button>
                </div>
              ) : (
                <input type="text" placeholder="Value" value={item.value} onChange={(e) => updateItem(index, 'value', e.target.value)} onBlur={() => syncValue(items)} />
              )}
            </div>
            <div className="col-desc"><input type="text" placeholder="Description" value={item.description || ''} onChange={(e) => updateItem(index, 'description', e.target.value)} /></div>
            <div className="col-actions"><button className="remove-btn" onClick={() => removeItem(index)}>×</button></div>
          </div>
        ))}
        {items.length === 0 && <div className="empty-row"><span>No data</span></div>}
      </div>

      <button className="btn btn-secondary add-btn" onClick={addItem}>+ Add Field</button>
    </div>
  );
};

export default FormdataEditor;
