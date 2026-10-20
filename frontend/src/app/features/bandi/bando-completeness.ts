import { BandoSummary } from '../../core/models/api.models';

/** Configurazione completa: dati del bando, esperto remoto e informatico in sede su tutte le sessioni. */
export function isBandoComplete(bando: BandoSummary): boolean {
  const total = Number(bando.session_count || 0);
  const expertsDone = total === 0 ? Boolean(bando.expert_assigned) : Number(bando.remote_expert_assigned_count || 0) >= total;
  const sedeDone = total === 0 ? true : Number(bando.sede_technician_assigned_count || 0) >= total;
  return bando.required_data_complete === true && expertsDone && sedeDone && !(bando.incomplete_session_names ?? []).length;
}
