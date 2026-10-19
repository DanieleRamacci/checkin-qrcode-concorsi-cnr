import { competitionLabel } from './competition-label';

describe('competitionLabel', () => {
  it('shows the public title or code without exposing an internal UUID', () => {
    const id = '03542abd-451e-43f0-ac96-8debe21a0409';
    expect(competitionLabel('367.222 FA TEST - FUNZIONARIO DI AMMINISTRAZIONE', id)).toBe('367.222 FA TEST - FUNZIONARIO DI AMMINISTRAZIONE');
    expect(competitionLabel('999.999', id)).toBe('Concorso 999.999');
    expect(competitionLabel(id, id)).toBe('Concorso');
    expect(competitionLabel(undefined, id)).toBe('Concorso');
  });
});
