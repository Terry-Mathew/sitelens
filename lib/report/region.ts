export type Region = 'UK' | 'US';

// Use UTC so the date does not change with the time zone of the reader.
export function formatDate(iso: string, region: Region): string {
  return new Intl.DateTimeFormat(region === 'UK' ? 'en-GB' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

export function pageSize(region: Region): 'A4' | 'LETTER' {
  return region === 'UK' ? 'A4' : 'LETTER';
}
