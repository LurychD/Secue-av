/**
 * Secue - Patrón de Adaptador Doble, Offline First y Optimización de Base de Datos
 * SPDX-License-Identifier: AGPL-3.0
 */

import { localDB } from "./dexie";
import { db, storage } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection as firestoreCollection,
  getDocs,
  query,
  where,
  writeBatch
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { Project, Shot, Asset, Daily, Montage, SoundTrack, AuditLog, PendingSyncItem, UserSettings } from "../types";

// Interfaces del Patrón Adaptador
export interface IDatabaseAdapter {
  saveProject(project: Project): Promise<void>;
  getProject(id: string): Promise<Project | null>;
  listProjects(): Promise<Project[]>;
  
  saveShot(shot: Shot): Promise<void>;
  getShot(uuid: string): Promise<Shot | null>;
  listShots(projectId: string): Promise<Shot[]>;
  
  saveAsset(asset: Asset): Promise<void>;
  listAssets(projectId: string): Promise<Asset[]>;
  
  saveDaily(daily: Daily): Promise<void>;
  listDailies(projectId: string): Promise<Daily[]>;
  
  saveMontage(montage: Montage): Promise<void>;
  listMontages(projectId: string): Promise<Montage[]>;
  
  saveSoundTrack(soundtrack: SoundTrack): Promise<void>;
  listSoundTracks(projectId: string): Promise<SoundTrack[]>;
  deleteSoundTrack(id: string): Promise<void>;
  
  saveAuditLog(log: AuditLog): Promise<void>;
  listAuditLogs(projectId: string): Promise<AuditLog[]>;

  saveUserSettings(settings: UserSettings): Promise<void>;
  getUserSettings(uid: string): Promise<UserSettings | null>;
  
  // Sincronización y resolución de conflictos
  syncPendingChanges(): Promise<void>;
  pullRemoteChanges(projectId: string): Promise<{ updated: number; conflicts: string[] }>;
}

export interface IStorageAdapter {
  uploadFile(path: string, file: Blob | File): Promise<string>;
  deleteFile(path: string): Promise<void>;
}

// Estructura de Debounce para escrituras a Firestore (2 segundos de inactividad)
const writeDebounceTimers: Record<string, any> = {};

function debounceRemoteWrite(key: string, fn: () => Promise<void>) {
  if (writeDebounceTimers[key]) {
    clearTimeout(writeDebounceTimers[key]);
  }
  writeDebounceTimers[key] = setTimeout(async () => {
    try {
      await fn();
    } catch (e) {
      console.error("[Debounce Write Error]", e);
    }
    delete writeDebounceTimers[key];
  }, 2000);
}

// RESOLUCIÓN DE CONFLICTOS GRANULAR CAMPO POR CAMPO
export function mergeGranular<T extends Record<string, any>>(local: T, remote: T): T {
  const merged = { ...local } as any;
  const keys = Array.from(new Set([...Object.keys(local), ...Object.keys(remote)]));
  
  for (const k of keys) {
    if (k === "history") {
      // Unir históricos de forma inmutable y ordenada por estampa de tiempo
      const localHist = local[k] || [];
      const remoteHist = remote[k] || [];
      const mergedHist = [...localHist];
      remoteHist.forEach((rh: any) => {
        if (!mergedHist.some((lh: any) => lh.timestamp === rh.timestamp)) {
          mergedHist.push(rh);
        }
      });
      mergedHist.sort((a, b) => a.timestamp - b.timestamp);
      merged[k] = mergedHist as any;
    } else if (k === "updatedAt") {
      merged[k] = Math.max(local[k] || 0, remote[k] || 0);
    } else {
      // Si local y remote difieren, preferimos remote si tiene mayor updatedAt general,
      // pero si el campo fue modificado localmente y no en remote, conservamos el local.
      // Por simplicidad, si los valores difieren, nos quedamos con el valor remoto salvo que el local sea más reciente.
      if (remote[k] !== undefined) {
        if (local[k] !== remote[k]) {
          merged[k] = remote[k];
        }
      }
    }
  }
  return merged as T;
}

