import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { ProcessDeadline } from '../types/analysis';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { DatePopover } from './DatePopover';
import { getBrazilDate, isTodayBrazil } from '../utils/dateHelpers';

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
    const today = getBrazilDate();
    setCurrentMonth(today);
    onDateSelect(today);
  };

  const isToday = (date: Date): boolean => {
    return isTodayBrazil(date);
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
            aspect-square lg:aspect-auto
            p-0.5 sm:p-0.5 md:p-1 lg:p-1.5
            text-sm sm:text-sm md:text-xs lg:text-sm
            font-medium transition-all
            min-h-[1.6rem] sm:min-h-[1.4rem] md:min-h-[1.2rem] lg:h-28
            max-h-[3rem] sm:max-h-[2.5rem] md:max-h-[2rem] lg:max-h-28
            ${dayDeadlines.length > 0 ? 'font-bold' : ''}
          `}
          style={{
            backgroundColor: isToday(date)
              ? theme === 'dark' ? 'rgba(255, 255, 255, 0.10)' : 'rgba(26, 26, 26, 0.10)'
              : isSelected(date)
                ? `${colors.accent}30`
                : 'transparent',
            color: isToday(date)
              ? theme === 'dark' ? '#ffffff' : colors.textPrimary
              : isSelected(date)
                ? theme === 'dark' ? '#ffffff' : colors.textPrimary
                : colors.textPrimary,
            opacity: isCurrentMonth ? 1 : 0.4,
            borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid #FFFFFF',
            borderLeft: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid #FFFFFF',
            borderRight: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid #FFFFFF',
            borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid #FFFFFF',
            borderRadius: isToday(date) ? '4px' : '0',
            margin: isToday(date) ? '0.5px' : '0'
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
              <div className="flex gap-0.5 sm:gap-0.5 md:gap-0.5 lg:gap-0.5 mt-0.5 sm:mt-0.5 md:mt-0.5 lg:mt-0">
                {hasPending && (
                  <div className="w-1.5 h-1.5 sm:w-1.5 sm:h-1.5 md:w-1.5 md:h-1.5 lg:w-1 lg:h-1 rounded-full bg-orange-500" />
                )}
                {hasExpired && (
                  <div className="w-1.5 h-1.5 sm:w-1.5 sm:h-1.5 md:w-1.5 md:h-1.5 lg:w-1 lg:h-1 rounded-full bg-red-500" />
                )}
                {dayDeadlines.some(d => d.status === 'completed') && (
                  <div className="w-1.5 h-1.5 sm:w-1.5 sm:h-1.5 md:w-1.5 md:h-1.5 lg:w-1 lg:h-1 rounded-full bg-green-500" />
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
    <div className="rounded-xl shadow-lg p-2 sm:p-2 md:p-2 lg:p-1.5" style={{ backgroundColor: colors.bgSecondary }}>
      <div className="flex items-center justify-between mb-1.5 sm:mb-1.5 md:mb-1.5 lg:mb-1">
        <h2 className="text-sm sm:text-sm md:text-sm lg:text-sm font-bold flex items-center gap-1 sm:gap-1 md:gap-1 lg:gap-1" style={{ color: colors.textPrimary }}>
          <CalendarIcon className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5 md:w-3 md:h-3 lg:w-3 lg:h-3" style={{ color: colors.accent }} />
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h2>
        <div className="flex gap-1 sm:gap-1 md:gap-0.5 lg:gap-0.5">
          <button
            onClick={handleToday}
            className="px-1.5 sm:px-1.5 md:px-1.5 lg:px-1.5 py-0.5 sm:py-0.5 md:py-0.5 lg:py-0.5 text-xs sm:text-xs md:text-xs lg:text-xs font-medium rounded-md transition-all calendar-today-btn"
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
            className="p-0.5 sm:p-0.5 md:p-0.5 lg:p-0.5 rounded-md transition-all"
            aria-label="Mês anterior"
            style={{ color: colors.textPrimary }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${colors.accent}15`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <ChevronLeft className="w-3.5 h-3.5 sm:w-3 sm:h-3 md:w-3 md:h-3 lg:w-3 lg:h-3" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-0.5 sm:p-0.5 md:p-0.5 lg:p-0.5 rounded-md transition-all"
            aria-label="Próximo mês"
            style={{ color: colors.textPrimary }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${colors.accent}15`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <ChevronRight className="w-3.5 h-3.5 sm:w-3 sm:h-3 md:w-3 md:h-3 lg:w-3 lg:h-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-0.5 sm:mb-0.5 md:mb-0.5 lg:mb-0.5">
        {weekDays.map(day => (
          <div
            key={day}
            className="text-center text-xs sm:text-xs md:text-xs lg:text-xs font-semibold py-0.5 sm:py-0.5 md:py-0.5 lg:py-0.5"
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

      <div className="mt-1.5 sm:mt-1.5 md:mt-1.5 lg:mt-1 pt-1.5 sm:pt-1.5 md:pt-1.5 lg:pt-1" style={{ borderTop: `1px solid ${colors.border}` }}>
        <div className="flex flex-wrap gap-1.5 sm:gap-1.5 md:gap-1.5 lg:gap-1.5 text-xs sm:text-xs md:text-xs lg:text-xs">
          <div className="flex items-center gap-1 sm:gap-1 md:gap-1 lg:gap-1">
            <div className="w-1.5 h-1.5 sm:w-1.5 sm:h-1.5 md:w-1.5 md:h-1.5 lg:w-1.5 lg:h-1.5 rounded-full bg-orange-500" />
            <span style={{ color: colors.textSecondary }}>Pendente</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-1 md:gap-1 lg:gap-1">
            <div className="w-1.5 h-1.5 sm:w-1.5 sm:h-1.5 md:w-1.5 md:h-1.5 lg:w-1.5 lg:h-1.5 rounded-full bg-green-500" />
            <span style={{ color: colors.textSecondary }}>Concluído</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-1 md:gap-1 lg:gap-1">
            <div className="w-1.5 h-1.5 sm:w-1.5 sm:h-1.5 md:w-1.5 md:h-1.5 lg:w-1.5 lg:h-1.5 rounded-full bg-red-500" />
            <span style={{ color: colors.textSecondary }}>Atrasado</span>
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
