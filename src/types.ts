/**
 * Secue - Tipos y Definiciones de Datos de Producción
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum ProductionType {
  TWO_D = "2D",
  THREE_D = "3D",
  STOP_MOTION = "Stop Motion",
  CUTOUT = "Cutout",
  MIXTA = "Mixta"
}

export enum ShotProgressStatus {
  PENDING = "Pendiente",
  IN_PROGRESS = "En Proceso",
  REVISION = "En Revisión",
  COMPLETED = "Completado"
}

export enum AssetCategory {
  PERSONAJE = "Personaje",
  ESCENARIO = "Escenario",
  PROP = "Prop"
}

export enum AssetApprovalStatus {
  CONCEPTO = "Concepto",
  MODELADO = "Modelado",
  RIGGING = "Rigging",
  TEXTURIZADO = "Texturizado",
  FINAL_APROBADO = "Final Aprobado"
}

export enum DailyApprovalStatus {
  A = "Versión A",
  B = "Versión B",
  APPROVED = "Aprobado",
  REJECTED = "Rechazado",
  PENDING = "Pendiente"
}

// Estructura de Roles estilo Discord
export interface ProjectRole {
  name: string;
  color: string;
  permissions: string[]; // e.g., 'admin', 'read_shots', 'write_shots', 'approve_dailies'
}

export interface ProjectMember {
  id: string;
  email: string;
  name: string;
  role: string; // Nombre del rol
  permissions: string[];
  invitedAt: string;
  status: "active" | "invited";
}

// Configuración de Colores 60-30-10
export interface DynamicThemeColors {
  background: string; // 60%
  panel: string;      // 30%
  accent: string;     // 10%
  text: string;
}

export interface ProjectCounters {
  totalShots: number;
  completedShots: number;
  totalDurationFrames: number;
}

export interface Project {
  id: string; // projectId
  name: string;
  sinopsis: string;
  year: number;
  productionType: ProductionType;
  colors: DynamicThemeColors;
  customBg?: string; // URL de fondo personalizado
  customIcon?: string; // URL de ícono de proyecto
  departments: string[]; // ej: ["Dirección", "Layout", "Animación", "Iluminación", "Composición", "Sonido"]
  roles: Record<string, ProjectRole>; // Roles estilo Discord
  members: ProjectMember[];
  counters: ProjectCounters;
  updatedAt: number;
}

// Trazabilidad de cambios en Shot
export interface ShotHistoryEntry {
  timestamp: number;
  userId: string;
  userEmail: string;
  field: string;
  oldValue: string;
  newValue: string;
  comment?: string;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Shot {
  id: string; // decimal floating identifier string (e.g., "1.0", "1.5", "2.0")
  uuid: string; // identificador único estable
  projectId: string;
  layoutStatus: ShotProgressStatus;
  animationStatus: ShotProgressStatus;
  lightingStatus: ShotProgressStatus;
  compositingStatus: ShotProgressStatus;
  frameDuration: number;
  cameraNotes: string;
  resolution: string;
  directorNotes: string;
  subtasks: Subtask[];
  assignedArtist: string; // Email o ID del artista
  keyframeUrl?: string; // URL miniatura o fotograma clave
  audioUrl?: string; // Enlace a archivo de sonido WAV/MP3 asociado
  updatedAt: number;
  history: ShotHistoryEntry[];
}

export interface AssetHistoryEntry {
  timestamp: number;
  userId: string;
  userEmail: string;
  stage: AssetApprovalStatus | string;
  comment: string;
}

export interface Asset {
  id: string;
  projectId: string;
  name: string;
  category: AssetCategory;
  approvalStatus: AssetApprovalStatus;
  keyframeUrl?: string;
  googleDriveUrl?: string;
  assignedArtist: string;
  comments: string;
  updatedAt: number;
  history: AssetHistoryEntry[];
}

export interface DailyHistoryEntry {
  timestamp: number;
  userId: string;
  userEmail: string;
  status: DailyApprovalStatus;
  comment: string;
}

export interface Daily {
  id: string;
  projectId: string;
  shotId: string; // ej: "1.0"
  artistName: string;
  videoUrl: string; // archivo de imagen/video dailies
  keyframeUrl?: string;
  mimeType: string;
  frameCount: number;
  supervisorApproval: DailyApprovalStatus;
  supervisorComment: string;
  timestamp: number;
  history: DailyHistoryEntry[];
}

export interface MontageCut {
  timestamp: number;
  timecode: string;
  comments: string;
  status: string;
}

export interface MontageHistoryEntry {
  timestamp: number;
  userId: string;
  userEmail: string;
  action: string;
  versionUrl: string;
}

export interface Montage {
  id: string;
  projectId: string;
  title: string;
  videoUrl: string;
  durationFrames: number;
  cutsList: MontageCut[];
  history: MontageHistoryEntry[];
  updatedAt: number;
}

export interface AudioHistoryEntry {
  timestamp: number;
  userId: string;
  userEmail: string;
  action: string;
  fileName: string;
}

export interface SoundTrack {
  id: string;
  projectId: string;
  name: string;
  audioUrl: string;
  durationSeconds: number;
  timecodeOffset: number; // en fotogramas
  waveformData?: number[]; // Puntos para dibujar la forma de onda
  validationStatus: "Pendiente" | "Aprobado" | "Rechazado";
  history: AudioHistoryEntry[];
  updatedAt: number;
}

export interface AuditLog {
  id: string;
  projectId: string;
  action: string; // ej: "Proyecto Creado", "Rol Cambiado"
  timestamp: number;
  userId: string;
  userEmail: string;
  details: string;
}

export interface UserSettings {
  uid: string;
  email: string;
  displayName: string;
  theme: "light" | "dark";
  totpSecret?: string;
  totpEnabled: boolean;
  notificationsEnabled: boolean;
  activeProjectId?: string;
}

export interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
}

// Cambios pendientes en la tabla IndexedDB de DexieJS para sincronización diferida
export interface PendingSyncItem {
  id?: number;
  collection: string;
  entityId: string;
  projectId: string;
  timestamp: number;
  changes: string; // stringified JSON de los campos modificados
}
