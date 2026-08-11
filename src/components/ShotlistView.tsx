/**
 * Secue - Shotlist e Inspector Lateral con Trazabilidad Inmutable
 * SPDX-License-Identifier: AGPL-3.0
 */

import React, { useState, useEffect } from "react";
import { localDB } from "../db/dexie";
import { dbAdapter, storageAdapter } from "../db/adapters";
import { Shot, ShotProgressStatus, Subtask, AuditLog, ShotHistoryEntry } from "../types";
import { Film, Eye, ClipboardList, CheckSquare, Plus, FileVideo, History, Trash2, Camera, ShieldCheck, User } from "lucide-react";

interface ShotlistViewProps {
  projectId: string;
  selectedShotIdFromSearch?: string;
  clearSearchShotId?: () => void;
}

export const ShotlistView: React.FC<ShotlistViewProps> = ({
  projectId,
  selectedShotIdFromSearch,
  clearSearchShotId
}) => {
  const [shots, setShots] = useState<Shot[]>([]);
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "history">("details");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  
  // Estados para creación de nuevo shot intermedio
  const [showAddModal, setShowAddModal] = useState(false);
  const [newShotId, setNewShotId] = useState("");
  const [newFrameDuration, setNewFrameDuration] = useState(24);
  const [newCameraNotes, setNewCameraNotes] = useState("");

  const loadShots = async () => {
    const list = await dbAdapter.listShots(projectId);
    // Ordenar por ID flotante convertido a número
    list.sort((a, b) => parseFloat(a.id) - parseFloat(b.id));
    setShots(list);

    // Mantener sincronizado el shot seleccionado
    if (selectedShot) {
      const updated = list.find(s => s.uuid === selectedShot.uuid);
      if (updated) setSelectedShot(updated);
    }
  };

  useEffect(() => {
    loadShots();
  }, [projectId]);

  // Manejar búsqueda global externa
  useEffect(() => {
    if (selectedShotIdFromSearch && shots.length > 0) {
      const found = shots.find(s => s.id === selectedShotIdFromSearch);
      if (found) {
        setSelectedShot(found);
        setActiveTab("details");
      }
      if (clearSearchShotId) clearSearchShotId();
    }
  }, [selectedShotIdFromSearch, shots]);

  const handleCreateShot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShotId || isNaN(parseFloat(newShotId))) {
      alert("Por favor ingrese un número decimal válido para insertar el plano (ej: 1.5)");
      return;
    }

    const exists = shots.some(s => s.id === newShotId);
    if (exists) {
      alert("Este número de plano ya existe. Pruebe un decimal intermedio.");
      return;
    }

    const uuid = `shot-${Date.now()}`;
    const newShot: Shot = {
      id: newShotId,
      uuid,
      projectId,
      layoutStatus: ShotProgressStatus.PENDING,
      animationStatus: ShotProgressStatus.PENDING,
      lightingStatus: ShotProgressStatus.PENDING,
      compositingStatus: ShotProgressStatus.PENDING,
      frameDuration: Number(newFrameDuration),
      cameraNotes: newCameraNotes || "Sin notas de cámara.",
      resolution: "1920x1080",
      directorNotes: "",
      subtasks: [],
      assignedArtist: "axeldibarra@gmail.com",
      keyframeUrl: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?q=80&w=300&auto=format&fit=crop",
      updatedAt: Date.now(),
      history: [
        {
          timestamp: Date.now(),
          userId: "user-1",
          userEmail: "axeldibarra@gmail.com",
          field: "Creación",
          oldValue: "",
          newValue: `Plano ${newShotId} creado`,
          comment: "Plano intermedio creado e insertado en pipeline."
        }
      ]
    };

    await dbAdapter.saveShot(newShot);
    
    // Guardar en la bitácora inmutable
    const audit: AuditLog = {
      id: `audit-${Date.now()}`,
      projectId,
      action: "Plano Creado",
      timestamp: Date.now(),
      userId: "user-1",
      userEmail: "axeldibarra@gmail.com",
      details: `Insertado plano intermedio ${newShotId} con duración de ${newFrameDuration} fotogramas.`
    };
    await dbAdapter.saveAuditLog(audit);

    setShowAddModal(false);
    setNewShotId("");
    setNewCameraNotes("");
    await loadShots();
  };

  const handleStatusChange = async (field: keyof Shot, value: ShotProgressStatus) => {
    if (!selectedShot) return;
    
    const oldValue = selectedShot[field] as string;
    const historyEntry: ShotHistoryEntry = {
      timestamp: Date.now(),
      userId: "user-1",
      userEmail: "axeldibarra@gmail.com",
      field: String(field),
      oldValue,
      newValue: value,
      comment: "Cambio de estado por el artista"
    };

    const updatedShot: Shot = {
      ...selectedShot,
      [field]: value,
      updatedAt: Date.now(),
      history: [...selectedShot.history, historyEntry]
    };

    await dbAdapter.saveShot(updatedShot);
    await loadShots();
  };

  const handleAddSubtask = async () => {
    if (!selectedShot || !newSubtaskTitle.trim()) return;

    const newSub: Subtask = {
      id: `sub-${Date.now()}`,
      title: newSubtaskTitle.trim(),
      completed: false
    };

    const updatedShot: Shot = {
      ...selectedShot,
      subtasks: [...selectedShot.subtasks, newSub],
      updatedAt: Date.now()
    };

    await dbAdapter.saveShot(updatedShot);
    setNewSubtaskTitle("");
    await loadShots();
  };

  const handleToggleSubtask = async (subId: string) => {
    if (!selectedShot) return;

    const updatedSubs = selectedShot.subtasks.map(s => 
      s.id === subId ? { ...s, completed: !s.completed } : s
    );

    const updatedShot: Shot = {
      ...selectedShot,
      subtasks: updatedSubs,
      updatedAt: Date.now()
    };

    await dbAdapter.saveShot(updatedShot);
    await loadShots();
  };

  const getStatusBg = (status: ShotProgressStatus) => {
    switch (status) {
      case ShotProgressStatus.PENDING: return "bg-zinc-800 text-zinc-400 border border-zinc-700";
      case ShotProgressStatus.IN_PROGRESS: return "bg-amber-950/40 text-amber-400 border border-amber-900/40";
      case ShotProgressStatus.REVISION: return "bg-indigo-950/40 text-indigo-400 border border-indigo-900/40";
      case ShotProgressStatus.COMPLETED: return "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40";
      default: return "bg-zinc-800";
    }
  };

  return (
    <div className="flex h-full font-mono text-zinc-200 overflow-hidden relative" id="shotlist-view-container">
      {/* Grilla Principal */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Film className="w-4 h-4 text-amber-500" />
              Shotlist del Proyecto (Planos)
            </h3>
            <span className="text-[10px] text-zinc-500">Numeración flexible decimal para planos insertados de forma tardía</span>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold px-3 py-1.5 rounded text-xs transition-colors cursor-pointer"
            id="add-shot-btn"
          >
            <Plus className="w-4 h-4" />
            <span>Insertar Plano</span>
          </button>
        </div>

        {/* Tabla/Grilla con Virtualización Simplificada */}
        <div className="flex-1 overflow-y-auto border border-zinc-800/80 rounded-xl bg-zinc-900/40" id="shotlist-grid">
          <div className="min-w-[800px]">
            {/* Cabecera Tabla */}
            <div className="grid grid-cols-12 gap-2 bg-zinc-900 p-3 text-[10px] uppercase font-bold text-zinc-500 border-b border-zinc-800">
              <div className="col-span-1">Plano</div>
              <div className="col-span-2">Fotograma Clave</div>
              <div className="col-span-2">Layout</div>
              <div className="col-span-2">Animación</div>
              <div className="col-span-2">Iluminación</div>
              <div className="col-span-2">Composición</div>
              <div className="col-span-1 text-right">Frms</div>
            </div>

            {/* Filas */}
            <div className="divide-y divide-zinc-800/60">
              {shots.map((shot) => (
                <div
                  key={shot.uuid}
                  onClick={() => setSelectedShot(shot)}
                  className={`grid grid-cols-12 gap-2 p-3 items-center text-xs hover:bg-zinc-800/30 transition-colors cursor-pointer ${
                    selectedShot?.uuid === shot.uuid ? "bg-zinc-800/40 border-l-2 border-amber-500" : ""
                  }`}
                >
                  <div className="col-span-1 font-bold text-amber-400 font-mono text-sm">
                    {shot.id}
                  </div>
                  <div className="col-span-2">
                    {shot.keyframeUrl ? (
                      <img
                        src={shot.keyframeUrl}
                        alt={`Thumbnail ${shot.id}`}
                        referrerPolicy="no-referrer"
                        className="w-20 h-11 object-cover rounded border border-zinc-700/80"
                      />
                    ) : (
                      <div className="w-20 h-11 bg-zinc-950 flex items-center justify-center text-[10px] text-zinc-600 rounded">
                        Sin Imagen
                      </div>
                    )}
                  </div>
                  
                  {/* Celdas de Estado con Colores 60-30-10 */}
                  <div className="col-span-2">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getStatusBg(shot.layoutStatus)}`}>
                      {shot.layoutStatus}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getStatusBg(shot.animationStatus)}`}>
                      {shot.animationStatus}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getStatusBg(shot.lightingStatus)}`}>
                      {shot.lightingStatus}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getStatusBg(shot.compositingStatus)}`}>
                      {shot.compositingStatus}
                    </span>
                  </div>

                  <div className="col-span-1 text-right font-bold font-mono text-zinc-300">
                    {shot.frameDuration} f
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Inspector Lateral Desplegable */}
      {selectedShot && (
        <div className="w-[360px] border-l border-zinc-800 bg-zinc-900/95 flex flex-col h-full overflow-hidden shrink-0" id="shot-inspector">
          {/* Cabecera Inspector */}
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block font-bold">Inspector Técnico</span>
              <h4 className="text-sm font-bold text-amber-400">Plano {selectedShot.id}</h4>
            </div>
            <button
              onClick={() => setSelectedShot(null)}
              className="text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
            >
              Cerrar
            </button>
          </div>

          {/* Selector de pestañas */}
          <div className="flex border-b border-zinc-800 text-xs bg-zinc-950/40">
            <button
              onClick={() => setActiveTab("details")}
              className={`flex-1 py-2 text-center border-b font-medium cursor-pointer ${
                activeTab === "details" ? "border-amber-500 text-amber-400 font-bold" : "border-transparent text-zinc-400"
              }`}
            >
              Detalles
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 py-2 text-center border-b font-medium cursor-pointer ${
                activeTab === "history" ? "border-amber-500 text-amber-400 font-bold" : "border-transparent text-zinc-400"
              }`}
            >
              Trazabilidad ({selectedShot.history.length})
            </button>
          </div>

          {/* Contenido Pestañas */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
            {activeTab === "details" ? (
              <>
                {/* Metadatos técnicos */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-zinc-400 font-bold uppercase text-[10px]">
                    <Camera className="w-3.5 h-3.5 text-amber-500" />
                    <span>Metadatos Técnicos</span>
                  </div>
                  <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/80 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Duración:</span>
                      <span className="font-bold text-zinc-300">{selectedShot.frameDuration} fotogramas</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Resolución:</span>
                      <span className="font-bold text-zinc-300">{selectedShot.resolution}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Artista Asignado:</span>
                      <span className="font-bold text-amber-400">{selectedShot.assignedArtist}</span>
                    </div>
                  </div>
                </div>

                {/* Notas de cámara */}
                <div className="space-y-1.5">
                  <span className="text-zinc-500 uppercase font-bold text-[10px] block">Notas de Cámara</span>
                  <p className="bg-zinc-950/40 p-2.5 rounded border border-zinc-800/50 text-zinc-300 italic">
                    {selectedShot.cameraNotes || "Sin notas específicas de cámara."}
                  </p>
                </div>

                {/* Actualizador de estados */}
                <div className="space-y-2">
                  <span className="text-zinc-400 uppercase font-bold text-[10px] block">Actualizar Pipeline</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">Layout</label>
                      <select
                        value={selectedShot.layoutStatus}
                        onChange={(e) => handleStatusChange("layoutStatus", e.target.value as any)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs font-mono text-zinc-300 outline-none"
                      >
                        {Object.values(ShotProgressStatus).map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">Animación</label>
                      <select
                        value={selectedShot.animationStatus}
                        onChange={(e) => handleStatusChange("animationStatus", e.target.value as any)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs font-mono text-zinc-300 outline-none"
                      >
                        {Object.values(ShotProgressStatus).map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">Iluminación</label>
                      <select
                        value={selectedShot.lightingStatus}
                        onChange={(e) => handleStatusChange("lightingStatus", e.target.value as any)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs font-mono text-zinc-300 outline-none"
                      >
                        {Object.values(ShotProgressStatus).map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">Composición</label>
                      <select
                        value={selectedShot.compositingStatus}
                        onChange={(e) => handleStatusChange("compositingStatus", e.target.value as any)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs font-mono text-zinc-300 outline-none"
                      >
                        {Object.values(ShotProgressStatus).map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Subchecklist del artista */}
                <div className="space-y-2 border-t border-zinc-800/80 pt-4">
                  <div className="flex items-center gap-1 text-zinc-400 font-bold uppercase text-[10px]">
                    <ClipboardList className="w-3.5 h-3.5 text-amber-500" />
                    <span>Checklist de tareas secundarias</span>
                  </div>
                  
                  <div className="space-y-2">
                    {selectedShot.subtasks.map((st) => (
                      <div key={st.id} className="flex items-center gap-2 bg-zinc-950/20 p-2 rounded border border-zinc-800/40">
                        <input
                          type="checkbox"
                          checked={st.completed}
                          onChange={() => handleToggleSubtask(st.id)}
                          className="w-3.5 h-3.5 accent-amber-500 cursor-pointer"
                        />
                        <span className={`text-xs ${st.completed ? "line-through text-zinc-500" : "text-zinc-300"}`}>
                          {st.title}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="Nueva subtarea..."
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-850 rounded p-1.5 text-xs outline-none"
                    />
                    <button
                      onClick={handleAddSubtask}
                      className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 px-2.5 py-1.5 rounded text-xs cursor-pointer"
                    >
                      Sumar
                    </button>
                  </div>
                </div>
              </>
            ) : (
              // Trazabilidad Histórica Inmutable
              <div className="space-y-4">
                <div className="flex items-center gap-1.5 text-zinc-400 font-bold uppercase text-[10px]">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Bitácora Histórica del Plano</span>
                </div>

                <div className="space-y-3 relative border-l border-zinc-800 pl-3.5 ml-2">
                  {selectedShot.history.map((hist, idx) => (
                    <div key={idx} className="relative space-y-1">
                      <div className="absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500/80 border border-zinc-900" />
                      <div className="flex items-center justify-between text-[10px] text-zinc-500">
                        <span className="flex items-center gap-1">
                          <User className="w-2.5 h-2.5" /> {hist.userEmail}
                        </span>
                        <span>{new Date(hist.timestamp).toLocaleDateString()}</span>
                      </div>
                      <span className="font-bold text-zinc-300 block">
                        Modificó <span className="text-amber-400">{hist.field}</span>
                      </span>
                      <div className="text-[10px] bg-zinc-950/40 p-1.5 rounded border border-zinc-800/60 text-zinc-400 font-sans mt-1">
                        {hist.comment || "Sin comentarios técnicos."}
                        {hist.oldValue && (
                          <div className="text-[9px] mt-1 text-zinc-500">
                            De: {hist.oldValue} &rarr; A: {hist.newValue}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {selectedShot.history.length === 0 && (
                    <div className="text-zinc-600 text-xs italic py-4">
                      No hay registros de trazabilidad históricos cargados en este plano.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal para Crear Plano */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form
            onSubmit={handleCreateShot}
            className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4 shadow-2xl"
          >
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <h4 className="text-sm font-bold text-amber-500">Insertar Plano Intermedio</h4>
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
                <label className="text-[10px] text-zinc-500 block uppercase font-bold mb-1">
                  Número de Plano Flotante (ej: 1.5, 2.1)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 1.5"
                  value={newShotId}
                  onChange={(e) => setNewShotId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200 outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 block uppercase font-bold mb-1">
                  Duración en Fotogramas (Frames)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={newFrameDuration}
                  onChange={(e) => setNewFrameDuration(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200 outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 block uppercase font-bold mb-1">
                  Notas de Cámara del Plano
                </label>
                <textarea
                  placeholder="Describe el movimiento de cámara, el lente..."
                  value={newCameraNotes}
                  onChange={(e) => setNewCameraNotes(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 h-20 text-xs text-zinc-200 outline-none resize-none font-sans"
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
                className="px-4 py-2 rounded text-zinc-950 bg-amber-500 hover:bg-amber-600 transition-colors text-xs font-bold cursor-pointer"
              >
                Guardar Plano
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
