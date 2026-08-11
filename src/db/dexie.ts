/**
 * Secue - Configuración de Base de Datos Local IndexedDB con DexieJS
 * SPDX-License-Identifier: AGPL-3.0
 */

import Dexie, { Table } from "dexie";
import {
  Project,
  Shot,
  Asset,
  Daily,
  Montage,
  SoundTrack,
  AuditLog,
  PendingSyncItem,
  ProductionType,
  ShotProgressStatus,
  AssetCategory,
  AssetApprovalStatus,
  DailyApprovalStatus,
  UserSettings
} from "../types";

export class SecueLocalDB extends Dexie {
  pendingSync!: Table<PendingSyncItem, number>;
  projects!: Table<Project, string>;
  shots!: Table<Shot, string>;
  assets!: Table<Asset, string>;
  dailies!: Table<Daily, string>;
  montages!: Table<Montage, string>;
  soundtracks!: Table<SoundTrack, string>;
  audit_logs!: Table<AuditLog, string>;
  usuarios!: Table<UserSettings, string>;

  constructor() {
    super("SecueLocalDB");

    this.version(1).stores({
      pendingSync: "++id, collection, entityId, projectId, timestamp",
      projects: "id, name, updatedAt",
      shots: "uuid, id, projectId, updatedAt",
      assets: "id, projectId, updatedAt",
      dailies: "id, projectId, shotId, timestamp",
      montages: "id, projectId, updatedAt",
      soundtracks: "id, projectId, updatedAt",
      audit_logs: "id, projectId, timestamp",
      usuarios: "uid, email"
    });
  }
}

export const localDB = new SecueLocalDB();

