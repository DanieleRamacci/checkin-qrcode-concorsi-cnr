/**
 * Date delle sessioni. Il backend restituisce `date` così come è salvata in
 * `sessioni.giorno`, cioè "gg/mm/aaaa" (dal testo di Selezioni Online); alcuni
 * dati e i test usano "aaaa-mm-gg". Ogni confronto, ordinamento o etichetta
 * passa dalla chiave "aaaa-mm-gg" calcolata qui.
 */
export function sessionDateKey(value?: string | null): string {
  const text = (value ?? '').trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const italian = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return italian ? `${italian[3]}-${italian[2].padStart(2, '0')}-${italian[1].padStart(2, '0')}` : '';
}

/** Chiave "aaaa-mm-gg" del giorno locale. */
export function todayKey(today = new Date()): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

/** Ordinamento cronologico; le date non leggibili vanno in fondo. */
export function sessionSortKey(date?: string | null, time?: string | null): string {
  return `${sessionDateKey(date) || '9999-99-99'} ${(time ?? '').slice(0, 5)}`;
}

export function isSessionToday(date?: string | null, today = new Date()): boolean {
  return sessionDateKey(date) === todayKey(today);
}

/** Sessione di un giorno già passato (oggi non è passata). */
export function isSessionPast(date?: string | null, today = new Date()): boolean {
  const key = sessionDateKey(date);
  return !!key && key < todayKey(today);
}

/** "Oggi", "Domani" o vuoto: avviso per le sessioni imminenti. */
export function sessionDayBadge(date?: string | null, today = new Date()): string {
  if (isSessionToday(date, today)) return 'Oggi';
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  return isSessionToday(date, tomorrow) ? 'Domani' : '';
}

/** "30/09/2025"; il testo originale se la data non è leggibile. */
export function sessionDateLabel(date?: string | null): string {
  const key = sessionDateKey(date);
  return key ? `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}` : (date ?? '');
}

/** "30/09". */
export function sessionShortDate(date?: string | null): string {
  return sessionDateLabel(date).slice(0, 5);
}

/** "Oggi alle 14:17" o "30/09/2025 alle 15:52" (testata della sessione nel prototipo). */
export function sessionWhen(date?: string | null, time?: string | null, today = new Date()): string {
  const hour = (time ?? '').slice(0, 5);
  if (!sessionDateKey(date)) return [date, hour].filter(Boolean).join(' alle ');
  const day = isSessionToday(date, today) ? 'Oggi' : sessionDateLabel(date);
  return hour ? `${day} alle ${hour}` : day;
}
