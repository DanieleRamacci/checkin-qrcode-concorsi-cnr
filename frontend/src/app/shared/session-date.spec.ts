import { isSessionPast, isSessionToday, sessionDayBadge, sessionShortDate, sessionSortKey, sessionWhen } from './session-date';

describe('sessionWhen', () => {
  const today = new Date(2026, 9, 20, 9, 0);
  it('says Oggi for a session of the current day', () => {
    expect(sessionWhen('2026-10-20', '14:17:00', today)).toBe('Oggi alle 14:17');
    expect(sessionWhen('20/10/2026', '14:17', today)).toBe('Oggi alle 14:17');
  });
  it('uses the Italian date format for other days', () => {
    expect(sessionWhen('2025-09-30', '15:52', today)).toBe('30/09/2025 alle 15:52');
    expect(sessionWhen('2025-09-30', '', today)).toBe('30/09/2025');
  });
});

describe('session dates as stored by the backend (gg/mm/aaaa)', () => {
  const today = new Date(2026, 9, 20, 15, 0);
  it('sorts by date, not by day of the month', () => {
    const dates = ['05/11/2026', '20/10/2026', '21/10/2026', '30/09/2026'];
    expect([...dates].sort((a, b) => sessionSortKey(a, '09:00').localeCompare(sessionSortKey(b, '09:00'))))
      .toEqual(['30/09/2026', '20/10/2026', '21/10/2026', '05/11/2026']);
  });
  it('recognises today, tomorrow and past days', () => {
    expect(isSessionToday('20/10/2026', today)).toBe(true);
    expect(isSessionPast('20/10/2026', today)).toBe(false);
    expect(isSessionPast('19/10/2026', today)).toBe(true);
    expect(isSessionPast('05/11/2026', today)).toBe(false);
    expect(sessionDayBadge('21/10/2026', today)).toBe('Domani');
    expect(sessionShortDate('05/11/2026')).toBe('05/11');
  });
});
