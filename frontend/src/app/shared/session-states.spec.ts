import { describe, expect, it } from 'vitest';
import { ROLE_LABELS, roleLabel, sessionStateAction, sessionStateInfo } from './session-states';

describe('session states', () => {
  const codes = ['iniziale', 'configurata', 'candidati_scaricati', 'dispositivi_connessi', 'checkin_avviato', 'checkin_concluso', 'liste_generate', 'liste_inviate', 'lista_presenti_aggiornata_su_moodle', 'avvia_esame', 'esame_in_corso', 'esame_concluso'];
  it('maps the twelve states across four phases with readable labels', () => {
    const infos = codes.map(sessionStateInfo);
    expect(new Set(infos.map((state) => state.phase))).toEqual(new Set([1, 2, 3, 4]));
    expect(infos.every((state, index) => state.label !== codes[index])).toBe(true);
  });
  it('has no more than one primary action for each profile and state', () => {
    for (const code of codes) {
      const state = sessionStateInfo(code);
      for (const profile of ['segretario', 'sede', 'esperto'] as const) {
        expect(state.actions[profile]?.action ? 1 : 0).toBeLessThanOrEqual(1);
      }
    }
  });
  it('uses a safe fallback for unknown states and translates role codes', () => {
    expect(sessionStateInfo('nuovo_stato').label).toBe('Stato non riconosciuto');
    expect(sessionStateInfo('nuovo_stato').actions).toEqual({});
    expect(roleLabel('esperto_informatico')).toBe('Esperto remoto');
    expect(roleLabel('admin_globale')).toBe('Amministratore');
    expect(Object.keys(ROLE_LABELS)).toContain('referente');
  });
});
