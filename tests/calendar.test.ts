import { describe, expect, it } from "vitest";
import { buildWeekdayCalendar } from "../web/calendar.js";

describe("weekday calendar", () => {
  it("aligns the first weekday beneath its Monday-to-Friday column", () => {
    const cells = buildWeekdayCalendar(2026, 9);

    expect(cells.slice(0, 2)).toEqual([null, { date: 1, dateValue: "2026-09-01" }]);
  });

  it("omits Saturdays and Sundays", () => {
    const dates = buildWeekdayCalendar(2026, 9)
      .filter((day) => day !== null)
      .map((day) => day.dateValue);

    expect(dates).not.toContain("2026-09-05");
    expect(dates).not.toContain("2026-09-06");
    expect(dates).toContain("2026-09-07");
  });

  it("starts in the Monday column when a month begins on a weekend", () => {
    const cells = buildWeekdayCalendar(2026, 8);

    expect(cells[0]).toEqual({ date: 3, dateValue: "2026-08-03" });
  });
});
