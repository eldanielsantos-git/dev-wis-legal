import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface OptionGroup {
  label: string;
  options: Option[];
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  optionGroups?: OptionGroup[];
  placeholder?: string;
  colors: {
    card: string;
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
  };
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  optionGroups,
  placeholder = '-- Selecione --',
  colors,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border rounded-lg px-4 py-3 pr-10 text-left cursor-pointer focus:outline-none transition-all"
        style={{ backgroundColor: colors.card, color: value ? colors.text : colors.textSecondary, borderColor: colors.border }}
      >
        {displayText}
      </button>
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          strokeWidth={1.5}
          style={{ color: colors.textSecondary }}
        />
      </div>

      {isOpen && (
        <div
          className="absolute z-50 w-full mt-1 rounded-lg border shadow-lg max-h-80 overflow-y-auto"
          style={{ backgroundColor: colors.card, borderColor: colors.border }}
        >
          {/* Empty option */}
          <div
            onClick={() => handleSelect('')}
            className="px-4 py-2.5 cursor-pointer hover:bg-opacity-10 hover:bg-gray-500 transition-colors flex items-center justify-between"
            style={{ color: colors.textSecondary }}
          >
            <span>{placeholder}</span>
            {!value && <Check className="w-4 h-4" style={{ color: colors.primary }} />}
          </div>

          {/* Option groups */}
          {optionGroups && optionGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              <div
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider border-t"
                style={{
                  color: colors.textSecondary,
                  borderColor: colors.border,
                  opacity: 0.7
                }}
              >
                {group.label}
              </div>
              {group.options.map((option) => (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className="px-4 py-2.5 cursor-pointer hover:bg-opacity-10 hover:bg-gray-500 transition-colors flex items-center justify-between"
                  style={{ color: colors.text }}
                >
                  <span>{option.label}</span>
                  {value === option.value && (
                    <Check className="w-4 h-4" style={{ color: colors.primary }} />
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* Simple options */}
          {!optionGroups && options.map((option) => (
            <div
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className="px-4 py-2.5 cursor-pointer hover:bg-opacity-10 hover:bg-gray-500 transition-colors flex items-center justify-between"
              style={{ color: colors.text }}
            >
              <span>{option.label}</span>
              {value === option.value && (
                <Check className="w-4 h-4" style={{ color: colors.primary }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
