export interface AppSettings {
  institution_name: string;
  app_title: string;
  tagline: string;
  footer_owner: string;
}

export interface UserContext {
  authenticated: boolean;
  email: string;
  display_name: string;
  roles: string[];
  profiles?: Array<'segretario' | 'referente' | 'sede' | 'esperto' | 'admin'>;
  capabilities: string[];
  csrf_token: string;
  dev_mode?: boolean;
  app_version?: string;
  app_build_time?: string;
  app_settings?: AppSettings;
}

export interface BandoSummary {
  commission_id: string;
  title: string;
  configured: boolean;
  referente_email?: string | null;
  esperto_remoto_email?: string | null;
  config_status?: string | null;
  expert_assigned?: boolean;
  remote_expert_assigned_count?: number;
  sede_technician_assigned_count?: number;
  incomplete_session_names?: string[];
  required_data_complete?: boolean;
  session_count: number;
  next_session?: {
    session_id: string;
    name: string;
    date: string;
    time: string;
    location: string;
    state: string;
  } | null;
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
  bando_title?: string | null;
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
  checkin_at?: string | null;
  checkin_source?: 'scanner' | 'tabella' | null;
  reset_password_richiesto: boolean;
  reset_password_richiesto_at?: string | null;
  reset_password_effettuato: boolean;
  reset_password_effettuato_at?: string | null;
  note?: string;
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
  history?: Array<{ state: string; at: string; actor_role: string }>;
}

export interface ScannerSessionSummary {
  session_id: string;
  name: string;
  current_state: string;
  checked_in_count: number;
  candidate_count: number;
}

export interface ScannerCandidateSearchResult {
  uid: string;
  first_name: string;
  last_name: string;
  document_number: string;
  checkin_effettuato: boolean;
}

export interface ScannerVerification extends ScannerCandidateSearchResult {
  document_expired: boolean;
  checkin_at: string | null;
  checkin_source: 'scanner' | 'tabella' | null;
}

export interface AssignedSessionSummary extends SessionSummary {
  open_reset_count: number;
}

export interface AssignedSessionsResponse extends ApiList<AssignedSessionSummary> {
  mode: 'sede' | 'expert';
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
  status?: string;
  message?: string;
  email_status?: 'sent' | 'failed' | null;
  email_error?: string | null;
}

export interface ListSendResult {
  sent: boolean;
  already_sent?: boolean;
  state_updated?: boolean;
  status?: string;
  message?: string;
  warning?: string | null;
  email_status?: 'sent' | 'failed' | null;
  recipients: string[];
}
