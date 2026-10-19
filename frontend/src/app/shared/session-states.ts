export type SessionProfile = 'segretario' | 'sede' | 'esperto';

export interface ProfileAction {
  title: string;
  action?: string;
}

export interface SessionStateInfo {
  label: string;
  phase: 1 | 2 | 3 | 4;
  actions: Partial<Record<SessionProfile, ProfileAction>>;
}

const STATES: Record<string, SessionStateInfo> = {
  iniziale: {
    label: 'Sessione creata', phase: 1,
    actions: { segretario: { title: 'Chi ti aiuta in questa sessione?', action: 'Salva e continua' }, sede: { title: 'In attesa che il segretario prepari la sessione' }, esperto: { title: 'In attesa che il segretario generi e invii le liste' } },
  },
  configurata: {
    label: 'Configurata', phase: 1,
    actions: { segretario: { title: 'Scarica i candidati', action: 'Scarica candidati' }, sede: { title: 'In attesa che il segretario prepari la sessione' }, esperto: { title: 'In attesa che il segretario generi e invii le liste' } },
  },
  candidati_scaricati: {
    label: 'Candidati scaricati', phase: 1,
    actions: { segretario: { title: 'Collega gli smartphone che useranno come scanner', action: 'Avvia check-in' }, sede: { title: 'Collega gli smartphone che useranno come scanner', action: 'Copia link di collegamento' }, esperto: { title: 'In attesa che il segretario generi e invii le liste' } },
  },
  dispositivi_connessi: {
    label: 'Dispositivi collegati', phase: 1,
    actions: { segretario: { title: 'Collega gli smartphone che useranno come scanner', action: 'Avvia check-in' }, sede: { title: 'Collega gli smartphone che useranno come scanner', action: 'Copia link di collegamento' }, esperto: { title: 'In attesa che il segretario generi e invii le liste' } },
  },
  checkin_avviato: {
    label: 'Check-in avviato', phase: 2,
    actions: { segretario: { title: 'Registra le presenze', action: 'Concludi check-in' }, sede: { title: 'Segnala chi non riesce ad accedere' }, esperto: { title: 'In attesa che il segretario generi e invii le liste' } },
  },
  checkin_concluso: {
    label: 'Check-in concluso', phase: 2,
    actions: { segretario: { title: 'Genera le liste dei presenti', action: 'Genera liste' }, sede: { title: 'Segnala chi non riesce ad accedere' }, esperto: { title: 'In attesa che il segretario generi e invii le liste' } },
  },
  liste_generate: {
    label: 'Liste generate', phase: 3,
    actions: { segretario: { title: 'Invia le liste all’esperto remoto', action: 'Invia liste' }, sede: { title: 'Segnala chi non riesce ad accedere' }, esperto: { title: 'Liste generate, in attesa dell’invio' } },
  },
  liste_inviate: {
    label: 'Liste inviate', phase: 3,
    actions: { segretario: { title: 'Hai finito la tua parte' }, sede: { title: 'Segnala chi non riesce ad accedere' }, esperto: { title: 'Carica i presenti su Moodle', action: 'Lista presenti aggiornata' } },
  },
  lista_presenti_aggiornata_su_moodle: {
    label: 'Presenti caricati su Moodle', phase: 4,
    actions: { segretario: { title: 'Hai finito la tua parte' }, sede: { title: 'Segnala chi non riesce ad accedere' }, esperto: { title: 'Prepara l’ambiente d’esame', action: 'Ambiente pronto' } },
  },
  avvia_esame: {
    label: 'Ambiente d’esame pronto', phase: 4,
    actions: { segretario: { title: 'L’esperto remoto ha preparato l’ambiente d’esame' }, sede: { title: 'Segnala chi non riesce ad accedere' }, esperto: { title: 'Avvia la prova', action: 'Inizia esame' } },
  },
  esame_in_corso: {
    label: 'Esame in corso', phase: 4,
    actions: { segretario: { title: 'Prova in corso' }, sede: { title: 'Segnala chi non riesce ad accedere' }, esperto: { title: 'Prova in corso', action: 'Concludi esame' } },
  },
  esame_concluso: {
    label: 'Esame concluso', phase: 4,
    actions: { segretario: { title: 'Esame concluso' }, sede: { title: 'Segnala chi non riesce ad accedere' }, esperto: { title: 'Esame concluso' } },
  },
};

export function sessionStateInfo(state: string): SessionStateInfo {
  return STATES[state] ?? { label: 'Stato non riconosciuto', phase: 1, actions: {} };
}

export function sessionStateLabel(state: string): string {
  return sessionStateInfo(state).label;
}

export function sessionStateAction(state: string, profile: SessionProfile): ProfileAction | undefined {
  return sessionStateInfo(state).actions[profile];
}

export const ROLE_LABELS: Record<string, string> = {
  segretario: 'Segretario', referente: 'Referente', sede: 'Informatico in sede',
  informatico_sede: 'Informatico in sede', esperto: 'Esperto remoto',
  esperto_informatico: 'Esperto remoto', admin: 'Amministratore',
  admin_globale: 'Amministratore', sistema: 'Sistema',
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
