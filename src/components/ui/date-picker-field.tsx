import React, { useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from './button';
import { Calendar } from './calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DatePickerFieldProps {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export const DatePickerField: React.FC<DatePickerFieldProps> = ({
  value,
  onChange,
  placeholder = 'Selecione uma data',
  required = false,
  disabled = false,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            "!bg-white dark:!bg-zinc-900",
            "!text-gray-900 dark:!text-white",
            "!border-gray-300 dark:!border-zinc-700",
            "hover:!bg-gray-50 dark:hover:!bg-zinc-800",
            !value && "!text-gray-500 dark:!text-gray-400",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? (
            format(new Date(value + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ? new Date(value + 'T00:00:00') : undefined}
          onSelect={(date) => {
            if (date) {
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              onChange(`${year}-${month}-${day}`);
              setIsOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
};
