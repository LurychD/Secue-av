/**
 * Secue - Control de Renders Dailies y Checklist con Aprobación A/B
 * SPDX-License-Identifier: AGPL-3.0
 */

import React, { useState, useEffect } from "react";
import { localDB } from "../db/dexie";
import { dbAdapter } from "../db/adapters";
import { Daily, DailyApprovalStatus, AuditLog, DailyHistoryEntry } from "../types";
import { ClipboardCheck, Sparkles, Check, X, Play, Clock, MessageSquare, History, User } from "lucide-react";

interface DailiesViewProps {
  projectId: string;
}

export const DailiesView: React.FC<DailiesViewProps> = ({ projectId }) => {
  const [dailies, setDailies] = useState<Daily[]>([]);
  const [selectedDaily, setSelectedDaily] = useState<Daily | null>(null);
  const [approvalComment, setApprovalComment] = useState("");
  
  // Agregar un daily de prueba
  const [showAddModal, setShowAddModal] = useState(false);
  const [newShotId, setNewShotId] = useState("");
  const [newArtistName, setNewArtistName] = useState("");
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [newFrameCount, setNewFrameCount] = useState(48);

  const loadDailies = async () => {
    const list = await dbAdapter.listDailies(projectId);
    setDailies(list);
    
    if (selectedDaily) {
      const updated = list.find(d => d.id === selectedDaily.id);
      if (updated) setSelectedDaily(updated);
    }
  };

  useEffect(() => {
    loadDailies();
  }, [projectId]);

  const handleCreateDaily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShotId || !newArtistName) return;

    const id = `daily-${Date.now()}`;
    const newDaily: Daily = {
      id,
      projectId,
      shotId: newShotId,
      artistName: newArtistName,
      videoUrl: newVideoUrl || "https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4",
      keyframeUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=300&auto=format&fit=crop",
      mimeType: "video/mp4",
      frameCount: Number(newFrameCount),
      supervisorApproval: DailyApprovalStatus.PENDING,
      supervisorComment: "",
      timestamp: Date.now(),
      history: []
    };

    await dbAdapter.saveDaily(newDaily);
    
    // Log Auditoría
    const audit: AuditLog = {
      id: `audit-${Date.now()}`,
      projectId,
      action: "Render Cargado",
      timestamp: Date.now(),
      userId: "user-1",
      userEmail: "axeldibarra@gmail.com",
      details: `Daily render cargado para Plano ${newShotId} por ${newArtistName}.`
    };
    await dbAdapter.saveAuditLog(audit);

    setShowAddModal(false);
    setNewShotId("");
    setNewArtistName("");
    setNewVideoUrl("");
    await loadDailies();
  };

  const handleDecision = async (status: DailyApprovalStatus) => {
    if (!selectedDaily) return;

    const histEntry: DailyHistoryEntry = {
      timestamp: Date.now(),
      userId: "user-1",
      userEmail: "axeldibarra@gmail.com",
      status,
      comment: approvalComment.trim() || "Actualización de estado en daily."
    };

    const updated: Daily = {
      ...selectedDaily,
      supervisorApproval: status,
      supervisorComment: approvalComment.trim() || selectedDaily.supervisorComment,
      history: [...selectedDaily.history, histEntry]
    };

    await dbAdapter.saveDaily(updated);

    // Si es aprobado, podemos actualizar la miniatura del shot de forma opcional
    if (status === DailyApprovalStatus.APPROVED) {
      const shots = await localDB.shots.where("projectId").equals(projectId).toArray();
      const targetShot = shots.find(s => s.id === selectedDaily.shotId);
      if (targetShot) {
        targetShot.compositingStatus = "Completado" as any; // Auto avanzar
        targetShot.keyframeUrl = selectedDaily.keyframeUrl;
        await dbAdapter.saveShot(targetShot);
      }
    }

    // Log Auditoría
    const audit: AuditLog = {
      id: `audit-${Date.now()}`,
      projectId,
      action: `Daily ${status}`,
      timestamp: Date.now(),
      userId: "user-1",
      userEmail: "axeldibarra@gmail.com",
      details: `El supervisor evaluó Plano ${selectedDaily.shotId} como ${status}. Comentario: ${approvalComment}`
    };
    await dbAdapter.saveAuditLog(audit);

    setApprovalComment("");
    await loadDailies();
  };

  const getDecisionBadge = (status: DailyApprovalStatus) => {
    switch (status) {
      case DailyApprovalStatus.APPROVED: return "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40";
      case DailyApprovalStatus.REJECTED: return "bg-rose-950/40 text-rose-400 border border-rose-900/40";
      case DailyApprovalStatus.PENDING: return "bg-zinc-800 text-zinc-400 border border-zinc-700";
      case DailyApprovalStatus.A: return "bg-amber-950/40 text-amber-400 border border-amber-900/40";
      case DailyApprovalStatus.B: return "bg-indigo-950/40 text-indigo-400 border border-indigo-900/40";
      default: return "bg-zinc-850";
    }
  };

  return (
    <div className="flex h-full font-mono text-zinc-200 overflow-hidden" id="dailies-view-container">
      {/* Listado principal */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-indigo-500" />
              Revisión de Renders Dailies (Supervisor)
            </h3>
            <span className="text-[10px] text-zinc-500">Controles de versión A / B y aprobaciones inmutables de tomas</span>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-3 py-1.5 rounded text-xs transition-colors cursor-pointer"
            id="upload-render-btn"
          >
            <Play className="w-3 h-3" />
            <span>Subir Render</span>
          </button>
        </div>

        {/* Grilla de Dailies */}
        <div className="flex-1 overflow-y-auto" id="dailies-grid">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {dailies.map((daily) => (
              <div
                key={daily.id}
                onClick={() => setSelectedDaily(daily)}
                className={`rounded-xl border bg-zinc-900 overflow-hidden transition-all duration-250 cursor-pointer group flex flex-col justify-between ${
                  selectedDaily?.id === daily.id
                    ? "border-indigo-500 shadow-md ring-1 ring-indigo-500/20"
                    : "border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-850/50"
                }`}
              >
                {/* Portada */}
                <div className="relative aspect-video w-full bg-zinc-950">
                  {daily.keyframeUrl ? (
                    <img
                      src={daily.keyframeUrl}
                      alt={`Daily ${daily.shotId}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700">
                      Sin Preview
                    </div>
                  )}
                  
                  <span className="absolute top-2 left-2 text-[10px] bg-zinc-950/80 text-amber-400 font-bold px-2 py-0.5 rounded border border-zinc-800">
                    Plano {daily.shotId}
                  </span>

                  <span className="absolute bottom-2 right-2 text-[9px] bg-zinc-950/80 text-zinc-400 px-2 py-0.5 rounded">
                    {daily.frameCount} frms
                  </span>
                </div>

                {/* Metadata */}
                <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Artista: {daily.artistName}</span>
                    <span className="text-[10px] text-zinc-400 block mt-1 font-sans truncate">
                      {daily.supervisorComment || "Pendiente de comentarios del director"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-800/60 pt-2.5">
                    <span className="text-[10px] text-zinc-500">
                      {new Date(daily.timestamp).toLocaleDateString()}
                    </span>
                    <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded uppercase ${getDecisionBadge(daily.supervisorApproval)}`}>
                      {daily.supervisorApproval}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {dailies.length === 0 && (
              <div className="col-span-full py-12 text-center text-zinc-600 border border-zinc-800/80 rounded-xl bg-zinc-900/10">
                <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <span className="text-sm font-bold block">No hay renders cargados para dailies</span>
                <span className="text-[10px] mt-1 block">Presiona "Subir Render" para enviar un daily de animación para revisión</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inspector de Aprobación */}
      {selectedDaily && (
        <div className="w-[360px] border-l border-zinc-800 bg-zinc-900/95 flex flex-col h-full overflow-hidden shrink-0" id="daily-decision-panel">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
            <div>
              <span className="text-[10px] text-zinc-500 block font-bold">Mesa de Evaluación</span>
              <h4 className="text-sm font-bold text-indigo-400">Plano {selectedDaily.shotId} &bull; v1</h4>
            </div>
            <button
              onClick={() => setSelectedDaily(null)}
              className="text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
            >
              Cerrar
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* Reproductor de Video */}
            <div className="space-y-1">
              <span className="text-zinc-500 uppercase font-bold text-[10px] block">Archivo de Render</span>
              <div className="aspect-video w-full rounded-lg bg-black border border-zinc-800 overflow-hidden relative group">
                <video
                  src={selectedDaily.videoUrl}
                  controls
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Datos Técnicos */}
            <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/80 space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-500">Artista:</span>
                <span className="font-bold text-zinc-300">{selectedDaily.artistName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">MIME Type:</span>
                <span className="font-bold text-zinc-400">{selectedDaily.mimeType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Cuadros:</span>
                <span className="font-bold text-zinc-300">{selectedDaily.frameCount} frames</span>
              </div>
            </div>

            {/* Historial supervisor */}
            <div className="space-y-2 border-t border-zinc-800/80 pt-4">
              <span className="text-zinc-400 uppercase font-bold text-[10px] block">Comentarios del Supervisor</span>
              <textarea
                placeholder="Escribe comentarios técnicos de corrección (ej: Ajustar velocidad, corregir máscara)..."
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-850 rounded p-2 h-20 text-xs text-zinc-200 outline-none resize-none font-sans"
              />
              
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={() => handleDecision(DailyApprovalStatus.APPROVED)}
                  className="flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold p-2.5 rounded text-xs transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Aprobar Plano</span>
                </button>
                <button
                  onClick={() => handleDecision(DailyApprovalStatus.REJECTED)}
                  className="flex items-center justify-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-zinc-950 font-bold p-2.5 rounded text-xs transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Rechazar</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={() => handleDecision(DailyApprovalStatus.A)}
                  className="bg-amber-950/40 text-amber-400 hover:bg-amber-950/70 border border-amber-900/40 p-2 rounded text-xs transition-all cursor-pointer font-bold"
                >
                  Marcar Versión A
                </button>
                <button
                  onClick={() => handleDecision(DailyApprovalStatus.B)}
                  className="bg-indigo-950/40 text-indigo-400 hover:bg-indigo-950/70 border border-indigo-900/40 p-2 rounded text-xs transition-all cursor-pointer font-bold"
                >
                  Marcar Versión B
                </button>
              </div>
            </div>

            {/* Trazabilidad Histórica de Aprobaciones */}
            <div className="border-t border-zinc-800/80 pt-4 space-y-3">
              <span className="text-zinc-400 uppercase font-bold text-[10px] flex items-center gap-1">
                <History className="w-3.5 h-3.5 text-zinc-500" />
                Historial de Evaluaciones
              </span>

              <div className="space-y-3 relative border-l border-zinc-800 pl-3.5 ml-2">
                {selectedDaily.history.map((hist, idx) => (
                  <div key={idx} className="relative space-y-1">
                    <div className="absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border border-zinc-900" />
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span className="flex items-center gap-1">
                        <User className="w-2.5 h-2.5" /> {hist.userEmail}
                      </span>
                      <span>{new Date(hist.timestamp).toLocaleDateString()}</span>
                    </div>
                    <span className="font-bold text-zinc-300 block">
                      Resultado: <span className="text-amber-400">{hist.status}</span>
                    </span>
                    <p className="text-[10px] bg-zinc-950/40 p-1.5 rounded border border-zinc-800/60 text-zinc-400 font-sans mt-1">
                      {hist.comment}
                    </p>
                  </div>
                ))}

                {selectedDaily.history.length === 0 && (
                  <span className="text-zinc-600 text-xs italic block py-2">
                    Sin revisiones anteriores.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Subir Render */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form
            onSubmit={handleCreateDaily}
            className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4 shadow-2xl"
          >
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <h4 className="text-sm font-bold text-indigo-400">Subir Render de Trabajo (Daily)</h4>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
              >
                Cancelar
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-[10px] text-zinc-500 block uppercase font-bold mb-1">ID del Plano Asociado</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 1.0, 2.0, 1.5"
                  value={newShotId}
                  onChange={(e) => setNewShotId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200 outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 block uppercase font-bold mb-1">Nombre del Artista</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Axel Ibarra"
                  value={newArtistName}
                  onChange={(e) => setNewArtistName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200 outline-none font-sans"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 block uppercase font-bold mb-1">Enlace de Video Render (Mixkit/Drive/Directo)</label>
                <input
                  type="url"
                  placeholder="https://assets.mixkit.co/..."
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-200 outline-none font-sans"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 block uppercase font-bold mb-1">Cantidad de Fotogramas del Render</label>
                <input
                  type="number"
                  required
                  value={newFrameCount}
                  onChange={(e) => setNewFrameCount(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-200 outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded text-zinc-400 bg-zinc-800 hover:bg-zinc-750 transition-colors text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded text-white bg-indigo-500 hover:bg-indigo-600 transition-colors text-xs font-bold cursor-pointer"
              >
                Cargar Daily
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
