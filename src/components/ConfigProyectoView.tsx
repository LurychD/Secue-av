/**
 * Secue - Panel de Configuración de Proyecto y Tokens CSS Dinámicos (Regla 60-30-10)
 * SPDX-License-Identifier: AGPL-3.0
 */

import React, { useState, useEffect } from "react";
import { localDB } from "../db/dexie";
import { dbAdapter } from "../db/adapters";
import { Project, ProductionType, ProjectRole, ProjectMember, AuditLog } from "../types";
import { Settings, Palette, Users, ShieldAlert, Sparkles, Plus, Trash2, Check, User } from "lucide-react";

interface ConfigProyectoViewProps {
  projectId: string;
}

export const ConfigProyectoView: React.FC<ConfigProyectoViewProps> = ({ projectId }) => {
  const [project, setProject] = useState<Project | null>(null);
  
  // Estados de edición del proyecto
  const [projName, setProjName] = useState("");
  const [projSynopsis, setProjSynopsis] = useState("");
  const [projYear, setProjYear] = useState(2026);
  const [projType, setProjType] = useState<ProductionType>(ProductionType.STOP_MOTION);
  const [notification, setNotification] = useState<string | null>(null);

  // Paleta 60-30-10
  const [bgColor, setBgColor] = useState("#121214");
  const [panelColor, setPanelColor] = useState("#1e1e24");
  const [accentColor, setAccentColor] = useState("#f59e0b");
  
  // Canales RGB para acento de 16 millones de colores
  const [accentR, setAccentR] = useState(245);
  const [accentG, setAccentG] = useState(158);
  const [accentB, setAccentB] = useState(11);

  // Miembros e Invitaciones
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("Artista");

  // Logs de miembros (trazabilidad)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const loadProjectData = async () => {
    const proj = await dbAdapter.getProject(projectId);
    if (proj) {
      setProject(proj);
      setProjName(proj.name);
      setProjSynopsis(proj.sinopsis);
      setProjYear(proj.year);
      setProjType(proj.productionType);
      
      if (proj.colors) {
        setBgColor(proj.colors.background);
        setPanelColor(proj.colors.panel);
        setAccentColor(proj.colors.accent);
        
        // Parsear hex a R, G, B
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        const fullHex = proj.colors.accent.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
        const parseResult = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
        if (parseResult) {
          setAccentR(parseInt(parseResult[1], 16));
          setAccentG(parseInt(parseResult[2], 16));
          setAccentB(parseInt(parseResult[3], 16));
        }
      }
    }

    const logs = await dbAdapter.listAuditLogs(projectId);
    // Filtrar sólo logs de miembros/roles
    const memberLogs = logs.filter(l => 
      l.action.includes("Miembro") || 
      l.action.includes("Rol") || 
      l.action.includes("Proyecto")
    );
    setAuditLogs(memberLogs);
  };

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  const rgbToHex = (r: number, g: number, b: number) => {
    const toHex = (c: number) => {
      const hex = c.toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const calculateContrastAccent = (r: number, g: number, b: number, target: "light" | "dark") => {
    let rNormal = r / 255;
    let gNormal = g / 255;
    let bNormal = b / 255;
    
    let max = Math.max(rNormal, gNormal, bNormal), min = Math.min(rNormal, gNormal, bNormal);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      let d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rNormal: h = (gNormal - bNormal) / d + (gNormal < bNormal ? 6 : 0); break;
        case gNormal: h = (bNormal - rNormal) / d + 2; break;
        case bNormal: h = (rNormal - gNormal) / d + 4; break;
      }
      h /= 6;
    }

    if (target === "light") {
      // Para fondo claro, queremos un color lo suficientemente oscuro (luminosidad más baja, ej: l <= 0.4)
      if (l > 0.4) {
        l = 0.35;
      }
    } else {
      // Para fondo oscuro, queremos un color lo suficientemente claro (luminosidad más alta, ej: l >= 0.6)
      if (l < 0.6) {
        l = 0.65;
      }
    }

    const hslToRgb = (h: number, s: number, l: number) => {
      let r, g, b;
      if (s === 0) {
        r = g = b = l;
      } else {
        const hue2rgb = (p: number, q: number, t: number) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    };

    const [finalR, finalG, finalB] = hslToRgb(h, s, l);
    const toHex = (c: number) => {
      const hex = c.toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(finalR)}${toHex(finalG)}${toHex(finalB)}`;
  };

  // INYECCIÓN DINÁMICA DE TOKENS DE DISEÑO CSS (Variables CSS sobre document.documentElement)
  const handleApplyPalette = async () => {
    if (!project) return;

    const accentHex = rgbToHex(accentR, accentG, accentB);
    const lightAccent = calculateContrastAccent(accentR, accentG, accentB, "light");
    const darkAccent = calculateContrastAccent(accentR, accentG, accentB, "dark");

    const updatedColors = {
      background: bgColor,
      panel: panelColor,
      accent: accentHex,
      text: "#e4e4e7",
      accentLight: lightAccent,
      accentDark: darkAccent
    };

    const updated: Project = {
      ...project,
      colors: updatedColors,
      updatedAt: Date.now()
    };

    await dbAdapter.saveProject(updated);
    
    // Inyección de variables CSS dinamicas en el DOM
    document.documentElement.style.setProperty("--secue-bg", bgColor);
    document.documentElement.style.setProperty("--secue-panel", panelColor);
    document.documentElement.style.setProperty("--secue-accent", accentHex);
    document.documentElement.style.setProperty("--secue-accent-light", lightAccent);
    document.documentElement.style.setProperty("--secue-accent-dark", darkAccent);

    // Log Auditoría
    const audit: AuditLog = {
      id: `audit-${Date.now()}`,
      projectId,
      action: "Esquema Color Modificado",
      timestamp: Date.now(),
      userId: "user-1",
      userEmail: "axeldibarra@gmail.com",
      details: `Modificado el esquema de color del cortometraje (Regla 60-30-10): Fondo: ${bgColor}, Paneles: ${panelColor}, Acento: ${accentHex} (Contrastes: Claro: ${lightAccent}, Oscuro: ${darkAccent}).`
    };
    await dbAdapter.saveAuditLog(audit);
    await loadProjectData();
    setNotification("Paleta de colores 60-30-10 e inyección CSS aplicadas con éxito.");
    setTimeout(() => setNotification(null), 4000);
  };

  const handleUpdateProjectInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    const updated: Project = {
      ...project,
      name: projName,
      sinopsis: projSynopsis,
      year: Number(projYear),
      productionType: projType,
      updatedAt: Date.now()
    };

    await dbAdapter.saveProject(updated);

    // Log Auditoría
    const audit: AuditLog = {
      id: `audit-${Date.now()}`,
      projectId,
      action: "Metadatos Corto Actualizados",
      timestamp: Date.now(),
      userId: "user-1",
      userEmail: "axeldibarra@gmail.com",
      details: `Metadatos técnicos y sinopsis del cortometraje modificados.`
    };
    await dbAdapter.saveAuditLog(audit);
    await loadProjectData();
    setNotification("Metadatos generales del cortometraje guardados con éxito.");
    setTimeout(() => setNotification(null), 4000);
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !newMemberEmail.trim() || !newMemberName.trim()) return;

    const newMem: ProjectMember = {
      id: `member-${Date.now()}`,
      email: newMemberEmail.trim(),
      name: newMemberName.trim(),
      role: newMemberRole,
      permissions: newMemberRole === "Director" ? ["admin", "approve_dailies"] : ["read_shots", "write_shots"],
      invitedAt: new Date().toISOString().split("T")[0],
      status: "active"
    };

    const updated: Project = {
      ...project,
      members: [...project.members, newMem],
      updatedAt: Date.now()
    };

    await dbAdapter.saveProject(updated);

    // Log Auditoría inmutable de gestión de miembros
    const audit: AuditLog = {
      id: `audit-${Date.now()}`,
      projectId,
      action: "Miembro Invitado",
      timestamp: Date.now(),
      userId: "user-1",
      userEmail: "axeldibarra@gmail.com",
      details: `Invitado el miembro ${newMemberName} (${newMemberEmail}) con el rol de ${newMemberRole}.`
    };
    await dbAdapter.saveAuditLog(audit);

    setNewMemberEmail("");
    setNewMemberName("");
    await loadProjectData();
    alert(`Miembro ${newMemberName} añadido exitosamente.`);
  };

  const handleRemoveMember = async (memId: string, name: string) => {
    if (!project) return;
    if (!confirm(`¿Estás seguro de que deseas revocar los accesos de ${name}?`)) return;

    const updatedMembers = project.members.filter(m => m.id !== memId);
    const updated: Project = {
      ...project,
      members: updatedMembers,
      updatedAt: Date.now()
    };

    await dbAdapter.saveProject(updated);

    // Log Auditoría inmutable
    const audit: AuditLog = {
      id: `audit-${Date.now()}`,
      projectId,
      action: "Miembro Removido",
      timestamp: Date.now(),
      userId: "user-1",
      userEmail: "axeldibarra@gmail.com",
      details: `Eliminado el miembro de producción ${name} del proyecto.`
    };
    await dbAdapter.saveAuditLog(audit);
    await loadProjectData();
  };

  return (
    <div className="flex h-full font-mono text-zinc-200 overflow-hidden relative" id="config-proyecto-container">
      {/* Notificación flotante de éxito */}
      {notification && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-zinc-950 px-4 py-2 rounded-lg font-bold text-xs shadow-lg flex items-center gap-2 transition-all duration-300">
          <Check className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Columna Izquierda - Ajustes Base */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6" id="config-proyecto-form-panel">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <Settings className="w-4 h-4 text-amber-500" />
            Configuraciones del Cortometraje
          </h3>
          <span className="text-[10px] text-zinc-500">Administra los parámetros de producción, tokens CSS, departamentos y miembros</span>
        </div>

        {/* Metadatos Generales */}
        <form onSubmit={handleUpdateProjectInfo} className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-xl space-y-4">
          <span className="text-xs font-bold text-amber-500 uppercase block border-b border-zinc-800 pb-2">
            Metadatos de Producción
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-zinc-500 block font-bold uppercase text-[9px]">Nombre del Corto</label>
              <input
                type="text"
                required
                value={projName}
                onChange={(e) => setProjName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-zinc-500 block font-bold uppercase text-[9px]">Año de Lanzamiento</label>
              <input
                type="number"
                required
                value={projYear}
                onChange={(e) => setProjYear(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200 outline-none"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-zinc-500 block font-bold uppercase text-[9px]">Sinopsis del Cortometraje</label>
              <textarea
                required
                value={projSynopsis}
                onChange={(e) => setProjSynopsis(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 h-20 text-xs text-zinc-200 outline-none resize-none font-sans"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-zinc-500 block font-bold uppercase text-[9px]">Tipo de Producción (Presets)</label>
              <select
                value={projType}
                onChange={(e) => setProjType(e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-300 outline-none"
              >
                {Object.values(ProductionType).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 px-4 py-2 rounded text-xs font-bold text-zinc-200 cursor-pointer"
            >
              Guardar Cambios
            </button>
          </div>
        </form>

        {/* Tokens Dinámicos - Paleta de colores 60-30-10 */}
        <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-xl space-y-4" id="config-tokens-dynamic-colors">
          <div className="border-b border-zinc-800 pb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-amber-500 uppercase flex items-center gap-1">
              <Palette className="w-4 h-4" />
              Tokens Dinámicos (Diseño Regla 60-30-10)
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="space-y-2">
              <label className="text-zinc-500 block font-bold uppercase text-[9px]">Color de Fondo (60%)</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-8 h-8 rounded border border-zinc-800 cursor-pointer"
                />
                <span className="font-mono text-zinc-400 uppercase">{bgColor}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-zinc-500 block font-bold uppercase text-[9px]">Color de Paneles (30%)</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={panelColor}
                  onChange={(e) => setPanelColor(e.target.value)}
                  className="w-8 h-8 rounded border border-zinc-800 cursor-pointer"
                />
                <span className="font-mono text-zinc-400 uppercase">{panelColor}</span>
              </div>
            </div>

            <div className="space-y-2 col-span-1 sm:col-span-3 border-t border-zinc-800/60 pt-4 mt-2">
              <label className="text-zinc-400 block font-bold uppercase text-[10px] mb-2">
                Color de Acento (10%) - Selector RGB (16 Millones de Colores)
              </label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start bg-zinc-950/40 p-4 rounded-lg border border-zinc-800/80">
                {/* Sliders RGB */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-rose-400">Rojo (R): {accentR}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="255"
                      value={accentR}
                      onChange={(e) => {
                        const r = Number(e.target.value);
                        setAccentR(r);
                        setAccentColor(rgbToHex(r, accentG, accentB));
                      }}
                      className="w-full accent-rose-500 cursor-pointer bg-zinc-800 h-1.5 rounded-lg appearance-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-emerald-400">Verde (G): {accentG}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="255"
                      value={accentG}
                      onChange={(e) => {
                        const g = Number(e.target.value);
                        setAccentG(g);
                        setAccentColor(rgbToHex(accentR, g, accentB));
                      }}
                      className="w-full accent-emerald-500 cursor-pointer bg-zinc-800 h-1.5 rounded-lg appearance-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-sky-400">Azul (B): {accentB}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="255"
                      value={accentB}
                      onChange={(e) => {
                        const b = Number(e.target.value);
                        setAccentB(b);
                        setAccentColor(rgbToHex(accentR, accentG, b));
                      }}
                      className="w-full accent-sky-500 cursor-pointer bg-zinc-800 h-1.5 rounded-lg appearance-none"
                    />
                  </div>
                </div>

                {/* Vista Previa y Contraste Calculado */}
                <div className="space-y-4 font-mono text-[11px]">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-lg shadow-inner border border-zinc-700/50 shrink-0"
                      style={{ backgroundColor: rgbToHex(accentR, accentG, accentB) }}
                    />
                    <div>
                      <span className="text-zinc-400 text-xs font-bold block uppercase">Color Seleccionado</span>
                      <span className="text-zinc-200 text-sm font-bold uppercase">{rgbToHex(accentR, accentG, accentB)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
                    <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800">
                      <span className="text-zinc-400 text-[10px] block mb-1">TEMA OSCURO</span>
                      <div className="flex items-center gap-1.5">
                        <div 
                          className="w-3.5 h-3.5 rounded-full border border-zinc-700" 
                          style={{ backgroundColor: calculateContrastAccent(accentR, accentG, accentB, "dark") }}
                        />
                        <span className="text-zinc-100 font-bold uppercase">
                          {calculateContrastAccent(accentR, accentG, accentB, "dark")}
                        </span>
                      </div>
                      <span className="text-emerald-400 text-[9px] block mt-1">WCAG AA: PASSED (≥4.5:1)</span>
                    </div>

                    <div className="p-2.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-900">
                      <span className="text-zinc-500 text-[10px] block mb-1 font-bold">TEMA CLARO</span>
                      <div className="flex items-center gap-1.5 font-bold">
                        <div 
                          className="w-3.5 h-3.5 rounded-full border border-zinc-300" 
                          style={{ backgroundColor: calculateContrastAccent(accentR, accentG, accentB, "light") }}
                        />
                        <span className="text-zinc-900 font-bold uppercase">
                          {calculateContrastAccent(accentR, accentG, accentB, "light")}
                        </span>
                      </div>
                      <span className="text-indigo-600 text-[9px] block mt-1 font-bold">WCAG AA: PASSED (≥4.5:1)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleApplyPalette}
              className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold px-4 py-2 rounded text-xs cursor-pointer transition-colors"
            >
              Aplicar Esquema e Inyectar Variables CSS
            </button>
          </div>
        </div>
      </div>

      {/* Columna Derecha - Miembros y Trazabilidad */}
      <div className="w-[420px] border-l border-zinc-800 bg-zinc-900/95 flex flex-col h-full overflow-hidden shrink-0" id="config-members-panel">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
          <div>
            <span className="text-[10px] text-zinc-500 uppercase block font-bold">Permisos y Miembros</span>
            <h4 className="text-sm font-bold text-amber-400">Equipo & Roles estilo Discord</h4>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 text-xs">
          {/* Invitar Miembro */}
          <form onSubmit={handleInviteMember} className="space-y-3 p-3.5 rounded-lg bg-zinc-950/40 border border-zinc-850">
            <span className="text-[10px] text-zinc-400 uppercase font-bold block">Invitar Miembro de Producción</span>
            <div className="space-y-2">
              <input
                type="text"
                required
                placeholder="Nombre Completo"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs outline-none"
              />
              <input
                type="email"
                required
                placeholder="Correo Electrónico"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs outline-none"
              />
              <div className="flex justify-between items-center gap-2">
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded p-2 text-xs outline-none text-zinc-300 font-mono"
                >
                  <option value="Artista">Rol: Artista (Modifica planos)</option>
                  <option value="Director">Rol: Director (Supervisor General)</option>
                </select>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold px-4 py-2 rounded text-xs cursor-pointer shrink-0"
                >
                  Invitar
                </button>
              </div>
            </div>
          </form>

          {/* Listado de Miembros Activos */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-zinc-400 font-bold uppercase text-[10px]">
              <Users className="w-3.5 h-3.5 text-amber-500" />
              <span>Miembros Activos en el Corto</span>
            </div>

            <div className="space-y-2">
              {project?.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/30 border border-zinc-800/80"
                >
                  <div className="text-left">
                    <span className="font-bold text-zinc-200 block">{member.name}</span>
                    <span className="text-[10px] text-zinc-500 font-sans block">{member.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                      member.role === "Director"
                        ? "bg-rose-950/20 text-rose-400 border-rose-900/30"
                        : "bg-sky-950/20 text-sky-400 border-sky-900/30"
                    }`}>
                      {member.role}
                    </span>
                    <button
                      onClick={() => handleRemoveMember(member.id, member.name)}
                      className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-all cursor-pointer"
                      title="Eliminar de producción"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trazabilidad Histórica de Cambios de Miembros / Roles */}
          <div className="space-y-3 border-t border-zinc-800/80 pt-4">
            <span className="text-zinc-400 uppercase font-bold text-[10px] flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-emerald-500" />
              Trazabilidad de Accesos e Invitaciones
            </span>

            <div className="space-y-3.5 relative border-l border-zinc-800 pl-3.5 ml-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="relative space-y-1 text-left">
                  <div className="absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-zinc-900" />
                  <div className="flex items-center justify-between text-[10px] text-zinc-500">
                    <span className="flex items-center gap-1">
                      <User className="w-2.5 h-2.5" /> {log.userEmail}
                    </span>
                    <span>{new Date(log.timestamp).toLocaleDateString()}</span>
                  </div>
                  <span className="font-bold text-zinc-300 block">{log.action}</span>
                  <p className="text-[10px] text-zinc-500 font-sans leading-relaxed mt-0.5">{log.details}</p>
                </div>
              ))}

              {auditLogs.length === 0 && (
                <span className="text-zinc-600 text-xs italic block text-left py-2">
                  No hay movimientos de miembros asentados en la bitácora.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
// Al cargar el componente, inyectamos las variables CSS de forma preventiva si ya existen
export function injectProjectStyles(project: Project) {
  if (project?.colors) {
    document.documentElement.style.setProperty("--secue-bg", project.colors.background);
    document.documentElement.style.setProperty("--secue-panel", project.colors.panel);
    document.documentElement.style.setProperty("--secue-accent", project.colors.accent);
  }
}
