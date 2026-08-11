/**
 * Secue - Módulo de Sonido y Música con Sincronización por Forma de Onda
 * SPDX-License-Identifier: AGPL-3.0
 */

import React, { useState, useEffect, useRef } from "react";
import { localDB } from "../db/dexie";
import { dbAdapter } from "../db/adapters";
import { SoundTrack, AuditLog, AudioHistoryEntry } from "../types";
import { Music, Play, Pause, Volume2, History, AlertCircle, RefreshCw, CheckCircle, ShieldCheck, User, Plus, Trash2, X } from "lucide-react";

interface SonidoViewProps {
  projectId: string;
}

export const SonidoView: React.FC<SonidoViewProps> = ({ projectId }) => {
  const [tracks, setTracks] = useState<SoundTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<SoundTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState<"details" | "history">("details");
  const [offsetFrames, setOffsetFrames] = useState(0);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTrackName, setNewTrackName] = useState("");
  const [newTrackUrl, setNewTrackUrl] = useState("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3");
  const [newTrackDuration, setNewTrackDuration] = useState(30);

  const handleAddTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrackName.trim() || !newTrackUrl.trim()) return;

    // Generar forma de onda simulada
    const wave: number[] = Array.from({ length: 40 }, () => Math.floor(Math.random() * 80) + 10);

    const newTrack: SoundTrack = {
      id: `track-${Date.now()}`,
      projectId,
      name: newTrackName.trim(),
      audioUrl: newTrackUrl.trim(),
      durationSeconds: Number(newTrackDuration),
      timecodeOffset: 0,
      waveformData: wave,
      validationStatus: "Pendiente",
      history: [
        {
          timestamp: Date.now(),
          userId: "local-user",
          userEmail: "axeldibarra@gmail.com",
          action: "Pista de audio importada en la biblioteca de sonido",
          fileName: newTrackName.trim()
        }
      ],
      updatedAt: Date.now()
    };

    await dbAdapter.saveSoundTrack(newTrack);
    await loadTracks();
    setSelectedTrack(newTrack);
    setOffsetFrames(0);
    
    // Resetear form
    setNewTrackName("");
    setNewTrackUrl("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3");
    setNewTrackDuration(30);
    setShowAddModal(false);

    // Auditoría
    const audit: AuditLog = {
      id: `audit-${Date.now()}`,
      projectId,
      action: "Pista de Sonido Importada",
      timestamp: Date.now(),
      userId: "local-user",
      userEmail: "axeldibarra@gmail.com",
      details: `Importada nueva pista de sonido '${newTrack.name}' (${newTrackDuration}s) para sincronización.`
    };
    await dbAdapter.saveAuditLog(audit);
  };

  const handleDeleteTrack = async (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("¿Seguro que deseas eliminar esta pista de audio?")) return;

    await dbAdapter.deleteSoundTrack(trackId);
    const updatedList = await dbAdapter.listSoundTracks(projectId);
    setTracks(updatedList);
    
    if (selectedTrack?.id === trackId) {
      if (updatedList.length > 0) {
        setSelectedTrack(updatedList[0]);
        setOffsetFrames(updatedList[0].timecodeOffset);
      } else {
        setSelectedTrack(null);
        setOffsetFrames(0);
      }
    }

    // Auditoría
    const audit: AuditLog = {
      id: `audit-${Date.now()}`,
      projectId,
      action: "Pista de Sonido Eliminada",
      timestamp: Date.now(),
      userId: "local-user",
      userEmail: "axeldibarra@gmail.com",
      details: `Eliminada pista de sonido '${trackId}' de la biblioteca de Secue.`
    };
    await dbAdapter.saveAuditLog(audit);
  };

  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const loadTracks = async () => {
    const list = await dbAdapter.listSoundTracks(projectId);
    setTracks(list);
    if (list.length > 0 && !selectedTrack) {
      setSelectedTrack(list[0]);
      setOffsetFrames(list[0].timecodeOffset);
    } else if (selectedTrack) {
      const updated = list.find(t => t.id === selectedTrack.id);
      if (updated) {
        setSelectedTrack(updated);
        setOffsetFrames(updated.timecodeOffset);
      }
    }
  };

  useEffect(() => {
    loadTracks();
  }, [projectId]);

  // Manejar reproducción de audio e hilado de tiempo
  useEffect(() => {
    if (!audioRef.current) return;
    const updateTime = () => {
      setCurrentTime(audioRef.current?.currentTime || 0);
    };

    const handleEnded = () => setIsPlaying(false);

    audioRef.current.addEventListener("timeupdate", updateTime);
    audioRef.current.addEventListener("ended", handleEnded);

    return () => {
      audioRef.current?.removeEventListener("timeupdate", updateTime);
      audioRef.current?.removeEventListener("ended", handleEnded);
    };
  }, [selectedTrack]);

  // DIBUJAR FORMA DE ONDA EN CANVAS
  useEffect(() => {
    if (!canvasRef.current || !selectedTrack) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const data = selectedTrack.waveformData || [10, 20, 30, 40, 50, 40, 30, 20, 10, 20, 40, 60, 80, 60, 40, 20, 10];
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Gradiente sofisticado
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#38bdf8"); // Sky primario
    grad.addColorStop(1, "#0369a1"); // Sky oscuro
    
    const barWidth = width / data.length;
    const maxVal = Math.max(...data);

    // Dibujar ondas reflejadas simétricas
    data.forEach((val, idx) => {
      const barHeight = (val / maxVal) * (height / 1.5);
      const x = idx * barWidth;
      const y = (height - barHeight) / 2;

      ctx.fillStyle = grad;
      ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
    });

    // Dibujar aguja de reproducción
    if (audioRef.current && audioRef.current.duration) {
      const progress = currentTime / audioRef.current.duration;
      ctx.fillStyle = "#f59e0b"; // Ámbar de acento
      ctx.fillRect(progress * width - 1, 0, 2, height);
    }
  }, [selectedTrack, currentTime]);

  const handlePlayToggle = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true));
    }
  };

  const handleOffsetUpdate = async () => {
    if (!selectedTrack) return;

    const histEntry: AudioHistoryEntry = {
      timestamp: Date.now(),
      userId: "user-1",
      userEmail: "axeldibarra@gmail.com",
      action: `Ajuste de Desfase a ${offsetFrames} frames`,
      fileName: selectedTrack.name
    };

    const updated: SoundTrack = {
      ...selectedTrack,
      timecodeOffset: offsetFrames,
      history: [...selectedTrack.history, histEntry],
      updatedAt: Date.now()
    };

    await dbAdapter.saveSoundTrack(updated);
    await loadTracks();

    // Log Auditoría
    const audit: AuditLog = {
      id: `audit-${Date.now()}`,
      projectId,
      action: "Ajuste de Desfase de Audio",
      timestamp: Date.now(),
      userId: "user-1",
      userEmail: "axeldibarra@gmail.com",
      details: `Modificado el offset de sincronización del audio '${selectedTrack.name}' a ${offsetFrames} fotogramas.`
    };
    await dbAdapter.saveAuditLog(audit);
    alert("Desfase de audio sincronizado correctamente con el timecode del pipeline.");
  };

  const handleValidateSound = async (status: "Aprobado" | "Rechazado") => {
    if (!selectedTrack) return;

    const histEntry: AudioHistoryEntry = {
      timestamp: Date.now(),
      userId: "user-1",
      userEmail: "axeldibarra@gmail.com",
      action: `Cambio de validación a ${status}`,
      fileName: selectedTrack.name
    };

    const updated: SoundTrack = {
      ...selectedTrack,
      validationStatus: status,
      history: [...selectedTrack.history, histEntry],
      updatedAt: Date.now()
    };

    await dbAdapter.saveSoundTrack(updated);
    await loadTracks();

    // Log Auditoría
    const audit: AuditLog = {
      id: `audit-${Date.now()}`,
      projectId,
      action: `Audio ${status}`,
      timestamp: Date.now(),
      userId: "user-1",
      userEmail: "axeldibarra@gmail.com",
      details: `Pista de audio '${selectedTrack.name}' fue marcada como ${status} por dirección.`
    };
    await dbAdapter.saveAuditLog(audit);
  };

  return (
    <div className="flex h-full font-mono text-zinc-200 overflow-hidden" id="sonido-view-container">
      {/* Columna Izquierda - Selector de Pistas */}
      <div className="w-[240px] border-r border-zinc-800 bg-zinc-900/40 flex flex-col h-full overflow-hidden shrink-0" id="sonido-tracks-sidebar">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Banda Sonora
          </span>
          <button
            onClick={() => setShowAddModal(true)}
            className="p-1 rounded bg-sky-500 hover:bg-sky-600 text-zinc-950 font-bold cursor-pointer transition-colors"
            title="Agregar nueva pista de audio"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {tracks.map((track) => {
            const isSelected = selectedTrack?.id === track.id;
            return (
              <div
                key={track.id}
                onClick={() => {
                  setSelectedTrack(track);
                  setOffsetFrames(track.timecodeOffset);
                  setIsPlaying(false);
                }}
                className={`p-3 rounded-lg border text-left cursor-pointer transition-all relative group ${
                  isSelected
                    ? "bg-sky-950/40 border-sky-500 text-sky-400 font-bold"
                    : "bg-zinc-950/40 border-zinc-850 hover:bg-zinc-900 text-zinc-300 hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <Music className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="text-xs font-bold uppercase truncate">{track.name}</span>
                  </div>
                  
                  {/* Botón de eliminar pista */}
                  <button
                    onClick={(e) => handleDeleteTrack(track.id, e)}
                    className="p-0.5 rounded text-zinc-500 hover:text-rose-400 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Eliminar pista"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono">
                  <span>{track.durationSeconds.toFixed(1)}s</span>
                  <span className={`px-1.5 rounded-sm text-[8px] font-bold ${
                    track.validationStatus === "Aprobado"
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-900/30"
                      : "bg-zinc-900 text-zinc-400"
                  }`}>
                    {track.validationStatus}
                  </span>
                </div>
              </div>
            );
          })}

          {tracks.length === 0 && (
            <span className="text-zinc-600 text-xs italic block text-center py-8">
              No hay pistas de sonido.
            </span>
          )}
        </div>
      </div>

      {/* Contenido principal - Forma de Onda */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden space-y-4">
        <div className="flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Music className="w-4 h-4 text-sky-400" />
              Sincronización de Audio y Música
            </h3>
            <span className="text-[10px] text-zinc-500">Asegura que el departamento de animación y sonido trabajen con el mismo timecode exacto</span>
          </div>

          <span className="text-xs text-sky-400 bg-sky-950/20 border border-sky-900/30 px-3 py-1.5 rounded-lg font-bold">
            Sincro Marco a Marco Activo
          </span>
        </div>

        {/* Forma de Onda Visualizer Card */}
        {selectedTrack ? (
          <div className="flex-1 bg-zinc-900 border border-zinc-800/80 rounded-xl p-5 flex flex-col justify-between space-y-4" id="soundtrack-wave-card">
            {/* Cabecera Pista */}
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <div>
                <h4 className="text-sm font-bold text-zinc-100">{selectedTrack.name}</h4>
                <span className="text-[10px] text-zinc-500 font-sans">Audio cargado: 128kbps stereo MP3/WAV</span>
              </div>
              <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded uppercase ${
                selectedTrack.validationStatus === "Aprobado"
                  ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40"
                  : "bg-zinc-800 text-zinc-400"
              }`}>
                {selectedTrack.validationStatus}
              </span>
            </div>

            {/* Elemento de Audio Oculto */}
            <audio ref={audioRef} src={selectedTrack.audioUrl} />

            {/* Forma de Onda Canvas */}
            <div className="flex-1 bg-zinc-950 rounded-lg border border-zinc-900 relative p-2">
              <canvas
                ref={canvasRef}
                width={700}
                height={160}
                className="w-full h-full object-fill opacity-90"
              />
            </div>

            {/* Controles de Reproducción de Audio */}
            <div className="flex items-center justify-between bg-zinc-950/40 p-4 rounded-lg border border-zinc-800/50">
              <button
                onClick={handlePlayToggle}
                className="p-3 rounded-full bg-sky-500 hover:bg-sky-600 text-zinc-950 font-bold cursor-pointer transition-transform transform active:scale-95"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-zinc-950" />}
              </button>

              {/* Tiempos */}
              <div className="flex gap-4">
                <div className="text-left">
                  <span className="text-[9px] text-zinc-500 block">TIEMPO TRANSCURRIDO</span>
                  <span className="text-sm font-bold text-sky-400">
                    {currentTime.toFixed(2)}s
                  </span>
                </div>
                <div className="text-right border-l border-zinc-800 pl-4">
                  <span className="text-[9px] text-zinc-500 block">DURACIÓN TOTAL</span>
                  <span className="text-sm font-bold text-zinc-400">
                    {audioRef.current?.duration ? audioRef.current.duration.toFixed(2) : selectedTrack.durationSeconds.toFixed(2)}s
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-zinc-500" />
                <span className="text-[10px] text-zinc-500 uppercase font-bold">100% Volumen</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 border border-zinc-800/80 rounded-xl bg-zinc-900/10">
            <Music className="w-12 h-12 mb-3 opacity-35 text-zinc-500" />
            <span className="text-sm font-bold">No hay pistas de sonido cargadas</span>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 bg-sky-500 hover:bg-sky-600 text-zinc-950 font-bold px-4 py-2 rounded text-xs cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Importar Primera Pista</span>
            </button>
          </div>
        )}
      </div>

      {/* Panel lateral - Parámetros de Sincronización */}
      {selectedTrack && (
        <div className="w-[320px] border-l border-zinc-800 bg-zinc-900/95 flex flex-col h-full overflow-hidden shrink-0" id="sound-details-panel">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block font-bold">Sincro de Audio</span>
              <h4 className="text-sm font-bold text-sky-400">Timecode Offset</h4>
            </div>
          </div>

          <div className="flex border-b border-zinc-800 text-xs bg-zinc-950/40">
            <button
              onClick={() => setActiveTab("details")}
              className={`flex-1 py-2 text-center border-b font-medium cursor-pointer ${
                activeTab === "details" ? "border-sky-500 text-sky-400 font-bold" : "border-transparent text-zinc-400"
              }`}
            >
              Parámetros
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 py-2 text-center border-b font-medium cursor-pointer ${
                activeTab === "history" ? "border-sky-500 text-sky-400 font-bold" : "border-transparent text-zinc-400"
              }`}
            >
              Auditoría ({selectedTrack.history.length})
            </button>
          </div>

          {/* Contenido */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {activeTab === "details" ? (
              <>
                {/* Desfase de Timecode */}
                <div className="space-y-3 p-3.5 rounded-lg bg-zinc-950/50 border border-zinc-800/80 text-left">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">Desfase en Fotogramas (Offset)</span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={offsetFrames}
                      onChange={(e) => setOffsetFrames(Number(e.target.value))}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-zinc-200 outline-none font-mono"
                    />
                    <button
                      onClick={handleOffsetUpdate}
                      className="bg-sky-500 hover:bg-sky-600 text-zinc-950 font-bold px-3 py-1.5 rounded text-xs cursor-pointer"
                    >
                      Aplicar Offset
                    </button>
                  </div>
                  <p className="text-[9px] text-zinc-500 font-sans leading-relaxed mt-1 text-left">
                    Este valor desplaza el inicio de la pista en el timeline del cortometraje para coincidir exactamente con los layouts.
                  </p>
                </div>

                {/* Validar por dirección */}
                <div className="space-y-2 pt-2 text-left">
                  <span className="text-zinc-400 uppercase font-bold text-[10px] block">Aprobación Final de Dirección</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleValidateSound("Aprobado")}
                      className="flex-1 bg-emerald-950/20 hover:bg-emerald-950/50 text-emerald-400 border border-emerald-900/40 p-2 rounded text-xs transition-colors font-bold cursor-pointer"
                    >
                      Aprobar Pista
                    </button>
                    <button
                      onClick={() => handleValidateSound("Rechazado")}
                      className="flex-1 bg-rose-950/20 hover:bg-rose-950/50 text-rose-400 border border-rose-900/40 p-2 rounded text-xs transition-colors font-bold cursor-pointer"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              </>
            ) : (
              // Auditoría de Audio
              <div className="space-y-4 text-left">
                <div className="flex items-center gap-1.5 text-zinc-400 font-bold uppercase text-[10px]">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Trazabilidad de la Banda Sonora</span>
                </div>

                <div className="space-y-3.5 relative border-l border-zinc-800 pl-3.5 ml-2">
                  {selectedTrack.history.map((hist, idx) => (
                    <div key={idx} className="relative space-y-1">
                      <div className="absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full bg-sky-500 border border-zinc-900" />
                      <div className="flex items-center justify-between text-[10px] text-zinc-500">
                        <span className="flex items-center gap-1">
                          <User className="w-2.5 h-2.5" /> {hist.userEmail}
                        </span>
                        <span>{new Date(hist.timestamp).toLocaleDateString()}</span>
                      </div>
                      <span className="font-bold text-zinc-300 block">
                        Acción: <span className="text-sky-400">{hist.action}</span>
                      </span>
                      <p className="text-[10px] bg-zinc-950/40 p-1 rounded border border-zinc-800/60 text-zinc-400 font-sans mt-0.5">
                        Archivo afectado: {hist.fileName}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal - Agregar Pista de Sonido */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl relative text-left" id="add-track-modal">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Music className="w-4 h-4 text-sky-400" />
                Importar Pista de Audio
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTrack} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-zinc-400 block font-bold uppercase text-[9px]">Nombre de la Pista</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Efecto Viento - Foley"
                  value={newTrackName}
                  onChange={(e) => setNewTrackName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block font-bold uppercase text-[9px]">URL del Archivo de Audio (MP3 / WAV)</label>
                <input
                  type="url"
                  required
                  placeholder="https://ejemplo.com/audio.mp3"
                  value={newTrackUrl}
                  onChange={(e) => setNewTrackUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block font-bold uppercase text-[9px]">Duración Estimada (Segundos)</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={600}
                  value={newTrackDuration}
                  onChange={(e) => setNewTrackDuration(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200 outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-bold px-4 py-2 rounded text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-sky-500 hover:bg-sky-600 text-zinc-950 font-bold px-5 py-2 rounded text-xs cursor-pointer"
                >
                  Importar Pista
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
