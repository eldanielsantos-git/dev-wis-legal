import * as React from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface TimePickerProps {
  value?: string
  onChange?: (time: string) => void
  className?: string
  required?: boolean
}

export function TimePicker({ value, onChange, className, required }: TimePickerProps) {
  const [hour, setHour] = React.useState<string>("12")
  const [minute, setMinute] = React.useState<string>("00")

  React.useEffect(() => {
    if (value) {
      const [h, m] = value.split(":")
      if (h && m) {
        setHour(h)
        setMinute(m)
      }
    }
  }, [value])

  const handleTimeChange = (newHour: string, newMinute: string) => {
    const timeString = `${newHour}:${newMinute}`
    onChange?.(timeString)
  }

  const formatDisplayTime = () => {
    if (value) {
      return value
    }
    return null
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <Clock className="mr-2 h-4 w-4" />
          {formatDisplayTime() || <span>Selecione um horário</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="space-y-3">
          <div className="font-medium text-sm">Selecionar Horário</div>
          <div className="flex items-center gap-2">
            <Select
              value={hour}
              onValueChange={(h) => {
                setHour(h)
                handleTimeChange(h, minute)
              }}
            >
              <SelectTrigger className="w-[80px]">
                <SelectValue placeholder="HH" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => {
                  const h = i.toString().padStart(2, "0")
                  return (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            <span className="text-lg font-medium">:</span>

            <Select
              value={minute}
              onValueChange={(m) => {
                setMinute(m)
                handleTimeChange(hour, m)
              }}
            >
              <SelectTrigger className="w-[80px]">
                <SelectValue placeholder="MM" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 60 }, (_, i) => {
                  const m = i.toString().padStart(2, "0")
                  return (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
