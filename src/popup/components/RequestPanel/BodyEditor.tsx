import React from 'react';
import { useStore } from '@/store';
import { BODY_TYPES, BodyType } from '@/utils/constants';
import './BodyEditor.scss';

/**
 * Body editor component
 * Supports JSON, Form-Data, Raw formats
 */
const BodyEditor: React.FC = () => {
  const { currentRequest, updateRequest } = useStore();
  const { body } = currentRequest;

  /** Handle type change */
  const handleTypeChange = (type: BodyType) => {
    updateRequest({
      body: { ...body, type },
    });
  };

  /** Handle content change */
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateRequest({
      body: { ...body, content: e.target.value },
    });
  };

  /** Format JSON */
  const formatJson = () => {
    if (body.type !== 'json' || !body.content.trim()) return;
    try {
      const parsed = JSON.parse(body.content);
      const formatted = JSON.stringify(parsed, null, 2);
      updateRequest({
        body: { ...body, content: formatted },
      });
    } catch {
      // JSON parse failed
    }
  };

  return (
    <div className="body-editor">
      {/* Type selector */}
      <div className="body-type-selector">
        {BODY_TYPES.filter((t) => t !== 'none').map((type) => (
          <button
            key={type}
            className={`type-btn ${body.type === type ? 'active' : ''}`}
            onClick={() => handleTypeChange(type)}
          >
            {type}
          </button>
        ))}
        <button
          className={`type-btn ${body.type === 'none' ? 'active' : ''}`}
          onClick={() => handleTypeChange('none')}
        >
          none
        </button>
      </div>

      {/* Content area */}
      {body.type !== 'none' && (
        <div className="body-content">
          {body.type === 'json' && (
            <div className="json-actions">
              <button className="btn btn-secondary" onClick={formatJson}>
                Format JSON
              </button>
            </div>
          )}
          <textarea
            className="body-textarea"
            placeholder={
              body.type === 'json'
                ? 'Enter JSON data...'
                : body.type === 'form-data'
                  ? 'Enter form data...'
                  : 'Enter raw data...'
            }
            value={body.content}
            onChange={handleContentChange}
          />
          {body.type === 'json' && (
            <div className="body-hint">Tip: Supports JSON formatting</div>
          )}
        </div>
      )}

      {body.type === 'none' && (
        <div className="body-empty">No body for this request</div>
      )}
    </div>
  );
};

export default BodyEditor;