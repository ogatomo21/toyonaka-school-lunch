export interface WeekdayCalendarDay {
  date: number;
  dateValue: string;
}

export function buildWeekdayCalendar(year: number, month: number): Array<WeekdayCalendarDay | null>;
