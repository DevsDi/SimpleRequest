import React, { useState, useEffect } from 'react';
import { TIMEOUT_OPTIONS } from '@/utils/constants';
import './TimeoutInput.scss';

interface TimeoutInputProps {
  value: number;
  onChange: (timeout: number) => void;
}

/**
 * Timeout input component
 * Supports preset options and custom input
 */
const TimeoutInput: React.FC<TimeoutInputProps> = ({ value, onChange }) => {
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState(value.toString());

  // Find the matching preset option
  const presetOption = TIMEOUT_OPTIONS.find(opt => opt.value === value && opt.value !== 0);

  // Sync state when the external value changes
  useEffect(() => {
    const isPreset = TIMEOUT_OPTIONS.some(opt => opt.value === value && opt.value !== 0);
    setIsCustom(!isPreset && value > 0);
    setCustomValue(value.toString());
  }, [value]);

  /**
   * Handle preset option selection
   */
  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedLabel = e.target.value;
    const option = TIMEOUT_OPTIONS.find(opt => opt.label === selectedLabel);

    if (option) {
      if (option.value === 0) {
        // The "Custom" option was selected
        setIsCustom(true);
      } else {
        setIsCustom(false);
        onChange(option.value);
      }
    }
  };

  /**
   * Handle custom input
   */
  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setCustomValue(inputValue);

    const val = parseInt(inputValue, 10);
    if (val >= 1000 && val <= 600000) {
      onChange(val);
    }
  };

  /**
   * Handle custom input blur, validating the range
   */
  const handleCustomBlur = () => {
    const val = parseInt(customValue, 10);
    if (isNaN(val) || val < 1000) {
      setCustomValue('1000');
      onChange(1000);
    } else if (val > 600000) {
      setCustomValue('600000');
      onChange(600000);
    }
  };

  /**
   * Reset to the default value
   */
  const handleReset = () => {
    setIsCustom(false);
    onChange(30000);
  };

  return (
    <div className="timeout-input">
      <label className="timeout-label">Timeout:</label>
      {!isCustom ? (
        <select
          className="timeout-select"
          value={presetOption?.label || 'Custom'}
          onChange={handlePresetChange}
        >
          {TIMEOUT_OPTIONS.map(opt => (
            <option key={opt.label} value={opt.label}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <>
          <input
            type="number"
            className="timeout-custom-input"
            value={customValue}
            onChange={handleCustomChange}
            onBlur={handleCustomBlur}
            placeholder="ms"
            min={1000}
            max={600000}
          />
          <button
            className="timeout-reset-btn"
            onClick={handleReset}
            title="Reset to default (30s)"
          >
            ↺
          </button>
        </>
      )}
    </div>
  );
};

export default TimeoutInput;