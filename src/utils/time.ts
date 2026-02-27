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

export const localMinutesOfDay = (date: Date, timezone: string): number => {
  const local = new Date(
    date.toLocaleString('en-US', {
      timeZone: timezone
    })
  );

  return local.getHours() * 60 + local.getMinutes();
};

export const localMinuteKey = (date: Date, timezone: string): string => {
  const local = new Date(
    date.toLocaleString('en-US', {
      timeZone: timezone
    })
  );
  return `${localDay(date, timezone)}:${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`;
};

export interface QuietHoursRange {
  start: string;
  end: string;
}

const parseHHMM = (value: string): number | null => {
  const [h, m] = value.split(':').map((v) => Number(v));
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return h * 60 + m;
};

export const isInsideQuietHours = (date: Date, timezone: string, ranges: QuietHoursRange[]): boolean => {
  const now = localMinutesOfDay(date, timezone);

  for (const range of ranges) {
    const start = parseHHMM(range.start);
    const end = parseHHMM(range.end);
    if (start === null || end === null) {
      continue;
    }

    if (start <= end) {
      if (now >= start && now < end) {
        return true;
      }
      continue;
    }

    if (now >= start || now < end) {
      return true;
    }
  }

  return false;
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
