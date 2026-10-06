/**
 * SIIPB — tipe domain.
 * Mengikuti struktur tabel pada dokumen Plan SIIPB (users, roles, employees, items, borrowings, …).
 * Saat integrasi ke Flask API, tipe-tipe ini menjadi kontrak data antara frontend dan backend.
 */

export type ID = number;

export type ItemStatus = 'TERSEDIA' | 'DIPINJAM' | 'RUSAK' | 'RUSAK_BERAT' | 'DALAM_PERBAIKAN' | 'HILANG';
export type Condition = 'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT';
export type BorrowStatus = 'DRAF' | 'DIPINJAM' | 'TERLAMBAT' | 'DIKEMBALIKAN' | 'DIBATALKAN';
export type BorrowDisplay = BorrowStatus | 'JATUH TEMPO';
export type ReturnConditionKey = 'BAIK' | 'RUSAK' | 'DALAM_PERBAIKAN' | 'RUSAK_BERAT' | 'HILANG';
export type NotificationEvent = 'CHECKOUT' | 'H-3' | 'H-1' | 'H' | 'H+1' | 'H+3' | 'H+7' | 'PENGEMBALIAN';
export type NotificationStatus = 'MENUNGGU' | 'TERKIRIM' | 'GAGAL';
export type RecipientKind = 'peminjam' | 'petugas' | 'pimpinan';

export type PermissionKey =
  | 'dashboard.view'
  | 'inventory.view'
  | 'inventory.manage'
  | 'masterdata.manage'
  | 'borrowing.view'
  | 'borrowing.manage'
  | 'return.manage'
  | 'monitoring.view'
  | 'notification.view'
  | 'notification.manage'
  | 'qr.manage'
  | 'report.view'
  | 'report.export'
  | 'audit.view'
  | 'users.manage'
  | 'settings.manage';

export interface Permission {
  key: PermissionKey;
  group: string;
  label: string;
}

export interface Role {
  id: ID;
  code: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
  system: boolean;
}

export type LoginMethod = 'LOKAL' | 'SSO' | 'LOKAL + SSO';

export interface User {
  id: ID;
  name: string;
  username: string;
  email: string;
  /** Mockup saja — di backend kata sandi disimpan sebagai hash dan tidak pernah dikirim ke klien. */
  password: string;
  role_id: ID;
  active: boolean;
  login_method: LoginMethod;
  phone: string;
  last_login: string | null;
  created_at: string;
}

export interface OAuthAccount {
  id: ID;
  user_id: ID;
  provider: string;
  subject: string;
  email: string;
  linked_at: string;
}

export interface Unit {
  id: ID;
  name: string;
  active: boolean;
}

export interface Category {
  id: ID;
  code: string;
  name: string;
  active: boolean;
}

export interface Location {
  id: ID;
  code: string;
  name: string;
  building: string;
  active: boolean;
}

export interface Employee {
  id: ID;
  nip: string;
  name: string;
  unit_id: ID;
  email: string;
  phone: string;
  position: string;
  active: boolean;
}

