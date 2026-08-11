/**
 * Secue - Diagrama de Gantt y Cronograma Temporal de Pipeline (Interactivo)
 * SPDX-License-Identifier: AGPL-3.0
 */

import React, { useState, useEffect } from "react";
import { 
  Calendar, 
  Layers, 
  Clock, 
  ShieldAlert, 
  ArrowLeftRight, 
  Plus, 
  Edit, 
  Trash2, 
  Check, 
  X,
  Palette
} from "lucide-react";
import { dbAdapter } from "../db/adapters";
import { AuditLog } from "../types";

interface GanttTask {
  id: string;
  name: string;
  startDay: number;
  endDay: number;
  department: string;
  color: string; // Tailwind color class (bg-amber-500, bg-indigo-500, etc.)
  progress: number;
}

interface GanttViewProps {
  projectId: string;
}

export const GanttView: React.FC<GanttViewProps> = ({ projectId }) => {
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);
  
  // Modal de Creación
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDept, setNewDept] = useState("Animación");
  const [newStart, setNewStart] = useState(1);
  const [newEnd, setNewEnd] = useState(10);
  const [newColor, setNewColor] = useState("bg-indigo-500");

  const colorsList = [
    { name: "Ámbar", class: "bg-amber-500" },
    { name: "Índigo", class: "bg-indigo-500" },
    { name: "Púrpura", class: "bg-purple-500" },
    { name: "Celeste", class: "bg-sky-500" },
    { name: "Esmeralda", class: "bg-emerald-500" },
    { name: "Rosa", class: "bg-rose-500" }
  ];

  const defaultTasks: GanttTask[] = [
    { id: "1", name: "Layout & Set Dressing", startDay: 1, endDay: 10, department: "Dirección/Layout", color: "bg-amber-500", progress: 100 },
    { id: "2", name: "Animación de Personajes", startDay: 8, endDay: 22, department: "Animación", color: "bg-indigo-500", progress: 45 },
    { id: "3", name: "Rigging de Props", startDay: 4, endDay: 12, department: "Sistemas/Rigging", color: "bg-purple-500", progress: 90 },
    { id: "4", name: "Iluminación de Escenas", startDay: 18, endDay: 28, department: "Iluminación", color: "bg-sky-500", progress: 10 },
    { id: "5", name: "Composición Final & Renders", startDay: 25, endDay: 35, department: "Composición", color: "bg-emerald-500", progress: 0 }
  ];

  const storageKey = `gantt_tasks_${projectId}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setTasks(JSON.parse(saved));
    } else {
      setTasks(defaultTasks);
      localStorage.setItem(storageKey, JSON.stringify(defaultTasks));
    }
    setSelectedTask(null);
  }, [projectId]);

  const saveTasks = async (updated: GanttTask[]) => {
    setTasks(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newTask: GanttTask = {
      id: `task-${Date.now()}`,
      name: newName.trim(),
      startDay: Math.max(1, Number(newStart)),
      endDay: Math.min(36, Math.max(Number(newStart) + 1, Number(newEnd))),
      department: newDept,
      color: newColor,
      progress: 0
    };

    const updated = [...tasks, newTask];
    await saveTasks(updated);

    // Auditoría
    const audit: AuditLog = {
      id: `audit-${Date.now()}`,
      projectId,
      action: "Fase de Gantt Creada",
      timestamp: Date.now(),
      userId: "local-user",
      userEmail: "axeldibarra@gmail.com",
      details: `Agregada fase '${newTask.name}' al cronograma del corto (Días ${newTask.startDay}-${newTask.endDay}).`
    };
    await dbAdapter.saveAuditLog(audit);

    setNewName("");
    setNewDept("Animación");
    setNewStart(1);
    setNewEnd(10);
    setShowAddModal(false);
  };

  const handleUpdateTask = async (updatedTask: GanttTask) => {
    const updated = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
    await saveTasks(updated);
    setSelectedTask(updatedTask);

    // Auditoría
    const audit: AuditLog = {
      id: `audit-${Date.now()}`,
      projectId,
      action: "Fase de Gantt Actualizada",
      timestamp: Date.now(),
      userId: "local-user",
      userEmail: "axeldibarra@gmail.com",
      details: `Actualizados parámetros de la fase '${updatedTask.name}': progreso al ${updatedTask.progress}%, periodo de días ${updatedTask.startDay}-${updatedTask.endDay}.`
    };
    await dbAdapter.saveAuditLog(audit);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar esta etapa del cronograma?")) return;
    
    const updated = tasks.filter(t => t.id !== taskId);
    await saveTasks(updated);
    setSelectedTask(null);
  };

  const daysRange = Array.from({ length: 36 }, (_, i) => i + 1);

  return (
    <div className="flex h-full font-mono text-zinc-200 overflow-hidden" id="gantt-view-container">
      {/* Panel Principal del Gantt */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden space-y-4">
        {/* Cabecera */}
        <div className="flex justify-between items-center shrink-0">
          <div className="text-left">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              Cronograma del Cortometraje (Gantt Pipeline)
            </h3>
            <span className="text-[10px] text-zinc-500">Supervisa solapamientos de etapas, cuellos de botella y plazos de entrega</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-zinc-950 px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Fase</span>
            </button>
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-[10px] text-zinc-400">
              <ArrowLeftRight className="w-3.5 h-3.5 text-zinc-500" />
              <span>Intervalo: Día 1 a 36</span>
            </div>
          </div>
        </div>

        {/* Grid del Cronograma */}
        <div className="flex-1 overflow-x-auto overflow-y-auto border border-zinc-800/80 rounded-xl bg-zinc-900/40 p-4" id="gantt-scroll-canvas">
          <div className="min-w-[900px] space-y-6">
            {/* Timeline header (days numbers) */}
            <div className="grid grid-cols-12 gap-1 border-b border-zinc-800/80 pb-2 text-left">
              <div className="col-span-3 text-xs font-bold text-zinc-500 uppercase">Departamento / Etapa</div>
              <div className="col-span-9 grid grid-cols-36 gap-0.5 text-[9px] text-zinc-500 font-mono text-center">
                {daysRange.map((d) => (
                  <span key={d} className="block w-full">{d % 5 === 0 || d === 1 ? `D${d}` : "."}</span>
                ))}
              </div>
            </div>

            {/* Barras Gantt */}
            <div className="space-y-4">
              {tasks.map((task) => {
                const totalDays = 36;
                const startPct = ((task.startDay - 1) / totalDays) * 100;
                const widthPct = ((task.endDay - task.startDay) / totalDays) * 100;
                const isSelected = selectedTask?.id === task.id;

                return (
                  <div 
                    key={task.id} 
                    onClick={() => setSelectedTask(task)}
                    className={`grid grid-cols-12 items-center gap-1 p-1 rounded-lg border transition-all cursor-pointer ${
                      isSelected ? "border-amber-500/50 bg-amber-500/5" : "border-transparent hover:bg-zinc-900/40"
                    }`}
                  >
                    {/* Etiqueta Etapa */}
                    <div className="col-span-3 pr-2 text-left">
                      <span className="text-xs font-bold text-zinc-300 block truncate">{task.name}</span>
                      <span className="text-[9px] text-zinc-500 uppercase block font-mono truncate">{task.department}</span>
                    </div>

                    {/* Barra Visual */}
                    <div className="col-span-9 relative h-10 bg-zinc-950/40 border border-zinc-900/85 rounded-lg overflow-hidden">
                      {/* Barra de progreso de la tarea */}
                      <div
                        style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                        className={`absolute top-2 bottom-2 rounded-md ${task.color} opacity-90 p-1.5 flex items-center justify-between text-[9px] font-bold text-zinc-950 transition-all duration-200`}
                      >
                        <span className="truncate pl-1">{task.progress}%</span>
                        <span className="shrink-0 text-[8px] opacity-85 pr-1">D{task.startDay}-D{task.endDay}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {tasks.length === 0 && (
                <span className="text-zinc-600 text-xs italic block text-center py-12">
                  No hay etapas definidas en el cronograma temporal.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Alertas de Cuellos de Botella */}
        <div className="bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800/40 flex items-start gap-3 text-xs shrink-0 text-left animate-fade-in" id="gantt-bottleneck-card">
          <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
          <div>
            <span className="font-bold text-zinc-300 block">Auditoría Automática de Pipeline</span>
            <p className="text-zinc-500 text-[10px] leading-relaxed font-sans mt-0.5">
              Supervisa solapamientos de etapas para evitar cuellos de botella. Puedes dar clic a cualquier barra del cronograma para editar sus fechas, duración en días o progreso completado en tiempo real.
            </p>
          </div>
        </div>
      </div>

      {/* Panel lateral - Editor de Fase Seleccionada */}
      {selectedTask && (
        <div className="w-[300px] border-l border-zinc-800 bg-zinc-900/95 flex flex-col h-full overflow-hidden shrink-0 text-left animate-slide-in" id="gantt-edit-panel">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block font-bold">Fase de Pipeline</span>
              <h4 className="text-xs font-bold text-amber-500 truncate max-w-[180px]">{selectedTask.name}</h4>
            </div>
            <button
              onClick={() => setSelectedTask(null)}
              className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-zinc-500 block font-bold uppercase text-[9px]">Nombre de Etapa</label>
              <input
                type="text"
                value={selectedTask.name}
                onChange={(e) => handleUpdateTask({ ...selectedTask, name: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-850 rounded p-1.5 text-xs text-zinc-200 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-500 block font-bold uppercase text-[9px]">Departamento Responsable</label>
              <input
                type="text"
                value={selectedTask.department}
                onChange={(e) => handleUpdateTask({ ...selectedTask, department: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-850 rounded p-1.5 text-xs text-zinc-200 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-zinc-500 block font-bold uppercase text-[9px]">Día Inicio</label>
                <input
                  type="number"
                  min={1}
                  max={35}
                  value={selectedTask.startDay}
                  onChange={(e) => handleUpdateTask({ ...selectedTask, startDay: Number(e.target.value) })}
                  className="w-full bg-zinc-950 border border-zinc-850 rounded p-1.5 text-xs text-zinc-200 outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-zinc-500 block font-bold uppercase text-[9px]">Día Fin</label>
                <input
                  type="number"
                  min={2}
                  max={36}
                  value={selectedTask.endDay}
                  onChange={(e) => handleUpdateTask({ ...selectedTask, endDay: Number(e.target.value) })}
                  className="w-full bg-zinc-950 border border-zinc-850 rounded p-1.5 text-xs text-zinc-200 outline-none font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-500 block font-bold uppercase text-[9px] flex justify-between">
                <span>Porcentaje Completado</span>
                <span className="text-amber-500 font-mono font-bold">{selectedTask.progress}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={selectedTask.progress}
                onChange={(e) => handleUpdateTask({ ...selectedTask, progress: Number(e.target.value) })}
                className="w-full accent-amber-500 bg-zinc-950 h-1.5 rounded cursor-pointer"
              />
            </div>

            {/* Selector de Color de Barra */}
            <div className="space-y-2 pt-2 border-t border-zinc-850">
              <span className="text-zinc-500 block font-bold uppercase text-[9px] flex items-center gap-1">
                <Palette className="w-3 h-3 text-amber-500" />
                Color de Barra
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {colorsList.map((color) => (
                  <button
                    key={color.class}
                    onClick={() => handleUpdateTask({ ...selectedTask, color: color.class })}
                    className={`flex items-center gap-1 p-1 rounded border text-[9px] font-bold ${
                      selectedTask.color === color.class
                        ? "bg-zinc-800 border-zinc-600"
                        : "bg-zinc-950 border-zinc-850 hover:bg-zinc-900"
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${color.class}`} />
                    <span className="text-zinc-400 truncate">{color.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-850 flex justify-end">
              <button
                onClick={() => handleDeleteTask(selectedTask.id)}
                className="flex items-center gap-1.5 bg-rose-950/20 hover:bg-rose-950/50 text-rose-400 border border-rose-900/30 px-3 py-1.5 rounded text-xs cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Fase</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Agregar Fase */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl relative text-left" id="add-gantt-modal">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500" />
                Agregar Fase de Pipeline
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-zinc-400 block font-bold uppercase text-[9px]">Nombre de Etapa / Hito</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Renderizado de Iluminación - Oliver"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block font-bold uppercase text-[9px]">Departamento</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Iluminación"
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-400 block font-bold uppercase text-[9px]">Día Inicio (1 a 35)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={35}
                    value={newStart}
                    onChange={(e) => setNewStart(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200 outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 block font-bold uppercase text-[9px]">Día Fin (2 a 36)</label>
                  <input
                    type="number"
                    required
                    min={2}
                    max={36}
                    value={newEnd}
                    onChange={(e) => setNewEnd(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <label className="text-zinc-400 block font-bold uppercase text-[9px] flex items-center gap-1">
                  <Palette className="w-3 h-3 text-amber-500" />
                  Color del Hito
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {colorsList.map((color) => (
                    <button
                      key={color.class}
                      type="button"
                      onClick={() => setNewColor(color.class)}
                      className={`flex items-center gap-1.5 p-2 rounded border text-left transition-all cursor-pointer ${
                        newColor === color.class
                          ? "bg-zinc-850 border-zinc-500"
                          : "bg-zinc-950 border-zinc-850 hover:bg-zinc-900"
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full shrink-0 ${color.class}`} />
                      <span className="text-[10px] truncate text-zinc-300 font-bold">{color.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-bold px-4 py-2 rounded text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold px-5 py-2 rounded text-xs cursor-pointer"
                >
                  Agregar Fase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
