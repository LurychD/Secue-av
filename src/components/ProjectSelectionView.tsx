/**
 * Secue - Vista de Selección y Creación de Proyectos (Pantalla Inicial)
 * SPDX-License-Identifier: AGPL-3.0
 */

import React, { useState } from "react";
import { Project, ProductionType } from "../types";
import { dbAdapter } from "../db/adapters";
import { 
  FolderKanban, 
  Plus, 
  Film, 
  Calendar, 
  Layers, 
  Palette, 
  Sparkles, 
  LogIn, 
  Clock, 
  Compass,
  ArrowRight,
  Video
} from "lucide-react";

interface ProjectSelectionViewProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onProjectCreated: (newProject: Project) => void;
}

export const ProjectSelectionView: React.FC<ProjectSelectionViewProps> = ({
  projects,
  onSelectProject,
  onProjectCreated
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Formulario de Creación
  const [name, setName] = useState("");
  const [sinopsis, setSinopsis] = useState("");
  const [year, setYear] = useState(2026);
  const [productionType, setProductionType] = useState<ProductionType>(ProductionType.STOP_MOTION);
  const [accentColor, setAccentColor] = useState("#f59e0b"); // Preset color principal

  const colorPresets = [
    { label: "Ámbar Áureo", value: "#f59e0b" },
    { label: "Rojo Escarlata", value: "#ef4444" },
    { label: "Cian Eléctrico", value: "#06b6d4" },
    { label: "Esmeralda", value: "#10b981" },
    { label: "Índigo Profundo", value: "#6366f1" },
    { label: "Magenta Punk", value: "#ec4899" }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const projectId = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
    
    // Configurar colores basados en el acento seleccionado (Regla 60-30-10)
    const newProject: Project = {
      id: projectId,
      name: name.trim(),
      sinopsis: sinopsis.trim() || "Sin sinopsis disponible.",
      year: Number(year),
      productionType,
      colors: {
        background: "#0c0c0e", // 60%
        panel: "#16161a",      // 30%
        accent: accentColor,   // 10%
        text: "#f4f4f5"
      },
      departments: ["Layout", "Animación", "Iluminación", "Composición", "Sonido"],
      roles: {
        "Director": { name: "Director", color: "#f43f5e", permissions: ["admin", "approve_dailies"] },
        "Artista": { name: "Artista", color: "#3b82f6", permissions: ["read_shots", "write_shots"] }
      },
      members: [
        { 
          id: "local-user-id", 
          email: "axeldibarra@gmail.com", 
          name: "Axel Ibarra", 
          role: "Director", 
          permissions: ["admin"], 
          invitedAt: new Date().toISOString().split("T")[0], 
          status: "active" 
        }
      ],
      counters: {
        totalShots: 0,
        completedShots: 0,
        totalDurationFrames: 0
      },
      updatedAt: Date.now()
    };

    try {
      await dbAdapter.saveProject(newProject);
      // Registrar log de auditoría
      await dbAdapter.saveAuditLog({
        id: `audit-${Date.now()}`,
        projectId: newProject.id,
        action: "Proyecto Creado",
        timestamp: Date.now(),
        userId: "local-user-id",
        userEmail: "axeldibarra@gmail.com",
        details: `Cortometraje de tipo ${productionType} '${newProject.name}' inicializado con éxito.`
      });

      onProjectCreated(newProject);
      setShowCreateModal(false);
      
      // Limpiar estados
      setName("");
      setSinopsis("");
      setYear(2026);
    } catch (err) {
      console.error("Error al crear proyecto:", err);
      alert("Hubo un error al crear tu cortometraje.");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-mono" id="project-selection-view">
      {/* Hero Header */}
      <header className="h-16 border-b border-zinc-900 bg-zinc-900/40 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-indigo-500 animate-spin" />
          <span className="font-bold tracking-wider uppercase text-sm text-zinc-200">
            Secue <span className="text-[10px] text-zinc-500 font-normal">v1.0.0</span>
          </span>
        </div>
        <div className="text-xs text-zinc-500">
          Entorno de Producción Visual de Cortos
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto max-w-5xl w-full mx-auto p-6 md:p-12 flex flex-col justify-center">
        <div className="space-y-2 mb-8 text-left">
          <div className="inline-flex items-center gap-1.5 bg-indigo-950/40 text-indigo-400 border border-indigo-900/40 px-2.5 py-1 rounded-full text-[10px] font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            BIENVENIDO A SECUE
          </div>
          <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-wider text-zinc-100">
            Selecciona tu Cortometraje de Trabajo
          </h1>
          <p className="text-xs md:text-sm text-zinc-400 max-w-2xl font-sans">
            Inicia tu espacio de trabajo local con aislamiento multi-tenant y sincronización híbrida robusta offline-first. Administra storyboards, planos, renderizado, composición y sonido en un pipeline unificado.
          </p>
        </div>

        {/* Grid de Cortometrajes Activos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="project-grid">
          {projects.map((project) => {
            const progressPercent = project.counters.totalShots > 0 
              ? Math.round((project.counters.completedShots / project.counters.totalShots) * 100)
              : 0;
            const accent = project.colors?.accent || "#3b82f6";

            return (
              <div 
                key={project.id}
                onClick={() => onSelectProject(project)}
                className="group relative bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-700 p-5 rounded-xl cursor-pointer transition-all duration-200 flex flex-col justify-between h-56 hover:shadow-lg hover:shadow-black/50"
                style={{ borderLeftColor: accent, borderLeftWidth: "4px" }}
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] bg-zinc-950 border border-zinc-800 text-zinc-400 px-2.5 py-1 rounded-md font-bold uppercase">
                      {project.productionType}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-bold flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {project.year}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-zinc-200 group-hover:text-zinc-100 transition-colors uppercase truncate">
                    {project.name}
                  </h2>
                  <p className="text-xs text-zinc-500 line-clamp-3 font-sans leading-relaxed text-left">
                    {project.sinopsis}
                  </p>
                </div>

                {/* Estadísticas Rápidas */}
                <div className="pt-4 border-t border-zinc-850/60 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <div className="flex items-center gap-3">
                    <span title="Total de Planos">
                      <strong style={{ color: accent }}>{project.counters.totalShots}</strong> Shots
                    </span>
                    <span title="Duración estimada del corto">
                      <strong style={{ color: accent }}>{project.counters.totalDurationFrames}</strong> Frames
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 font-bold text-zinc-300">
                    <span>{progressPercent}% Completado</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" style={{ color: accent }} />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Tarjeta para Crear Cortometraje */}
          <div 
            onClick={() => setShowCreateModal(true)}
            className="border-2 border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-950/20 hover:bg-zinc-900/20 p-5 rounded-xl cursor-pointer transition-all flex flex-col items-center justify-center text-center h-56 group"
            id="create-project-card"
          >
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-full group-hover:bg-zinc-850 group-hover:border-zinc-700 transition-all text-zinc-400 group-hover:text-zinc-200 mb-3">
              <Plus className="w-6 h-6" />
            </div>
            <span className="font-bold text-zinc-300 group-hover:text-zinc-100 transition-colors uppercase text-sm">
              Crear Nuevo Proyecto
            </span>
            <span className="text-[10px] text-zinc-500 font-sans mt-1">
              Inicializa un nuevo cortometraje con pipeline personalizado
            </span>
          </div>
        </div>
      </div>

      {/* Modal / Formulario de Creación de Proyecto */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative text-left" id="create-project-modal">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Video className="w-4 h-4 text-indigo-400" />
                Nuevo Cortometraje de Producción
              </h3>
              <p className="text-[10px] text-zinc-500 font-sans">Define las bases iniciales para el pipeline de animación.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-zinc-400 block font-bold uppercase text-[9px]">Nombre del Corto</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: El Vuelo de la Oruga"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2.5 text-sm text-zinc-200 outline-none focus:border-zinc-700 transition-all font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block font-bold uppercase text-[9px]">Sinopsis Narrativa</label>
                <textarea
                  placeholder="Breve descripción de la historia o del concepto visual..."
                  rows={3}
                  value={sinopsis}
                  onChange={(e) => setSinopsis(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2.5 text-xs text-zinc-200 outline-none focus:border-zinc-700 transition-all font-sans resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-zinc-400 block font-bold uppercase text-[9px]">Año de Entrega</label>
                  <input
                    type="number"
                    required
                    min={2020}
                    max={2040}
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2.5 text-sm text-zinc-200 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 block font-bold uppercase text-[9px]">Técnica de Animación</label>
                  <select
                    value={productionType}
                    onChange={(e) => setProductionType(e.target.value as ProductionType)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2.5 text-sm text-zinc-300 outline-none font-bold"
                  >
                    <option value={ProductionType.TWO_D}>2D Clásico</option>
                    <option value={ProductionType.THREE_D}>3D CGI</option>
                    <option value={ProductionType.STOP_MOTION}>Stop Motion</option>
                    <option value={ProductionType.CUTOUT}>Cutout / Paper</option>
                    <option value={ProductionType.MIXTA}>Técnica Mixta</option>
                  </select>
                </div>
              </div>

              {/* Selector de Preset de Colores */}
              <div className="space-y-2 pt-2 border-t border-zinc-850">
                <label className="text-zinc-400 block font-bold uppercase text-[9px] flex items-center gap-1">
                  <Palette className="w-3 h-3 text-indigo-400" />
                  Color de Acento Visual del Cortometraje
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {colorPresets.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setAccentColor(preset.value)}
                      className={`flex items-center gap-1.5 p-2 rounded border text-left transition-all cursor-pointer ${
                        accentColor === preset.value
                          ? "bg-zinc-850 border-zinc-500"
                          : "bg-zinc-950 border-zinc-850 hover:bg-zinc-900"
                      }`}
                    >
                      <span 
                        className="w-3 h-3 rounded-full shrink-0" 
                        style={{ backgroundColor: preset.value }}
                      />
                      <span className="text-[10px] truncate text-zinc-300 font-bold">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-zinc-850">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-bold px-4 py-2 rounded text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2 rounded text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Crear Proyecto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
