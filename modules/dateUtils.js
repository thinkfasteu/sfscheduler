export const pad2 = (n) => String(n).padStart(2, '0');

export const toLocalISOMonth = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;

export const toLocalISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;

export const formatDateDE = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string' || !dateStr.includes('-')) return dateStr;
  const [y,m,d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
};

export const parseShiftTime = (dateStr, timeStr) => {
  const [hours, minutes] = timeStr.split(':');
  const [year, month, day] = dateStr.split('-');
  return new Date(year, month - 1, day, hours, minutes);
};

export const getWeekNumber = (d) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

export const isLastDayOfMonth = (dateStr, year, monthNum) => {
  const date = new Date(dateStr);
  const lastDay = new Date(year, monthNum, 0).getDate();
  return date.getDate() === lastDay;
};

export const isLastDayOfWeek = (dateStr) => {
  const date = new Date(dateStr);
  return date.getDay() === 0;
};
