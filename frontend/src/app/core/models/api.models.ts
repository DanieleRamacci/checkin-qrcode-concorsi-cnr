export interface UserContext {
  authenticated: boolean;
  email: string;
  display_name: string;
  roles: string[];
  capabilities: string[];
  csrf_token: string;
  dev_mode?: boolean;
  app_version?: string;
  app_build_time?: string;
}

export interface BandoSummary {
  commission_id: string;
  title: string;
  configured: boolean;
  referente_email?: string | null;
  esperto_remoto_email?: string | null;
  config_status?: string | null;
  expert_assigned?: boolean;
  required_data_complete?: boolean;
  session_count: number;
  last_sync?: string | null;
  visibility_reason?: 'owner' | 'admin' | 'referente' | string;
  source_role?: string | null;
  access_active?: boolean;
  capabilities: string[];
}

export interface ReferenteBandoSummary extends BandoSummary {
  rdp_names?: string[];
}

export interface BandoPerson {
  name?: string;
  nome?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  emailcertificatoperpuk?: string;
  matricola?: string;
  ruolo?: string;
}

export interface BandoDetail extends BandoSummary {
  rdps: BandoPerson[];
  commissioners: BandoPerson[];
  metadata_fetched_at?: string | null;
}

export interface BandoMetadata {
  success: boolean;
  rdp_count: number;
  commissioner_count: number;
  rdps: BandoPerson[];
  commissioners: BandoPerson[];
}

export interface SessionSummary {
  session_id: string;
  commission_id: string;
  name: string;
  date: string;
  time: string;
  location: string;
  current_state: string;
  candidate_count: number;
  checked_in_count: number;
  device_count: number;
  visibility_reason?: 'owner' | 'admin' | string;
  capabilities: string[];
}

export interface ApiList<T> {
  items: T[];
}

export interface BandiResponse extends ApiList<BandoSummary> {
  sync_error?: string | null;
  sync_source?: string | null;
}

export interface ReferenteBandiResponse extends ApiList<ReferenteBandoSummary> {
  sync_error?: string | null;
  sync_source?: string | null;
}

export interface SessionsResponse extends ApiList<SessionSummary> {
  commission_id: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details: Record<string, string>;
    request_id: string;
  };
}

export interface CandidateSummary {
  uid: string;
  first_name: string;
  last_name: string;
  document_number: string;
  document_expired: boolean;
  checkin_effettuato: boolean;
  reset_password_richiesto: boolean;
  reset_password_effettuato: boolean;
}

export interface WorkflowAction {
  action: string;
  label: string;
  enabled: boolean;
  disabled_reason: string | null;
  target_state: string;
  requires_confirmation: boolean;
}

export interface WorkflowState {
  current_state: string;
  actions: WorkflowAction[];
}

export interface DeviceSummary {
  id: number;
  session_id: string;
  nome_dispositivo?: string | null;
  operator_email?: string | null;
  user_agent?: string | null;
  ip_address?: string | null;
  timestamp?: string | null;
  last_seen?: string | null;
  disconnected_at?: string | null;
  status: 'online' | 'offline' | 'disconnected';
}

export interface ListSummary {
  id: number;
  session_id: string;
  num_presenti: number;
  generato_da: string;
  timestamp_creazione: string;
  downloads: { xlsx: string; moodle_csv: string };
}
