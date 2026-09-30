const MONDAY = 1;
const FRIDAY = 5;

export const buildWeekdayCalendar = (year, month) => {
  const lastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = [];
  let started = false;

  for (let date = 1; date <= lastDate; date += 1) {
    const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
    if (weekday < MONDAY || weekday > FRIDAY) continue;

    if (!started) {
      for (let column = MONDAY; column < weekday; column += 1) cells.push(null);
      started = true;
    }

    cells.push({
      date,
      dateValue: `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`
    });
  }

  return cells;
};