// IMPLEMENTACIÓN DUAL FIREBASE / LOCAL STORAGE ADAPTER
export class FirebaseDatabaseAdapter implements IDatabaseAdapter {
  private isFirebaseConfigured(): boolean {
    // Si la API key es de mentira, operamos principalmente offline/local y simulamos llamadas
    return !(import.meta as any).env.VITE_FIREBASE_API_KEY || !(import.meta as any).env.VITE_FIREBASE_API_KEY.includes("FakeKey");
  }

  async saveProject(project: Project): Promise<void> {
    project.updatedAt = Date.now();
    // 1. Guardar en Dexie localmente
    await localDB.projects.put(project);
    
    // 2. Intentar guardar en Firestore con debounce
    if (this.isFirebaseConfigured() && navigator.onLine) {
      debounceRemoteWrite(`project-${project.id}`, async () => {
        await setDoc(doc(db, "projects", project.id), project);
      });
    } else {
      await this.queuePendingSync("projects", project.id, project.id, project);
    }
  }

  async getProject(id: string): Promise<Project | null> {
    const local = await localDB.projects.get(id);
    if (this.isFirebaseConfigured() && navigator.onLine) {
      try {
        const snap = await getDoc(doc(db, "projects", id));
        if (snap.exists()) {
          const remote = snap.data() as Project;
          const merged = local ? mergeGranular(local, remote) : remote;
          await localDB.projects.put(merged);
          return merged;
        }
      } catch (e) {
        console.error("Firebase getProject error:", e);
      }
    }
    return local || null;
  }

  async listProjects(): Promise<Project[]> {
    if (this.isFirebaseConfigured() && navigator.onLine) {
      try {
        const snap = await getDocs(firestoreCollection(db, "projects"));
        const list: Project[] = [];
        for (const d of snap.docs) {
          const remote = d.data() as Project;
          const local = await localDB.projects.get(remote.id);
          const merged = local ? mergeGranular(local, remote) : remote;
          await localDB.projects.put(merged);
          list.push(merged);
        }
        if (list.length > 0) return list;
      } catch (e) {
        console.error("Firebase listProjects error:", e);
      }
    }
    return await localDB.projects.toArray();
  }

  async saveShot(shot: Shot): Promise<void> {
    shot.updatedAt = Date.now();
    await localDB.shots.put(shot);
    
    // Optimización de contadores agregados en el documento raíz del proyecto
    await this.updateProjectCounters(shot.projectId);

    if (this.isFirebaseConfigured() && navigator.onLine) {
      debounceRemoteWrite(`shot-${shot.uuid}`, async () => {
        await setDoc(doc(db, "shots", shot.uuid), shot);
      });
    } else {
      await this.queuePendingSync("shots", shot.uuid, shot.projectId, shot);
    }
  }

  async getShot(uuid: string): Promise<Shot | null> {
    const local = await localDB.shots.get(uuid);
    if (this.isFirebaseConfigured() && navigator.onLine) {
      try {
        const snap = await getDoc(doc(db, "shots", uuid));
        if (snap.exists()) {
          const remote = snap.data() as Shot;
          const merged = local ? mergeGranular(local, remote) : remote;
          await localDB.shots.put(merged);
          return merged;
        }
      } catch (e) {
        console.error("Firebase getShot error:", e);
      }
    }
    return local || null;
  }

