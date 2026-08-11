/**
 * Secue - Control de Versiones de Montaje con Reproductor Marco a Marco
 * SPDX-License-Identifier: AGPL-3.0
 */

import React, { useState, useEffect, useRef } from "react";
import { localDB } from "../db/dexie";
import { dbAdapter } from "../db/adapters";
import { Montage, MontageCut, AuditLog } from "../types";
import { Film, Play, Pause, ChevronLeft, ChevronRight, Plus, StickyNote, History, Video, AlertCircle, Check, Trash2 } from "lucide-react";

interface MontajeViewProps {
  projectId: string;
}

export const MontajeView: React.FC<MontajeViewProps> = ({ projectId }) => {
  const [montage, setMontage] = useState<Montage | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [noteText, setNoteText] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  const FPS = 24;

  const loadMontage = async () => {
    const list = await dbAdapter.listMontages(projectId);
    if (list.length > 0) {
      setMontage(list[0]);
    }
  };

  useEffect(() => {
    loadMontage();
  }, [projectId]);

  // Manejar loops de actualización de tiempo y cuadro
  useEffect(() => {
    let frameId: any;
    const updateProgress = () => {
      if (videoRef.current) {
        const time = videoRef.current.currentTime;
        setCurrentTime(time);
        setCurrentFrame(Math.floor(time * FPS));
      }
      if (isPlaying) {
        frameId = requestAnimationFrame(updateProgress);
      }
    };

    if (isPlaying) {
      frameId = requestAnimationFrame(updateProgress);
    } else {
      cancelAnimationFrame(frameId);
    }

    return () => cancelAnimationFrame(frameId);
  }, [isPlaying]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true));
    }
  };

  // CONTROL MARCO A MARCO EXACTO (HTML5 exact step)
  const stepFrame = (framesCount: number) => {
    if (!videoRef.current) return;
    setIsPlaying(false);
    videoRef.current.pause();
    
    const singleFrameTime = 1 / FPS;
    let newTime = videoRef.current.currentTime + framesCount * singleFrameTime;
    
    // Validar límites
    if (newTime < 0) newTime = 0;
    if (videoRef.current.duration && newTime > videoRef.current.duration) {
      newTime = videoRef.current.duration;
    }
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setCurrentFrame(Math.floor(newTime * FPS));
  };

  // Convertir fotograma a código de tiempo cinematográfico estándar (HH:MM:SS:FF)
  const formatTimecode = (frames: number) => {
    const hrs = Math.floor(frames / (3600 * FPS));
    const mins = Math.floor((frames % (3600 * FPS)) / (60 * FPS));
    const secs = Math.floor((frames % (60 * FPS)) / FPS);
    const frms = Math.floor(frames % FPS);

    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frms)}`;
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!montage || !noteText.trim()) return;

    const timecode = formatTimecode(currentFrame);
    const newCut: MontageCut = {
      timestamp: currentFrame,
      timecode,
      comments: noteText.trim(),
      status: "Pendiente"
    };

    const updatedCuts = [...montage.cutsList, newCut];
    // Ordenar notas por estampa de cuadro (timestamp)
    updatedCuts.sort((a, b) => a.timestamp - b.timestamp);

    const updated: Montage = {
      ...montage,
      cutsList: updatedCuts,
      updatedAt: Date.now()
    };

    await dbAdapter.saveMontage(updated);
    setNoteText("");
    await loadMontage();

    // Log Auditoría
    const audit: AuditLog = {
      id: `audit-${Date.now()}`,
      projectId,
      action: "Nota de Montaje Agregada",
      timestamp: Date.now(),
      userId: "user-1",
      userEmail: "axeldibarra@gmail.com",
      details: `Anotada corrección de dirección en Timecode ${timecode} (Frame ${currentFrame}): ${newCut.comments}`
    };
    await dbAdapter.saveAuditLog(audit);
  };

  const handleToggleCutStatus = async (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!montage) return;

    const updatedCuts = [...montage.cutsList];
    updatedCuts[idx] = {
      ...updatedCuts[idx],
      status: updatedCuts[idx].status === "Resuelto" ? "Pendiente" : "Resuelto"
    };

    const updated: Montage = {
      ...montage,
      cutsList: updatedCuts,
      updatedAt: Date.now()
    };

    await dbAdapter.saveMontage(updated);
    await loadMontage();

    const audit: AuditLog = {
      id: `audit-${Date.now()}`,
      projectId,
      action: "Estado de Nota Actualizado",
      timestamp: Date.now(),
      userId: "local-user",
      userEmail: "axeldibarra@gmail.com",
      details: `Nota de montaje en Timecode ${updatedCuts[idx].timecode} marcada como ${updatedCuts[idx].status}.`
    };
    await dbAdapter.saveAuditLog(audit);
  };

  const handleDeleteCut = async (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!montage) return;

    const updatedCuts = montage.cutsList.filter((_, i) => i !== idx);

    const updated: Montage = {
      ...montage,
      cutsList: updatedCuts,
      updatedAt: Date.now()
    };

    await dbAdapter.saveMontage(updated);
    await loadMontage();
  };

  return (
    <div className="flex h-full font-mono text-zinc-200 overflow-hidden" id="montaje-view-container">
      {/* Columna Principal - Reproductor */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden space-y-4">
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Video className="w-4 h-4 text-rose-500" />
              Sincronización y Corte de Montaje
            </h3>
            <span className="text-[10px] text-zinc-500">Reproductor marco a marco exacto para notas de dirección sobre cortes preliminares</span>
          </div>
          <span className="text-xs bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-rose-400 font-bold">
            {montage ? montage.title : "Cargando Versión..."}
          </span>
        </div>

        {/* Player Canvas */}
        <div className="flex-1 bg-black rounded-xl border border-zinc-800/80 overflow-hidden flex flex-col justify-between relative group shadow-inner">
          {montage ? (
            <div className="relative flex-1 flex items-center justify-center bg-zinc-950">
              <video
                ref={videoRef}
                src={montage.videoUrl}
                className="w-full h-full object-contain"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
              <AlertCircle className="w-12 h-12 mb-2 animate-bounce text-zinc-700" />
              <span>No hay video de corte de montaje disponible</span>
            </div>
          )}

          {/* Barra de Controles Cinematográficos */}
          <div className="bg-zinc-900/90 border-t border-zinc-800 p-4 space-y-3 shrink-0">
            {/* Timeline simple */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-zinc-500 w-12 text-left">00:00:00</span>
              <input
                type="range"
                min={0}
                max={videoRef.current?.duration || 100}
                step={0.01}
                value={currentTime}
                onChange={(e) => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = parseFloat(e.target.value);
                    setCurrentTime(parseFloat(e.target.value));
                    setCurrentFrame(Math.floor(parseFloat(e.target.value) * FPS));
                  }
                }}
                className="flex-1 accent-rose-500 bg-zinc-950 h-1.5 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] text-zinc-500 w-12 text-right">
                {videoRef.current?.duration ? Math.round(videoRef.current.duration) : 0}s
              </span>
            </div>

            {/* Mandos de reproducción */}
            <div className="flex items-center justify-between">
              {/* Información de Timecode */}
              <div className="flex items-center gap-4 bg-zinc-950 px-3 py-1.5 rounded border border-zinc-800/50">
                <div>
                  <span className="text-[9px] text-zinc-500 block">TIMECODE</span>
                  <span className="text-sm font-bold text-rose-500 tabular-nums">
                    {formatTimecode(currentFrame)}
                  </span>
                </div>
                <div className="border-l border-zinc-800 pl-4">
                  <span className="text-[9px] text-zinc-500 block">FRAME</span>
                  <span className="text-sm font-bold text-zinc-300 tabular-nums">
                    {currentFrame} f
                  </span>
                </div>
              </div>

              {/* Botones */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => stepFrame(-1)}
                  className="p-2 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 cursor-pointer"
                  title="Retroceder 1 Frame (Flecha Izquierda)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={togglePlay}
                  className="p-3 rounded-full bg-rose-500 hover:bg-rose-600 text-zinc-950 font-bold cursor-pointer transition-transform transform active:scale-95"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-zinc-950" />}
                </button>
                <button
                  onClick={() => stepFrame(1)}
                  className="p-2 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 cursor-pointer"
                  title="Avanzar 1 Frame (Flecha Derecha)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <span className="text-[10px] text-zinc-500 font-sans">Velocidad: 24.00 fps</span>
            </div>
          </div>
        </div>
      </div>

      {/* Panel lateral - Anotaciones por Frame */}
      <div className="w-[360px] border-l border-zinc-800 bg-zinc-900/95 flex flex-col h-full overflow-hidden shrink-0" id="montaje-notes-panel">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
          <div>
            <span className="text-[10px] text-zinc-500 uppercase block font-bold">Bitácora de Dirección</span>
            <h4 className="text-sm font-bold text-rose-400">Notas de Dirección por Timecode</h4>
          </div>
        </div>

        {/* Agregar nota en frame actual */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-950/20 space-y-2">
          <form onSubmit={handleAddNote} className="space-y-2">
            <span className="text-[10px] text-zinc-500 uppercase font-bold block">
              Agregar nota en Frame <span className="text-rose-400">{currentFrame}</span> ({formatTimecode(currentFrame)})
            </span>
            <textarea
              required
              placeholder="Ej: Corregir interpenetración del modelo Oliver con la hoja..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-850 rounded p-2.5 h-20 text-xs text-zinc-200 outline-none resize-none font-sans"
            />
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-zinc-950 font-bold py-2 rounded text-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Estampar Nota</span>
            </button>
          </form>
        </div>

        {/* Listado de correcciones */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" id="montaje-notes-list">
          <div className="flex items-center gap-1 text-zinc-400 font-bold uppercase text-[10px] mb-2">
            <StickyNote className="w-3.5 h-3.5 text-rose-500" />
            <span>Lista de Correcciones</span>
          </div>

          {montage?.cutsList.map((cut, idx) => {
            const isResolved = cut.status === "Resuelto";
            return (
              <div
                key={idx}
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = cut.timestamp / FPS;
                    setCurrentTime(cut.timestamp / FPS);
                    setCurrentFrame(cut.timestamp);
                  }
                }}
                className={`p-3 rounded-lg border transition-all cursor-pointer space-y-1.5 text-xs text-left relative group/item ${
                  isResolved 
                    ? "bg-zinc-950/20 border-zinc-900 opacity-60 line-through" 
                    : "bg-zinc-950/40 border-zinc-800 hover:border-rose-500/40"
                }`}
              >
                <div className="flex justify-between items-center text-[10px]">
                  <span className={`font-bold font-mono px-1.5 py-0.5 rounded ${
                    isResolved 
                      ? "text-zinc-500 bg-zinc-900/50 border border-zinc-850" 
                      : "text-rose-400 bg-rose-950/20 border border-rose-900/30"
                  }`}>
                    {cut.timecode}
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 font-mono">F: {cut.timestamp}</span>
                    
                    {/* Botón de Resolver */}
                    <button
                      onClick={(e) => handleToggleCutStatus(idx, e)}
                      className={`p-1 rounded cursor-pointer transition-colors ${
                        isResolved 
                          ? "bg-emerald-950 text-emerald-400 hover:bg-emerald-900" 
                          : "bg-zinc-900 text-zinc-500 hover:text-emerald-400"
                      }`}
                      title={isResolved ? "Marcar como pendiente" : "Marcar como resuelto"}
                    >
                      <Check className="w-3 h-3" />
                    </button>

                    {/* Botón de Eliminar */}
                    <button
                      onClick={(e) => handleDeleteCut(idx, e)}
                      className="p-1 rounded bg-zinc-900 text-zinc-500 hover:text-rose-400 cursor-pointer opacity-0 group-hover/item:opacity-100 transition-opacity"
                      title="Eliminar corrección"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p className={`font-sans italic ${isResolved ? "text-zinc-500" : "text-zinc-300"}`}>{cut.comments}</p>
              </div>
            );
          })}

          {(!montage || montage.cutsList.length === 0) && (
            <span className="text-zinc-600 text-xs italic block text-center py-8">
              No hay notas de dirección estampadas en este corte.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
