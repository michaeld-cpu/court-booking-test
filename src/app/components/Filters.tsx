import React from 'react'
import { Calendar, MapPin } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Calendar as CalendarComponent } from './ui/calendar'
import { format } from 'date-fns'

interface FiltersProps {
  selectedDate: Date
  onDateChange: (date: Date | undefined) => void
  selectedCity: string
  onCityChange: (city: string) => void
  cities: string[]
}

export function Filters({
  selectedDate,
  onDateChange,
  selectedCity,
  onCityChange,
  cities,
}: FiltersProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2 h-11 px-4 text-base">
            <Calendar className="size-5" />
            {format(selectedDate, 'MMM dd, yyyy')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            mode="single"
            selected={selectedDate}
            onSelect={onDateChange}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <Select value={selectedCity} onValueChange={onCityChange}>
        <SelectTrigger className="w-[180px] !h-11 !min-h-[44px] !max-h-[44px] text-base !border-border bg-background hover:bg-accent hover:text-accent-foreground !text-black">
          <MapPin className="size-5 mr-2" />
          <SelectValue placeholder="Select city" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="All Locations">All Locations</SelectItem>
          {cities.map((city) => (
            <SelectItem key={city} value={city}>
              {city}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