  async listShots(projectId: string): Promise<Shot[]> {
    if (this.isFirebaseConfigured() && navigator.onLine) {
      try {
        const q = query(firestoreCollection(db, "shots"), where("projectId", "==", projectId));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          const remote = d.data() as Shot;
          const local = await localDB.shots.get(remote.uuid);
          const merged = local ? mergeGranular(local, remote) : remote;
          await localDB.shots.put(merged);
        }
      } catch (e) {
        console.error("Firebase listShots error:", e);
      }
    }
    return await localDB.shots.where("projectId").equals(projectId).toArray();
  }

  async saveAsset(asset: Asset): Promise<void> {
    asset.updatedAt = Date.now();
    await localDB.assets.put(asset);

    if (this.isFirebaseConfigured() && navigator.onLine) {
      debounceRemoteWrite(`asset-${asset.id}`, async () => {
        await setDoc(doc(db, "assets", asset.id), asset);
      });
    } else {
      await this.queuePendingSync("assets", asset.id, asset.projectId, asset);
    }
  }

  async listAssets(projectId: string): Promise<Asset[]> {
    if (this.isFirebaseConfigured() && navigator.onLine) {
      try {
        const q = query(firestoreCollection(db, "assets"), where("projectId", "==", projectId));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          const remote = d.data() as Asset;
          const local = await localDB.assets.get(remote.id);
          const merged = local ? mergeGranular(local, remote) : remote;
          await localDB.assets.put(merged);
        }
      } catch (e) {
        console.error("Firebase listAssets error:", e);
      }
    }
    return await localDB.assets.where("projectId").equals(projectId).toArray();
  }

  async saveDaily(daily: Daily): Promise<void> {
    await localDB.dailies.put(daily);
    if (this.isFirebaseConfigured() && navigator.onLine) {
      debounceRemoteWrite(`daily-${daily.id}`, async () => {
        await setDoc(doc(db, "dailies", daily.id), daily);
      });
    } else {
      await this.queuePendingSync("dailies", daily.id, daily.projectId, daily);
    }
  }

  async listDailies(projectId: string): Promise<Daily[]> {
    if (this.isFirebaseConfigured() && navigator.onLine) {
      try {
        const q = query(firestoreCollection(db, "dailies"), where("projectId", "==", projectId));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          const remote = d.data() as Daily;
          const local = await localDB.dailies.get(remote.id);
          const merged = local ? mergeGranular(local, remote) : remote;
          await localDB.dailies.put(merged);
        }
      } catch (e) {
        console.error("Firebase listDailies error:", e);
      }
    }
    return await localDB.dailies.where("projectId").equals(projectId).toArray();
  }

  async saveMontage(montage: Montage): Promise<void> {
    montage.updatedAt = Date.now();
    await localDB.montages.put(montage);
    if (this.isFirebaseConfigured() && navigator.onLine) {
      debounceRemoteWrite(`montage-${montage.id}`, async () => {
        await setDoc(doc(db, "montages", montage.id), montage);
      });
    } else {
      await this.queuePendingSync("montages", montage.id, montage.projectId, montage);
    }
  }

  async listMontages(projectId: string): Promise<Montage[]> {
    if (this.isFirebaseConfigured() && navigator.onLine) {
      try {
        const q = query(firestoreCollection(db, "montages"), where("projectId", "==", projectId));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          const remote = d.data() as Montage;
          const local = await localDB.montages.get(remote.id);
          const merged = local ? mergeGranular(local, remote) : remote;
          await localDB.montages.put(merged);
        }
      } catch (e) {
        console.error("Firebase listMontages error:", e);
      }
    }
    return await localDB.montages.where("projectId").equals(projectId).toArray();
  }

  async saveSoundTrack(soundtrack: SoundTrack): Promise<void> {
    soundtrack.updatedAt = Date.now();
    await localDB.soundtracks.put(soundtrack);
    if (this.isFirebaseConfigured() && navigator.onLine) {
      debounceRemoteWrite(`soundtrack-${soundtrack.id}`, async () => {
        await setDoc(doc(db, "soundtracks", soundtrack.id), soundtrack);
      });
    } else {
      await this.queuePendingSync("soundtracks", soundtrack.id, soundtrack.projectId, soundtrack);
    }
  }

  async listSoundTracks(projectId: string): Promise<SoundTrack[]> {
    if (this.isFirebaseConfigured() && navigator.onLine) {
      try {
        const q = query(firestoreCollection(db, "soundtracks"), where("projectId", "==", projectId));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          const remote = d.data() as SoundTrack;
          const local = await localDB.soundtracks.get(remote.id);
          const merged = local ? mergeGranular(local, remote) : remote;
          await localDB.soundtracks.put(merged);
        }
      } catch (e) {
        console.error("Firebase listSoundTracks error:", e);
      }
    }
    return await localDB.soundtracks.where("projectId").equals(projectId).toArray();
  }

  async deleteSoundTrack(id: string): Promise<void> {
    await localDB.soundtracks.delete(id);
    if (this.isFirebaseConfigured() && navigator.onLine) {
      try {
        await deleteDoc(doc(db, "soundtracks", id));
      } catch (e) {
        console.error("Firebase deleteSoundTrack error:", e);
      }
    }
  }

  async saveAuditLog(log: AuditLog): Promise<void> {
    await localDB.audit_logs.put(log);
    if (this.isFirebaseConfigured() && navigator.onLine) {
      debounceRemoteWrite(`audit-${log.id}`, async () => {
        await setDoc(doc(db, "audit_logs", log.id), log);
      });
    }
  }

  async listAuditLogs(projectId: string): Promise<AuditLog[]> {
    if (this.isFirebaseConfigured() && navigator.onLine) {
      try {
        const q = query(firestoreCollection(db, "audit_logs"), where("projectId", "==", projectId));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          const remote = d.data() as AuditLog;
          await localDB.audit_logs.put(remote);
        }
      } catch (e) {
        console.error("Firebase listAuditLogs error:", e);
      }
    }
    return await localDB.audit_logs.where("projectId").equals(projectId).toArray();
  }

  // Cola de cambios pendientes para offline first
  private async queuePendingSync(collection: string, entityId: string, projectId: string, data: any) {
    const item: PendingSyncItem = {
      collection,
      entityId,
      projectId,
      timestamp: Date.now(),
      changes: JSON.stringify(data)
    };
    await localDB.pendingSync.add(item);
  }

  // Vaciar cola de cambios pendientes al recuperar conexión
  async syncPendingChanges(): Promise<void> {
    if (!this.isFirebaseConfigured() || !navigator.onLine) return;
    const pending = await localDB.pendingSync.toArray();
    if (pending.length === 0) return;

    const batch = writeBatch(db);
    for (const item of pending) {
      try {
        const data = JSON.parse(item.changes);
        const refDoc = doc(db, item.collection, item.entityId);
        batch.set(refDoc, data, { merge: true });
        if (item.id !== undefined) {
          await localDB.pendingSync.delete(item.id);
        }
      } catch (e) {
        console.error("Syncing pending item failed:", item, e);
      }
    }
    await batch.commit();
  }

  // Lecturas incrementales basadas en estampa de tiempo
  async pullRemoteChanges(projectId: string): Promise<{ updated: number; conflicts: string[] }> {
    if (!this.isFirebaseConfigured() || !navigator.onLine) return { updated: 0, conflicts: [] };
    
    let updatedCount = 0;
    const conflictsList: string[] = [];
    
    try {
      // 1. Traer shots modificados remotamente
      const q = query(firestoreCollection(db, "shots"), where("projectId", "==", projectId));
      const snap = await getDocs(q);
      
      for (const d of snap.docs) {
        const remote = d.data() as Shot;
        const local = await localDB.shots.get(remote.uuid);
        if (!local || local.updatedAt < remote.updatedAt) {
          const merged = local ? mergeGranular(local, remote) : remote;
          await localDB.shots.put(merged);
          updatedCount++;
          if (local && local.updatedAt > remote.updatedAt) {
            conflictsList.push(`Conflicto de Shot: ${remote.id} resuelto por fusión.`);
          }
        }
      }
    } catch (e) {
      console.error("pullRemoteChanges error:", e);
    }
    return { updated: updatedCount, conflicts: conflictsList };
  }

  // Optimización: actualización atómica de contadores del proyecto local + remote
  private async updateProjectCounters(projectId: string) {
    const shots = await localDB.shots.where("projectId").equals(projectId).toArray();
    const totalShots = shots.length;
    const completedShots = shots.filter(s => s.compositingStatus === "Completado").length;
    const totalDurationFrames = shots.reduce((acc, s) => acc + (s.frameDuration || 0), 0);

    const project = await localDB.projects.get(projectId);
    if (project) {
      project.counters = {
        totalShots,
        completedShots,
        totalDurationFrames
      };
      await localDB.projects.put(project);
      
      if (this.isFirebaseConfigured() && navigator.onLine) {
        debounceRemoteWrite(`project-counters-${projectId}`, async () => {
          await setDoc(doc(db, "projects", projectId), { counters: project.counters }, { merge: true });
        });
      }
    }
  }

  async saveUserSettings(settings: UserSettings): Promise<void> {
    await localDB.usuarios.put(settings);
    if (this.isFirebaseConfigured() && navigator.onLine) {
      debounceRemoteWrite(`user-${settings.uid}`, async () => {
        await setDoc(doc(db, "usuarios", settings.uid), settings);
      });
    } else {
      await this.queuePendingSync("usuarios", settings.uid, "global", settings);
    }
  }

  async getUserSettings(uid: string): Promise<UserSettings | null> {
    const local = await localDB.usuarios.get(uid);
    if (this.isFirebaseConfigured() && navigator.onLine) {
      try {
        const snap = await getDoc(doc(db, "usuarios", uid));
        if (snap.exists()) {
          const remote = snap.data() as UserSettings;
          const merged = local ? { ...local, ...remote } : remote;
          await localDB.usuarios.put(merged);
          return merged;
        }
      } catch (e) {
        console.error("Firebase getUserSettings error:", e);
      }
    }
    return local || null;
  }
}

