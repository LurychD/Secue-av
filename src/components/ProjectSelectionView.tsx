/**
 * Secue - Vista de Selección y Creación de Proyectos (Pantalla Inicial)
 * SPDX-License-Identifier: AGPL-3.0
 */

import React, { useState, useEffect, useRef } from "react";
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
  Video,
  Upload,
  UserCheck
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

  // Icono Personalizado (Carga y Edición con Canvas)
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const colorPresets = [
    { label: "Ámbar Áureo", value: "#f59e0b" },
    { label: "Rojo Escarlata", value: "#ef4444" },
    { label: "Cian Eléctrico", value: "#06b6d4" },
    { label: "Esmeralda", value: "#10b981" },
    { label: "Índigo Profundo", value: "#6366f1" },
    { label: "Magenta Punk", value: "#ec4899" }
  ];

  // Helper para dibujar la imagen de forma reactiva en el Canvas de previsualización
  useEffect(() => {
    if (!imageSrc || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Limpiar lienzo
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      // Mover origen al centro del canvas para aplicar rotación y escala centradamente
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom, zoom);

      // Dibujar la porción cuadrada de la imagen recortada
      const size = Math.min(img.width, img.height);
      ctx.drawImage(
        img,
        (img.width - size) / 2,
        (img.height - size) / 2,
        size,
        size,
        -canvas.width / 2,
        -canvas.height / 2,
        canvas.width,
        canvas.height
      );

      ctx.restore();
    };
    img.src = imageSrc;
  }, [imageSrc, zoom, rotation]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validación del límite de 5 Megabytes
    if (file.size > 5 * 1024 * 1024) {
      alert("La imagen excede el límite de tamaño máximo de 5MB. Por favor elija un archivo más liviano.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImageSrc(event.target.result as string);
        setZoom(1.0);
        setRotation(0);
      }
    };
    reader.readAsDataURL(file);
  };

  const getMemberRole = (project: Project, userEmail: string = "axeldibarra@gmail.com") => {
    const member = project.members?.find(m => m.email.toLowerCase() === userEmail.toLowerCase());
    
    // Si el rol ya está definido en el miembro
    if (member && member.role && member.role !== "Indefinido") {
      return member.role;
    }

    // Reglas de asignación dinámica de rol si está indefinido
    // 1. Dueño: si el usuario es el creador original o admin inicial (o coincide el email axeldibarra@gmail.com)
    if (
      project.members?.[0]?.email.toLowerCase() === userEmail.toLowerCase() || 
      member?.permissions?.includes("admin") ||
      project.id === "corto-1"
    ) {
      return "Dueño";
    }

    // 2. Artista: si fue invitado
    if (member?.status === "invited" || member?.role === "Artista") {
      return "Artista";
    }

    // 3. Tutor: si el nombre o sinopsis alude a supervisión/tutor/docencia
    if (
      project.name.toLowerCase().includes("tutor") || 
      project.name.toLowerCase().includes("docente") ||
      project.sinopsis.toLowerCase().includes("tutor") ||
      project.sinopsis.toLowerCase().includes("docente") ||
      project.sinopsis.toLowerCase().includes("supervisión")
    ) {
      return "Tutor";
    }

    // Fallback por defecto
    return "Dueño";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const projectId = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
    
    // Extraer base64 del canvas de icono si se cargó una imagen
    let customIconBase64: string | undefined = undefined;
    if (imageSrc && canvasRef.current) {
      customIconBase64 = canvasRef.current.toDataURL("image/jpeg", 0.85);
    }

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
      customIcon: customIconBase64,
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
      setImageSrc(null);
    } catch (err) {
      console.error("Error al crear proyecto:", err);
      alert("Hubo un error al crear tu cortometraje.");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-mono" id="project-selection-view">
      {/* Hero Header Limpio (Sin versión) */}
      <header className="h-16 border-b border-zinc-900 bg-zinc-900/40 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-indigo-500 animate-spin" />
          <span className="font-bold tracking-wider uppercase text-sm text-zinc-200">
            Secue
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto max-w-5xl w-full mx-auto p-6 md:p-12 flex flex-col justify-center">
        {/* Cabecera de Entrada ultra-limpia */}
        <div className="space-y-1 mb-8 text-left border-b border-zinc-900 pb-4">
          <h1 className="text-2xl font-bold uppercase tracking-wider text-zinc-100">
            Proyectos
          </h1>
        </div>

        {/* Grid de Cortometrajes Activos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="project-grid">
          {projects.map((project) => {
            const progressPercent = project.counters.totalShots > 0 
              ? Math.round((project.counters.completedShots / project.counters.totalShots) * 100)
              : 0;
            const accent = project.colors?.accent || "#3b82f6";
            const calculatedRole = getMemberRole(project, "axeldibarra@gmail.com");

            return (
              <div 
                key={project.id}
                onClick={() => onSelectProject(project)}
                className="group relative bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-700 p-5 rounded-xl cursor-pointer transition-all duration-200 flex gap-4 h-56 hover:shadow-lg hover:shadow-black/50"
                style={{ borderLeftColor: accent, borderLeftWidth: "4px" }}
              >
                {/* Ícono de Proyecto Procesado / Por defecto */}
                <div className="flex flex-col items-center justify-start shrink-0">
                  {project.customIcon ? (
                    <img 
                      src={project.customIcon} 
                      alt={project.name} 
                      className="w-14 h-14 rounded-lg object-cover border border-zinc-800/80"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div 
                      className="w-14 h-14 rounded-lg border border-zinc-800 bg-zinc-950 flex items-center justify-center text-zinc-500 group-hover:text-zinc-300 transition-colors"
                    >
                      <Film className="w-6 h-6" style={{ color: accent }} />
                    </div>
                  )}
                </div>

                {/* Contenido derecho */}
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[9px] bg-zinc-950 border border-zinc-850 text-zinc-400 px-2 py-0.5 rounded font-bold uppercase truncate">
                        {project.productionType}
                      </span>
                      {/* Badge Visual de Rol */}
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-amber-400 border border-zinc-750 flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />
                        {calculatedRole}
                      </span>
                    </div>

                    <h2 className="text-md font-bold text-zinc-200 group-hover:text-zinc-100 transition-colors uppercase truncate text-left">
                      {project.name}
                    </h2>
                    <p className="text-[11px] text-zinc-500 line-clamp-3 font-sans leading-relaxed text-left">
                      {project.sinopsis}
                    </p>
                  </div>

                  {/* Estadísticas Rápidas ( Shots renombrado a Planos ) */}
                  <div className="pt-3 border-t border-zinc-850/60 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <div className="flex items-center gap-2">
                      <span title="Total de Planos">
                        <strong style={{ color: accent }} className="font-bold">{project.counters.totalShots}</strong> Planos
                      </span>
                      <span title="Duración estimada del corto" className="text-zinc-500">|</span>
                      <span title="Duración en cuadros">
                        <strong style={{ color: accent }} className="font-bold">{project.counters.totalDurationFrames}</strong> Frms
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1 font-bold text-zinc-300">
                      <span>{progressPercent}%</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" style={{ color: accent }} />
                    </div>
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
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-full group-hover:bg-zinc-850 group-hover:border-zinc-700 transition-all text-zinc-400 group-hover:text-zinc-200 mb-2">
              <Plus className="w-5 h-5" />
            </div>
            <span className="font-bold text-zinc-300 group-hover:text-zinc-100 transition-colors uppercase text-xs">
              Crear Nuevo Proyecto
            </span>
            <span className="text-[10px] text-zinc-500 font-sans mt-0.5">
              Inicializa un nuevo cortometraje
            </span>
          </div>
        </div>
      </div>

      {/* Modal / Formulario de Creación de Proyecto */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative text-left my-8" id="create-project-modal">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Video className="w-4 h-4 text-indigo-400" />
                Nuevo Cortometraje de Producción
              </h3>
              <p className="text-[10px] text-zinc-500 font-sans">Define las bases iniciales y el icono personalizado.</p>
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
                  rows={2}
                  value={sinopsis}
                  onChange={(e) => setSinopsis(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2.5 text-xs text-zinc-200 outline-none focus:border-zinc-700 transition-all font-sans resize-none"
                />
              </div>

              {/* Subida y Recorte de Ícono de hasta 5MB */}
              <div className="space-y-2 p-3 bg-zinc-950 border border-zinc-850 rounded-lg">
                <label className="text-zinc-400 block font-bold uppercase text-[9px] flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-amber-500" />
                  Ícono Personalizado (Máx 5MB)
                </label>
                
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="shrink-0 flex flex-col items-center gap-1">
                    <canvas 
                      ref={canvasRef} 
                      width={100} 
                      height={100} 
                      className="border border-zinc-800 rounded bg-zinc-900 w-[100px] h-[100px] object-cover"
                    />
                    <span className="text-[8px] text-zinc-500">Vista Icono 100x100</span>
                  </div>

                  <div className="flex-1 space-y-2 w-full">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="block w-full text-[10px] text-zinc-400 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700 cursor-pointer"
                    />

                    {imageSrc && (
                      <div className="space-y-1.5 pt-1">
                        {/* Control de Zoom */}
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] text-zinc-500 uppercase font-bold w-12">Zoom ({zoom.toFixed(1)}x)</span>
                          <input 
                            type="range" 
                            min="1.0" 
                            max="3.0" 
                            step="0.1" 
                            value={zoom}
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="flex-1 accent-amber-500"
                          />
                        </div>

                        {/* Control de Rotación */}
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] text-zinc-500 uppercase font-bold w-12">Giro ({rotation}°)</span>
                          <input 
                            type="range" 
                            min="0" 
                            max="360" 
                            step="5" 
                            value={rotation}
                            onChange={(e) => setRotation(parseInt(e.target.value))}
                            className="flex-1 accent-amber-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
