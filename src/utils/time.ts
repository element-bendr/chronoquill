export const isoNow = (): string => new Date().toISOString();

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (timezone: string): Intl.DateTimeFormat => {
  const key = `${timezone}-ymd`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    formatterCache.set(key, formatter);
  }
  return formatter;
};

export const localDay = (date: Date, timezone: string): string => {
  return getFormatter(timezone).format(date);
};

export const isPastTimeToday = (now: Date, timezone: string, hhmm: string): boolean => {
  const [hh, mm] = hhmm.split(':').map((v) => Number(v));

  const local = new Date(
    now.toLocaleString('en-US', {
      timeZone: timezone
    })
  );

  if (Number.isNaN(hh) || Number.isNaN(mm)) {
    return false;
  }

  const minutesNow = local.getHours() * 60 + local.getMinutes();
  return minutesNow >= hh * 60 + mm;
};