export interface Item {
  id: ID;
  item_code: string;
  item_name: string;
  category_id: ID;
  brand: string;
  model: string;
  serial_number: string;
  acquisition_year: number | '';
  acquisition_source: string;
  acquisition_value: number | '';
  location_id: ID;
  condition_status: Condition;
  item_status: ItemStatus;
  /** Foto barang (tabel item_photos). Indeks 0 = foto utama. */
  photos: string[];
  notes: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type MovementType = 'DICATAT' | 'PINDAH_LOKASI' | 'UBAH_STATUS' | 'DIAKTIFKAN' | 'DINONAKTIFKAN' | 'DIPINJAM' | 'DIKEMBALIKAN';

export interface ItemMovement {
  id: ID;
  item_id: ID;
  type: MovementType;
  from_status: ItemStatus | null;
  to_status: ItemStatus | null;
  note: string;
  user_id: ID;
  at: string;
  ref?: ID | null;
}

export interface Borrowing {
  id: ID;
  code: string;
  employee_id: ID;
  borrow_date: string;
  due_date: string;
  purpose: string;
  notes: string;
  status: BorrowStatus;
  created_by: ID;
  created_at: string;
  checked_out_at: string | null;
  checked_out_by: ID | null;
  returned_at: string | null;
  cancel_reason?: string;
}

export interface BorrowingDetail {
  id: ID;
  borrowing_id: ID;
  item_id: ID;
  item_condition_out: Condition;
}

export interface Return {
  id: ID;
  code: string;
  borrowing_id: ID;
  return_date: string;
  received_by: ID;
  notes: string;
  late_days: number;
  created_at: string;
}

export interface ReturnDetail {
  id: ID;
  return_id: ID;
  item_id: ID;
  condition_after: ReturnConditionKey;
  complete: boolean;
  missing_note: string;
  damage_note: string;
}

export interface Recipient {
  type: 'Peminjam' | 'Petugas' | 'Pimpinan';
  name: string;
  email: string;
  user_id?: ID;
}

export interface Notification {
  id: ID;
  borrowing_id: ID;
  event: NotificationEvent;
  template: string;
  subject: string;
  body: string;
  recipients: Recipient[];
  status: NotificationStatus;
  attempts: number;
  created_at: string;
  sent_at: string | null;
  read_by: ID[];
  trigger: 'scheduler' | 'transaksi' | string;
}

export interface NotificationLog {
  id: ID;
  notification_id: ID;
  borrowing_id: ID;
  event: NotificationEvent;
  recipient: string;
  recipient_type: Recipient['type'];
  status: 'TERKIRIM' | 'GAGAL';
  attempt: number;
  message: string;
  at: string;
}

export type AuditValue = Record<string, unknown> | null;

export interface ActivityLog {
  id: ID;
  at: string;
  user_id: ID;
  action: string;
  entity: string;
  entity_id: ID | null;
  old_value: AuditValue;
  new_value: AuditValue;
  ip: string;
}

export interface EmailTemplate {
  id: ID;
  code: string;
  name: string;
  subject: string;
  body: string;
  updated_at: string;
}

export interface SchedulerDetail {
  code: string;
  action: string;
}

export interface SchedulerRun {
  id: ID;
  at: string;
  today: string;
  trigger: string;
  checked: number;
  late_marked: number;
  sent: number;
  skipped: number;
  failed: number;
  details: SchedulerDetail[];
}

export type ReportType = 'inventaris' | 'peminjaman' | 'pengembalian' | 'keterlambatan' | 'kerusakan';

export interface ReportFilters {
  type: ReportType;
  from: string;
  to: string;
  unit_id: string;
  category_id: string;
  location_id: string;
  status: string;
}

export interface ReportGenerated {
  id: ID;
  type: ReportType;
  format: string;
  rows: number;
  filters: ReportFilters;
  user_id: ID;
  at: string;
}

export interface NotificationRule {
  event: Exclude<NotificationEvent, 'CHECKOUT' | 'PENGEMBALIAN'>;
  days: number;
  active: boolean;
  to: RecipientKind[];
  template: string;
  desc: string;
}

export interface BackupEntry {
  at: string;
  type: string;
  size_kb: number;
  status: 'SUKSES' | 'GAGAL';
  by: string;
}

export interface ParameterDef {
  label: string;
  desc: string;
}

/** Parameter status & kondisi (master data). Kode tetap karena terikat aturan bisnis; label & keterangan dapat diubah. */
export interface Parameters {
  item_status: Record<ItemStatus, ParameterDef>;
  condition: Record<Condition, ParameterDef>;
}

export interface Settings {
  parameters: Parameters;
  institution: string;
  unit_sarpras: string;
  staff_email: string;
  staff_phone: string;
  return_location: string;
  smtp: {
    host: string;
    port: number;
    username: string;
    encryption: string;
    from_name: string;
    from_email: string;
    simulate_failure: boolean;
  };
  scheduler: { enabled: boolean; time: string; timezone: string; last_run_date: string | null };
  checkout_notify: boolean;
  return_notify: boolean;
  rules: NotificationRule[];
  security: {
    jwt_access_minutes: number;
    jwt_refresh_days: number;
    session_hours: number;
    oidc_enabled: boolean;
    oidc_issuer: string;
    oidc_client_id: string;
    upload_max_mb: number;
    upload_types: string;
  };
  backup: { schedule: string; retention_days: number; history: BackupEntry[]; last_restore_test: string };
  demo_offset_days: number;
}

/** Seluruh tabel. Kunci = nama tabel. */
export interface Tables {
  users: User[];
  roles: Role[];
  oauth_accounts: OAuthAccount[];
  units: Unit[];
  employees: Employee[];
  categories: Category[];
  locations: Location[];
  items: Item[];
  item_movements: ItemMovement[];
  borrowings: Borrowing[];
  borrowing_details: BorrowingDetail[];
  returns: Return[];
  return_details: ReturnDetail[];
  notifications: Notification[];
  notification_logs: NotificationLog[];
  activity_logs: ActivityLog[];
  email_templates: EmailTemplate[];
  scheduler_runs: SchedulerRun[];
  reports_generated: ReportGenerated[];
}

export type TableName = keyof Tables;
export type Row<T extends TableName> = Tables[T][number];

export interface DbData extends Tables {
  version: number;
  created_at: string;
  _seq: Partial<Record<TableName, number>>;
  settings: Settings;
}

export interface Session {
  user_id: ID;
  token: string;
  exp: string;
  method: string;
  started: string;
}

/** Hasil operasi layanan. */
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
export type FieldErrors = Record<string, string>;
export type FormResult<T = object> = ({ ok: true } & T) | { ok: false; errors: FieldErrors };
