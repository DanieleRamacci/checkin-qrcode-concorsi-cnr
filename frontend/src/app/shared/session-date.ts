/** "Oggi alle 14:17" o "30/09/2025 alle 15:52" (testata della sessione nel prototipo). */
export function sessionWhen(date?: string | null, time?: string | null, today = new Date()): string {
  const hour = (time ?? '').slice(0, 5);
  const iso = (date ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!iso) return [date, hour].filter(Boolean).join(' alle ');
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const day = `${iso[1]}-${iso[2]}-${iso[3]}` === todayIso ? 'Oggi' : `${iso[3]}/${iso[2]}/${iso[1]}`;
  return hour ? `${day} alle ${hour}` : day;
}
