import React, { useState, useEffect } from 'react';
import { TIMEOUT_OPTIONS } from '@/utils/constants';
import './TimeoutInput.scss';

interface TimeoutInputProps {
  value: number;
  onChange: (timeout: number) => void;
}

/**
 * 超时时间输入组件
 * 支持预设选项和自定义输入
 */
const TimeoutInput: React.FC<TimeoutInputProps> = ({ value, onChange }) => {
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState(value.toString());

  // 找到匹配的预设选项
  const presetOption = TIMEOUT_OPTIONS.find(opt => opt.value === value && opt.value !== 0);

  // 当外部 value 变化时同步状态
  useEffect(() => {
    const isPreset = TIMEOUT_OPTIONS.some(opt => opt.value === value && opt.value !== 0);
    setIsCustom(!isPreset && value > 0);
    setCustomValue(value.toString());
  }, [value]);

  /**
   * 处理预设选项选择
   */
  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedLabel = e.target.value;
    const option = TIMEOUT_OPTIONS.find(opt => opt.label === selectedLabel);

    if (option) {
      if (option.value === 0) {
        // 选择 "Custom" 选项
        setIsCustom(true);
      } else {
        setIsCustom(false);
        onChange(option.value);
      }
    }
  };

  /**
   * 处理自定义输入
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
   * 处理自定义输入失焦，验证范围
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
   * 重置为默认值
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