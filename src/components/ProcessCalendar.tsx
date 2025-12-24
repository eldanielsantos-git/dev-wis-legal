import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { ProcessDeadline } from '../types/analysis';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { DatePopover } from './DatePopover';

interface ProcessCalendarProps {
  deadlines: ProcessDeadline[];
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  onViewDeadline?: (deadline: ProcessDeadline) => void;
  onCreateDeadline?: (date?: Date) => void;
}

export const ProcessCalendar: React.FC<ProcessCalendarProps> = ({
  deadlines,
  selectedDate,
  onDateSelect,
  onViewDeadline,
  onCreateDeadline
}) => {
  const { theme } = useTheme();
  const colors = useMemo(() => getThemeColors(theme), [theme]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [popoverState, setPopoverState] = useState<{
    isOpen: boolean;
    date: Date | null;
    position: { x: number; y: number };
  }>({
    isOpen: false,
    date: null,
    position: { x: 0, y: 0 }
  });

  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  ).getDate();

  const firstDayOfMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1
  ).getDay();

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const getDeadlinesForDate = (date: Date): ProcessDeadline[] => {
    const dateStr = date.toISOString().split('T')[0];
    return deadlines.filter(d => d.deadline_date === dateStr);
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    onDateSelect(today);
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date: Date): boolean => {
    if (!selectedDate) return false;
    return date.getDate() === selectedDate.getDate() &&
           date.getMonth() === selectedDate.getMonth() &&
           date.getFullYear() === selectedDate.getFullYear();
  };

  const handleDateClick = (date: Date, event: React.MouseEvent<HTMLButtonElement>) => {
    onDateSelect(date);

    const rect = event.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = rect.left + rect.width / 2;
    let y = rect.bottom + 8;

    const popoverWidth = 320;
    const popoverHeight = 300;

    if (x + popoverWidth / 2 > viewportWidth) {
      x = viewportWidth - popoverWidth - 16;
    } else if (x - popoverWidth / 2 < 0) {
      x = 16;
    } else {
      x = x - popoverWidth / 2;
    }

    if (y + popoverHeight > viewportHeight) {
      y = rect.top - popoverHeight - 8;
    }

    setPopoverState({
      isOpen: true,
      date,
      position: { x, y }
    });
  };

  const handleClosePopover = () => {
    setPopoverState({
      isOpen: false,
      date: null,
      position: { x: 0, y: 0 }
    });
  };

  const renderCalendarDays = () => {
    const days = [];
    const totalCells = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7;

    const prevMonthDays = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      0
    ).getDate();

    for (let i = 0; i < totalCells; i++) {
      const dayNumber = i - firstDayOfMonth + 1;
      let date: Date;
      let displayDay: number;
      let isCurrentMonth = true;

      if (dayNumber < 1) {
        displayDay = prevMonthDays + dayNumber;
        date = new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth() - 1,
          displayDay
        );
        isCurrentMonth = false;
      } else if (dayNumber > daysInMonth) {
        displayDay = dayNumber - daysInMonth;
        date = new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth() + 1,
          displayDay
        );
        isCurrentMonth = false;
      } else {
        displayDay = dayNumber;
        date = new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth(),
          dayNumber
        );
      }

      const dayDeadlines = getDeadlinesForDate(date);
      const hasPending = dayDeadlines.some(d => d.status === 'pending');
      const hasExpired = dayDeadlines.some(d => d.status === 'expired');

      days.push(
        <button
          key={i}
          onClick={(e) => handleDateClick(date, e)}
          className={`
            aspect-square p-2 text-sm font-medium transition-all
            ${dayDeadlines.length > 0 ? 'font-bold' : ''}
          `}
          style={{
            backgroundColor: isToday(date)
              ? theme === 'dark' ? 'rgba(255, 255, 255, 0.10)' : 'rgba(26, 26, 26, 0.10)'
              : isSelected(date)
                ? `${colors.accent}30`
                : 'transparent',
            color: isToday(date)
              ? theme === 'dark' ? '#ffffff' : '#000000'
              : isSelected(date)
                ? colors.accent
                : colors.textPrimary,
            opacity: isCurrentMonth ? 1 : 0.4,
            borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid #FFFFFF',
            borderLeft: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid #FFFFFF',
            borderRight: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid #FFFFFF',
            borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid #FFFFFF',
            borderRadius: isToday(date) ? '8px' : '0',
            margin: isToday(date) ? '2px' : '0'
          }}
          onMouseEnter={(e) => {
            if (!isToday(date) && !isSelected(date)) {
              e.currentTarget.style.backgroundColor = `${colors.accent}10`;
            }
          }}
          onMouseLeave={(e) => {
            if (!isToday(date) && !isSelected(date)) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <div className="flex flex-col items-center justify-center h-full">
            <span>{displayDay}</span>
            {dayDeadlines.length > 0 && (
              <div className="flex gap-1 mt-1">
                {hasPending && (
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                )}
                {hasExpired && (
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
                {dayDeadlines.some(d => d.status === 'completed') && (
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                )}
              </div>
            )}
          </div>
        </button>
      );
    }

    return days;
  };

  return (
    <div className="rounded-xl shadow-lg p-6" style={{ backgroundColor: colors.bgSecondary }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: colors.textPrimary }}>
          <CalendarIcon className="w-5 h-5" style={{ color: colors.accent }} />
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleToday}
            className="px-3 py-1 text-sm font-medium rounded-lg transition-all"
            style={{
              color: theme === 'dark' ? colors.accent : colors.textPrimary,
              backgroundColor: `${colors.accent}15`
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${colors.accent}25`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = `${colors.accent}15`;
            }}
          >
            Hoje
          </button>
          <button
            onClick={handlePreviousMonth}
            className="p-2 rounded-lg transition-all"
            aria-label="Mês anterior"
            style={{ color: colors.textPrimary }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${colors.accent}15`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg transition-all"
            aria-label="Próximo mês"
            style={{ color: colors.textPrimary }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${colors.accent}15`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {weekDays.map(day => (
          <div
            key={day}
            className="text-center text-sm font-semibold py-2"
            style={{
              color: colors.textSecondary,
              borderRight: `1px solid ${colors.border}20`,
              borderBottom: `1px solid ${colors.border}30`
            }}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {renderCalendarDays()}
      </div>

      <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${colors.border}` }}>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span style={{ color: colors.textSecondary }}>Pendente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span style={{ color: colors.textSecondary }}>Concluído</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span style={{ color: colors.textSecondary }}>Vencido</span>
          </div>
        </div>
      </div>

      {popoverState.isOpen && popoverState.date && (
        <DatePopover
          date={popoverState.date}
          deadlines={getDeadlinesForDate(popoverState.date)}
          position={popoverState.position}
          onClose={handleClosePopover}
          onViewDeadline={(deadline) => {
            if (onViewDeadline) {
              onViewDeadline(deadline);
            }
          }}
          onCreateDeadline={() => {
            if (onCreateDeadline) {
              onCreateDeadline(popoverState.date || undefined);
            }
          }}
        />
      )}
    </div>
  );
};
