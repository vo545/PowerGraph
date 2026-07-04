export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function dateOffsetKey(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}