export class FirebaseStorageAdapter implements IStorageAdapter {
  async uploadFile(path: string, file: Blob | File): Promise<string> {
    // Si la API es de mentira o estamos sin conexión, devolvemos un Object URL local temporario
    if (!(import.meta as any).env.VITE_FIREBASE_API_KEY || (import.meta as any).env.VITE_FIREBASE_API_KEY.includes("FakeKey") || !navigator.onLine) {
      return URL.createObjectURL(file);
    }
    
    try {
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (e) {
      console.warn("Firebase upload falló, usando Object URL local", e);
      return URL.createObjectURL(file);
    }
  }

  async deleteFile(path: string): Promise<void> {
    if (!(import.meta as any).env.VITE_FIREBASE_API_KEY || (import.meta as any).env.VITE_FIREBASE_API_KEY.includes("FakeKey") || !navigator.onLine) {
      return;
    }
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
    } catch (e) {
      console.error("Firebase Storage deleteFile error:", e);
    }
  }
}

export const dbAdapter = new FirebaseDatabaseAdapter();
export const storageAdapter = new FirebaseStorageAdapter();

// SEMBRADO DE DATOS MOCK DE BIENVENIDA (Fase offline, listo para usar al instante)
export async function seedInitialProjectIfNeeded(): Promise<string> {
  const existing = await localDB.projects.toArray();
  if (existing.length > 0) {
    return existing[0].id;
  }

  const mockProjectId = "vuelo-oruga-proj";
  
  const mockProject: Project = {
    id: mockProjectId,
    name: "El Vuelo de la Oruga",
    sinopsis: "Un cortometraje de stop-motion sobre una pequeña oruga con alas de papel que busca comprender el viento en la pradera.",
    year: 2026,
    productionType: "Stop Motion" as any,
    colors: {
      background: "#121214", // Carbón profundo
      panel: "#1e1e24",      // Carbón con leve tono azulado/cálido
      accent: "#f59e0b",     // Ámbar cinemático
      text: "#e4e4e7"
    },
    departments: ["Layout", "Animación", "Iluminación", "Composición", "Sonido"],
    roles: {
      "Director": { name: "Director", color: "#f43f5e", permissions: ["admin", "approve_dailies"] },
      "Artista": { name: "Artista", color: "#3b82f6", permissions: ["read_shots", "write_shots"] }
    },
    members: [
      { id: "dir-1", email: "director@secue.com", name: "Sofía Martínez", role: "Director", permissions: ["admin"], invitedAt: "2026-08-01", status: "active" },
      { id: "art-1", email: "axeldibarra@gmail.com", name: "Axel Ibarra", role: "Artista", permissions: ["write_shots"], invitedAt: "2026-08-02", status: "active" }
    ],
    counters: {
      totalShots: 3,
      completedShots: 1,
      totalDurationFrames: 192
    },
    updatedAt: Date.now()
  };

  await localDB.projects.put(mockProject);

  const mockShots: Shot[] = [
    {
      id: "1.0",
      uuid: "shot-uuid-1",
      projectId: mockProjectId,
      layoutStatus: "Completado" as any,
      animationStatus: "Completado" as any,
      lightingStatus: "Completado" as any,
      compositingStatus: "Completado" as any,
      frameDuration: 48,
      cameraNotes: "Paneo lento de izquierda a derecha. Lente de 35mm. Enfoque selectivo en el ala de papel.",
      resolution: "1920x1080",
      directorNotes: "Excelente ritmo en la animación del ala. Cuidado con los brillos del reflector en el plano 2.",
      assignedArtist: "axeldibarra@gmail.com",
      keyframeUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=300&auto=format&fit=crop",
      subtasks: [
        { id: "st-1", title: "Refinar timming del ala", completed: true },
        { id: "st-2", title: "Ajustar rebotes de luz", completed: true }
      ],
      updatedAt: Date.now(),
      history: [
        { timestamp: Date.now() - 100000, userId: "dir-1", userEmail: "director@secue.com", field: "compositingStatus", oldValue: "En Revisión", newValue: "Completado", comment: "Excelente composición final." }
      ]
    },
    {
      id: "2.0",
      uuid: "shot-uuid-2",
      projectId: mockProjectId,
      layoutStatus: "Completado" as any,
      animationStatus: "En Proceso" as any,
      lightingStatus: "Pendiente" as any,
      compositingStatus: "Pendiente" as any,
      frameDuration: 72,
      cameraNotes: "Plano medio fijo. La oruga intenta saltar desde la rama alta.",
      resolution: "1920x1080",
      directorNotes: "El salto debe sentirse pesado, recordar que la gravedad en stop motion es clave.",
      assignedArtist: "axeldibarra@gmail.com",
      keyframeUrl: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?q=80&w=300&auto=format&fit=crop",
      subtasks: [
        { id: "st-3", title: "Animación de la anticipación del salto", completed: true },
        { id: "st-4", title: "Cuadros de impacto", completed: false }
      ],
      updatedAt: Date.now(),
      history: []
    },
    {
      id: "3.0",
      uuid: "shot-uuid-3",
      projectId: mockProjectId,
      layoutStatus: "En Proceso" as any,
      animationStatus: "Pendiente" as any,
      lightingStatus: "Pendiente" as any,
      compositingStatus: "Pendiente" as any,
      frameDuration: 72,
      cameraNotes: "Cámara subjetiva desde los ojos de la oruga mirando el abismo.",
      resolution: "1920x1080",
      directorNotes: "Añadir desenfoque de movimiento en los bordes de la cámara.",
      assignedArtist: "director@secue.com",
      keyframeUrl: "https://images.unsplash.com/photo-1500627869374-13cd993b1115?q=80&w=300&auto=format&fit=crop",
      subtasks: [],
      updatedAt: Date.now(),
      history: []
    }
  ];

  for (const s of mockShots) {
    await localDB.shots.put(s);
  }

  const mockAssets: Asset[] = [
    {
      id: "asset-1",
      projectId: mockProjectId,
      name: "Oruga Protagonista (Oliver)",
      category: "Personaje" as any,
      approvalStatus: "Rigging" as any,
      keyframeUrl: "https://images.unsplash.com/photo-1560807707-8cc77767d783?q=80&w=300&auto=format&fit=crop",
      googleDriveUrl: "https://drive.google.com/drive/folders/sample-oliver-character",
      assignedArtist: "axeldibarra@gmail.com",
      comments: "Falta ajustar los tensores de las antenas para evitar vibración en stop-motion.",
      updatedAt: Date.now(),
      history: [
        { timestamp: Date.now() - 500000, userId: "art-1", userEmail: "axeldibarra@gmail.com", stage: "Modelado", comment: "Cuerpo terminado con plastilina reforzada." }
      ]
    },
    {
      id: "asset-2",
      projectId: mockProjectId,
      name: "La Gran Rama del Olmo",
      category: "Escenario" as any,
      approvalStatus: "Final Aprobado" as any,
      keyframeUrl: "https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=300&auto=format&fit=crop",
      googleDriveUrl: "https://drive.google.com/drive/folders/sample-branch-env",
      assignedArtist: "director@secue.com",
      comments: "La textura de la corteza absorbe perfectamente la luz del estudio.",
      updatedAt: Date.now(),
      history: []
    }
  ];

  for (const a of mockAssets) {
    await localDB.assets.put(a);
  }

  const mockDailies: Daily[] = [
    {
      id: "daily-1",
      projectId: mockProjectId,
      shotId: "1.0",
      artistName: "Axel Ibarra",
      videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4",
      keyframeUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=300&auto=format&fit=crop",
      mimeType: "video/mp4",
      frameCount: 48,
      supervisorApproval: "Versión A" as any,
      supervisorComment: "La luz de fondo está excelente, mantengamos este nivel.",
      timestamp: Date.now(),
      history: []
    }
  ];

  for (const d of mockDailies) {
    await localDB.dailies.put(d);
  }

  const mockMontage: Montage = {
    id: "montage-1",
    projectId: mockProjectId,
    title: "Corte de Dirección v1.4",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4",
    durationFrames: 192,
    cutsList: [
      { timestamp: 0, timecode: "00:00:00:00", comments: "Inicio con música de flauta baja.", status: "Aprobado" },
      { timestamp: 2, timecode: "00:00:02:00", comments: "Entra plano de la oruga caminando.", status: "Aprobado" }
    ],
    history: [
      { timestamp: Date.now(), userId: "dir-1", userEmail: "director@secue.com", action: "Corte v1.4 cargado", versionUrl: "https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4" }
    ],
    updatedAt: Date.now()
  };

  await localDB.montages.put(mockMontage);

  const mockSoundTrack: SoundTrack = {
    id: "sound-1",
    projectId: mockProjectId,
    name: "Tema Principal: El Vuelo",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    durationSeconds: 120,
    timecodeOffset: 0,
    waveformData: [10, 30, 45, 60, 20, 45, 80, 95, 40, 20, 60, 75, 90, 30, 10, 45, 60, 40],
    validationStatus: "Aprobado",
    history: [
      { timestamp: Date.now(), userId: "dir-1", userEmail: "director@secue.com", action: "Audio final cargado", fileName: "el_vuelo_mix_v4_stereo.mp3" }
    ],
    updatedAt: Date.now()
  };

  await localDB.soundtracks.put(mockSoundTrack);

  return mockProjectId;
}