export async function seedMockData() {
  const projCount = await localDB.projects.count();
  if (projCount > 0) return; // Ya hay datos sembrados

  const projectId = "corto-1";

  // 1. Proyecto
  const mockProject: Project = {
    id: projectId,
    name: "Oliver y el Bosque Mágico",
    sinopsis: "Oliver, un pequeño zorro de madera tallada, se aventura en el denso bosque otoñal buscando la legendaria última hoja dorada antes de la llegada del invierno.",
    year: 2026,
    productionType: ProductionType.STOP_MOTION,
    colors: {
      background: "#121214",
      panel: "#1e1e24",
      accent: "#f59e0b",
      text: "#e4e4e7"
    },
    departments: ["Dirección", "Layout", "Animación", "Iluminación", "Composición", "Sonido"],
    roles: {
      "Director": { name: "Director", color: "#ef4444", permissions: ["admin", "approve_dailies"] },
      "Artista": { name: "Artista", color: "#3b82f6", permissions: ["read_shots", "write_shots"] }
    },
    members: [
      {
        id: "mem-1",
        name: "Axel Ibarra",
        email: "axeldibarra@gmail.com",
        role: "Director",
        permissions: ["admin", "approve_dailies"],
        invitedAt: "2026-08-01",
        status: "active"
      },
      {
        id: "mem-2",
        name: "Oliver",
        email: "oliver@studio.com",
        role: "Artista",
        permissions: ["read_shots", "write_shots"],
        invitedAt: "2026-08-02",
        status: "active"
      }
    ],
    counters: {
      totalShots: 3,
      completedShots: 1,
      totalDurationFrames: 156
    },
    updatedAt: Date.now()
  };

  await localDB.projects.put(mockProject);

  // 2. Shots
  const mockShots: Shot[] = [
    {
      uuid: "shot-1",
      id: "1.0",
      projectId,
      frameDuration: 72,
      layoutStatus: ShotProgressStatus.COMPLETED,
      animationStatus: ShotProgressStatus.IN_PROGRESS,
      lightingStatus: ShotProgressStatus.PENDING,
      compositingStatus: ShotProgressStatus.PENDING,
      assignedArtist: "Axel Ibarra",
      cameraNotes: "Lente de 35mm a ras de piso para acentuar el tamaño de los árboles en el bosque otoñal.",
      resolution: "1920x1080",
      directorNotes: "Revisar velocidad del viento",
      subtasks: [],
      keyframeUrl: "https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=450&auto=format&fit=crop",
      history: [
        {
          timestamp: Date.now() - 3600000,
          userId: "mem-1",
          userEmail: "axeldibarra@gmail.com",
          field: "layoutStatus",
          oldValue: "Pendiente",
          newValue: "Completado"
        }
      ],
      updatedAt: Date.now()
    },
    {
      uuid: "shot-2",
      id: "2.0",
      projectId,
      frameDuration: 48,
      layoutStatus: ShotProgressStatus.COMPLETED,
      animationStatus: ShotProgressStatus.COMPLETED,
      lightingStatus: ShotProgressStatus.COMPLETED,
      compositingStatus: ShotProgressStatus.COMPLETED,
      assignedArtist: "Oliver",
      cameraNotes: "Paneo horizontal siguiendo a Oliver corriendo asustado entre la maleza.",
      resolution: "1920x1080",
      directorNotes: "Excelente iluminación",
      subtasks: [],
      keyframeUrl: "https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?q=80&w=450&auto=format&fit=crop",
      history: [],
      updatedAt: Date.now() - 500000
    },
    {
      uuid: "shot-3",
      id: "1.5",
      projectId,
      frameDuration: 36,
      layoutStatus: ShotProgressStatus.IN_PROGRESS,
      animationStatus: ShotProgressStatus.PENDING,
      lightingStatus: ShotProgressStatus.PENDING,
      compositingStatus: ShotProgressStatus.PENDING,
      assignedArtist: "Axel Ibarra",
      cameraNotes: "Plano de detalle insertado para capturar la mirada asombrada del zorro al ver la hoja dorada flotando.",
      resolution: "1920x1080",
      directorNotes: "Agregar más hojas flotando",
      subtasks: [],
      keyframeUrl: "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?q=80&w=450&auto=format&fit=crop",
      history: [],
      updatedAt: Date.now()
    }
  ];

  for (const s of mockShots) {
    await localDB.shots.put(s);
  }

  // 3. Assets
  const mockAssets: Asset[] = [
    {
      id: "asset-oliver-rig",
      name: "Armadura de Oliver Zorro (Rig)",
      projectId,
      category: AssetCategory.PERSONAJE,
      approvalStatus: AssetApprovalStatus.RIGGING,
      assignedArtist: "oliver@studio.com",
      comments: "Silicona terminada",
      keyframeUrl: "https://images.unsplash.com/photo-1589254065878-42c9da997008?q=80&w=350&auto=format&fit=crop",
      history: [
        {
          timestamp: Date.now(),
          userId: "mem-1",
          userEmail: "axeldibarra@gmail.com",
          stage: AssetApprovalStatus.RIGGING,
          comment: "La elasticidad de la silicona de las patas traseras se siente orgánica."
        }
      ],
      updatedAt: Date.now()
    },
    {
      id: "asset-forest-set",
      name: "El Claro del Bosque (Set)",
      projectId,
      category: AssetCategory.ESCENARIO,
      approvalStatus: AssetApprovalStatus.MODELADO,
      assignedArtist: "axeldibarra@gmail.com",
      comments: "Faltan los árboles traseros",
      keyframeUrl: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?q=80&w=350&auto=format&fit=crop",
      history: [],
      updatedAt: Date.now()
    },
    {
      id: "asset-golden-leaf",
      name: "La Hoja de Oro (Prop)",
      projectId,
      category: AssetCategory.PROP,
      approvalStatus: AssetApprovalStatus.FINAL_APROBADO,
      assignedArtist: "oliver@studio.com",
      comments: "Hojas terminadas",
      keyframeUrl: "https://images.unsplash.com/photo-1509114397022-ed747cca3f65?q=80&w=350&auto=format&fit=crop",
      history: [],
      updatedAt: Date.now()
    }
  ];

  for (const a of mockAssets) {
    await localDB.assets.put(a);
  }

  // 4. Dailies
  const mockDaily: Daily = {
    id: "daily-1",
    projectId,
    shotId: "1.0",
    artistName: "Axel Ibarra",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4",
    keyframeUrl: "https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=450&auto=format&fit=crop",
    mimeType: "video/mp4",
    frameCount: 72,
    supervisorApproval: DailyApprovalStatus.APPROVED,
    supervisorComment: "Buen ritmo y rebote. Las orejas reaccionan de forma natural al viento del claro.",
    timestamp: Date.now() - 100000,
    history: [
      {
        timestamp: Date.now() - 100000,
        userId: "mem-1",
        userEmail: "axeldibarra@gmail.com",
        status: DailyApprovalStatus.APPROVED,
        comment: "Buen ritmo y rebote. Las orejas reaccionan de forma natural al viento del claro."
      }
    ]
  };

  await localDB.dailies.put(mockDaily);

  // 5. Montage
  const mockMontage: Montage = {
    id: "montage-1",
    projectId,
    title: "Corte de Montaje v1.2 - Director's Cut",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4",
    durationFrames: 156,
    cutsList: [
      {
        timestamp: 48,
        timecode: "00:00:02:00",
        comments: "Transición muy veloz hacia el plano insertado 1.5. Extender dos fotogramas más.",
        status: "Pendiente"
      }
    ],
    history: [],
    updatedAt: Date.now()
  };

  await localDB.montages.put(mockMontage);

  // 6. Soundtracks
  const mockSoundTrack: SoundTrack = {
    id: "track-1",
    projectId,
    name: "Tema Principal - El Clamor de las Hojas",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    durationSeconds: 372,
    waveformData: [12, 18, 35, 42, 60, 85, 95, 70, 52, 40, 28, 33, 45, 68, 80, 50, 30, 15],
    timecodeOffset: 12,
    validationStatus: "Aprobado",
    history: [
      {
        timestamp: Date.now(),
        userId: "mem-1",
        userEmail: "axeldibarra@gmail.com",
        action: "Pista cargada y offset establecido a 12 frames",
        fileName: "Tema Principal - El Clamor de las Hojas"
      }
    ],
    updatedAt: Date.now()
  };

  await localDB.soundtracks.put(mockSoundTrack);

  // 7. Audit Log
  const mockLogs: AuditLog[] = [
    {
      id: "log-1",
      projectId,
      action: "Proyecto Creado",
      timestamp: Date.now() - 86400000 * 2,
      userId: "mem-1",
      userEmail: "axeldibarra@gmail.com",
      details: "Proyecto de stop-motion 'Oliver y el Bosque Mágico' inicializado con aislamiento multi-tenant."
    },
    {
      id: "log-2",
      projectId,
      action: "Esquema de Plano Insertado",
      timestamp: Date.now() - 3600000,
      userId: "mem-1",
      userEmail: "axeldibarra@gmail.com",
      details: "Insertada la escena intermedia con ID float 1.5 en el shotlist de animación."
    }
  ];

  for (const l of mockLogs) {
    await localDB.audit_logs.put(l);
  }

  const userCount = await localDB.usuarios.count();
  if (userCount === 0) {
    const defaultUserSettings: UserSettings = {
      uid: "default-user",
      email: "axeldibarra@gmail.com",
      displayName: "Axel Ibarra",
      theme: "dark",
      totpEnabled: false,
      notificationsEnabled: true
    };
    await localDB.usuarios.put(defaultUserSettings);
  }
}

