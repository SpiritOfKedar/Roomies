'use client';

import DatePicker from '@/components/ui/DatePicker';
import { DurationPicker } from '@/components/ui/rare/duration-picker';
import type { TimeOfDay } from '@/lib/deadline';

interface Props {
  date: string;
  time: TimeOfDay;
  onDateChange: (date: string) => void;
  onTimeChange: (time: TimeOfDay) => void;
  minDate?: Date;
}

/**
 * Due date + due time. The time uses Rare UI's duration picker as a 24-hour
 * clock (tap the pencil to edit, tick to confirm). Defaults to 23:59 so a
 * date-only deadline means "by the end of that day" in the user's timezone.
 */
export default function DueDateTimeField({ date, time, onDateChange, onTimeChange, minDate }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <DatePicker label="Due date" value={date} onChange={onDateChange} minDate={minDate} placeholder="Pick a day" />
      <div>
        <p className="mb-1.5 text-sm font-semibold text-neutral-800">Due time (24h)</p>
        <DurationPicker
          value={time}
          onChange={onTimeChange}
          onConfirm={onTimeChange}
          maxHours={23}
          maxMinutes={59}
          hoursLabel="h"
          minutesLabel="m"
          className="justify-start"
        />
      </div>
    </div>
  );
}
