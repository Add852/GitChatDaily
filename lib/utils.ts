export function formatDate(date: Date | string): string {
  const parsedDate =
    typeof date === "string"
      ? new Date(date.length === 10 ? `${date}T00:00:00` : date)
      : new Date(date);

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getDaysInYear(year: number): Date[] {
  const days: Date[] = [];
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  
  return days;
}

export function getWeekday(date: Date): number {
  return date.getDay();
}

