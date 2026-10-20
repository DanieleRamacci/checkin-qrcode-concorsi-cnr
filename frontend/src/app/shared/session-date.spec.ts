import { sessionWhen } from './session-date';

describe('sessionWhen', () => {
  const today = new Date(2026, 9, 20, 9, 0);
  it('says Oggi for a session of the current day', () => {
    expect(sessionWhen('2026-10-20', '14:17:00', today)).toBe('Oggi alle 14:17');
  });
  it('uses the Italian date format for other days', () => {
    expect(sessionWhen('2025-09-30', '15:52', today)).toBe('30/09/2025 alle 15:52');
    expect(sessionWhen('2025-09-30', '', today)).toBe('30/09/2025');
  });
});
