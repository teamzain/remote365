// Google Calendar "event template" deep link — the standard no-OAuth way to
// schedule: it opens a prefilled event editor in the user's own Google account
// with the meeting link in the description/location, and they pick the time
// and guests there. The `dates` param is required by the endpoint, so default
// to the next full hour, one hour long (UTC stamps; Google converts to the
// calendar's timezone).
const toGoogleUtcStamp = (date: Date) =>
  [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
    'T',
    String(date.getUTCHours()).padStart(2, '0'),
    String(date.getUTCMinutes()).padStart(2, '0'),
    String(date.getUTCSeconds()).padStart(2, '0'),
    'Z',
  ].join('');

const nextFullHour = () => {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  return start;
};

export const buildGoogleCalendarEventUrl = ({
  title,
  meetingLink,
  meetingCode,
  validUntil,
  start,
  durationMinutes = 60,
}: {
  title: string;
  meetingLink: string;
  meetingCode: string;
  /** When the meeting link stops working. Spelled out in the event so nobody
   *  schedules the call for a date the link will not survive to. */
  validUntil?: string | Date | null;
  start?: Date;
  durationMinutes?: number;
}) => {
  const startsAt = start || nextFullHour();
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
  const validUntilDate = validUntil ? new Date(validUntil) : null;
  const validityLine = validUntilDate && !Number.isNaN(validUntilDate.getTime())
    ? `\nThis link stays active until ${validUntilDate.toLocaleDateString([], { month: 'long', day: 'numeric' })}. Schedule the meeting before then.`
    : '';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${toGoogleUtcStamp(startsAt)}/${toGoogleUtcStamp(endsAt)}`,
    details: `Join the Remote365 meeting: ${meetingLink}\nMeeting code: ${meetingCode}${validityLine}`,
    location: meetingLink,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};
