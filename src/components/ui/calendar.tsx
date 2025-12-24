import * as React from "react"
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  isSameMonth,
  isSameDay,
  parseISO,
  addMonths,
  subMonths,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface CalendarProps {
  selected?: Date | string
  onSelect?: (date: Date) => void
  className?: string
}

export function Calendar({ selected, onSelect, className }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(
    selected ? (typeof selected === 'string' ? parseISO(selected) : selected) : new Date()
  )

  const selectedDate = selected ? (typeof selected === 'string' ? parseISO(selected) : selected) : undefined

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const rows = []
  let days: JSX.Element[] = []
  let day = startDate

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      const cloneDay = day
      const isCurrentMonth = isSameMonth(cloneDay, monthStart)
      const isSelected = selectedDate && isSameDay(cloneDay, selectedDate)
      const isToday = isSameDay(cloneDay, new Date())

      days.push(
        <button
          key={cloneDay.toString()}
          type="button"
          onClick={() => onSelect?.(cloneDay)}
          className={cn(
            "h-9 w-9 p-0 font-normal transition-colors rounded-md",
            "border border-gray-200 dark:border-transparent",
            !isCurrentMonth && "text-muted-foreground opacity-50",
            isCurrentMonth && "hover:bg-accent hover:text-accent-foreground",
            isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            isToday && !isSelected && "bg-accent",
          )}
        >
          {format(cloneDay, "d")}
        </button>
      )
      day = addDays(day, 1)
    }
    rows.push(
      <div className="grid grid-cols-7 gap-1" key={day.toString()}>
        {days}
      </div>
    )
    days = []
  }

  return (
    <div className={cn("p-3", className)}>
      <div className="flex items-center justify-between mb-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="font-semibold text-sm capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        <div className="text-center text-xs font-medium text-muted-foreground">Dom</div>
        <div className="text-center text-xs font-medium text-muted-foreground">Seg</div>
        <div className="text-center text-xs font-medium text-muted-foreground">Ter</div>
        <div className="text-center text-xs font-medium text-muted-foreground">Qua</div>
        <div className="text-center text-xs font-medium text-muted-foreground">Qui</div>
        <div className="text-center text-xs font-medium text-muted-foreground">Sex</div>
        <div className="text-center text-xs font-medium text-muted-foreground">Sáb</div>
      </div>

      {rows}
    </div>
  )
}
