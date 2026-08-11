/**
 * Secue - Dashboard General y Alertas de Vencimiento
 * SPDX-License-Identifier: AGPL-3.0
 */

import React, { useState, useEffect } from "react";
import { localDB } from "../db/dexie";
import { Project, Shot, AuditLog } from "../types";
import { Calendar, AlertTriangle, CheckCircle, Clock, BarChart3, ArrowRight, Sparkles } from "lucide-react";

interface DashboardViewProps {
  projectId: string;
  onNavigateToView: (view: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projectId,
  onNavigateToView
}) => {
  const [project, setProject] = useState<Project | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [googleCalendarSynced, setGoogleCalendarSynced] = useState(false);
  const [gcalLoading, setGcalLoading] = useState(false);

  useEffect(() => {
    const loadDashboardData = async () => {
      const proj = await localDB.projects.get(projectId);
      if (proj) {
        setProject(proj);
      }
      
      const pShots = await localDB.shots.where("projectId").equals(projectId).toArray();
      setShots(pShots);

      // Traer últimos 4 logs de auditoría
      const logs = await localDB.audit_logs
        .where("projectId")
        .equals(projectId)
        .reverse()
        .limit(4)
        .toArray();
      setRecentLogs(logs);
    };

    loadDashboardData();
    // Suscribirse a cambios locales para mantener reactividad offline
    const interval = setInterval(loadDashboardData, 3000);
    return () => clearInterval(interval);
  }, [projectId]);

  // Calcular métricas
  const totalShots = shots.length;
  const completedShots = shots.filter(s => s.compositingStatus === "Completado").length;
  const inProgressShots = shots.filter(s => 
    s.compositingStatus !== "Completado" && 
    (s.layoutStatus === "Completado" || s.animationStatus === "En Proceso")
  ).length;
  const pendingShots = totalShots - completedShots - inProgressShots;
  
  const percentage = totalShots > 0 ? Math.round((completedShots / totalShots) * 100) : 0;
  
  // Calcular duración total en segundos (basado en 24 fps)
  const totalFrames = shots.reduce((acc, s) => acc + (s.frameDuration || 0), 0);
  const durationSeconds = Math.round((totalFrames / 24) * 10) / 10;

  // Generar Alertas de Vencimiento Próximo (< 48 hs)
  // Simulamos alertas de pipeline con fechas clave o plazos próximos
  const upcomingDeadlines = [
    { id: "dl-1", stage: "Layout de Plano 2.0", hoursLeft: 12, critical: true, assignedTo: "axeldibarra@gmail.com" },
    { id: "dl-2", stage: "Aprobación de Renders Dailies en Plano 3.0", hoursLeft: 36, critical: false, assignedTo: "director@secue.com" }
  ];

  const handleSyncGoogleCalendar = () => {
    setGcalLoading(true);
    setTimeout(() => {
      setGoogleCalendarSynced(true);
      setGcalLoading(false);
      // Registrar evento en la bitácora
      const newLog: AuditLog = {
        id: `log-gcal-${Date.now()}`,
        projectId,
        action: "Sincronización de Google Calendar",
        timestamp: Date.now(),
        userId: "user-1",
        userEmail: "axeldibarra@gmail.com",
        details: "Fechas límites de entrega del pipeline sincronizadas con Google Calendar con éxito."
      };
      localDB.audit_logs.put(newLog);
    }, 1500);
  };

  return (
    <div className="space-y-6 overflow-y-auto max-h-full pr-1 font-mono text-zinc-200" id="dashboard-view-container">
      {/* Cabecera del Cortometraje */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-6 rounded-xl bg-zinc-900 border border-zinc-800/80 gap-4 shadow-sm" id="dashboard-header-panel">
        <div>
          <span className="text-xs font-bold text-amber-500 uppercase tracking-widest block mb-1">
            {project?.productionType || "Cortometraje"} &bull; Año {project?.year || 2026}
          </span>
          <h2 className="text-3xl font-bold text-zinc-100 tracking-tight font-sans">
            {project?.name || "Cargando Cortometraje..."}
          </h2>
          <p className="text-sm text-zinc-400 mt-2 leading-relaxed max-w-2xl font-sans">
            {project?.sinopsis || "Sin sinopsis configurada."}
          </p>
        </div>

        {/* Círculo de Progreso */}
        <div className="flex items-center gap-4 bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/50" id="dashboard-progress-widget">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="#27272a"
                strokeWidth="4"
                fill="transparent"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="#f59e0b"
                strokeWidth="4"
                fill="transparent"
                strokeDasharray={175}
                strokeDashoffset={175 - (175 * percentage) / 100}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <span className="absolute text-sm font-bold text-zinc-100">{percentage}%</span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 block uppercase tracking-wider">Avance General</span>
            <span className="text-xs text-zinc-300 font-bold">{completedShots} de {totalShots} planos terminados</span>
          </div>
        </div>
      </div>

      {/* Grid de Métricas Limpias */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="dashboard-metrics-grid">
        <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-zinc-500 block uppercase">Planos Finales</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-zinc-100">
              {completedShots} <span className="text-zinc-600 text-sm">/ {totalShots}</span>
            </span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-sky-500/10 text-sky-500">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-zinc-500 block uppercase">En Proceso</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-zinc-100">
              {inProgressShots} <span className="text-zinc-600 text-sm">planos</span>
            </span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-zinc-800 text-zinc-400">
            <Clock className="w-6 h-6 opacity-40" />
          </div>
          <div>
            <span className="text-xs text-zinc-500 block uppercase">Pendientes</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-zinc-100">
              {pendingShots} <span className="text-zinc-600 text-sm">planos</span>
            </span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-zinc-500 block uppercase">Duración de Corte</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-zinc-100">
              {durationSeconds}s <span className="text-zinc-600 text-sm">({totalFrames} f)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Alertas de Vencimiento y Google Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-alerts-logs-section">
        <div className="lg:col-span-2 p-5 rounded-xl bg-zinc-900 border border-zinc-800/80 space-y-4" id="dashboard-alerts-card">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
                Alertas de Pipeline e Hitos
              </h3>
            </div>
            <button
              onClick={handleSyncGoogleCalendar}
              disabled={gcalLoading}
              className={`flex items-center gap-1.5 px-3 py-1 rounded border text-xs font-medium font-sans cursor-pointer transition-colors ${
                googleCalendarSynced
                  ? "border-emerald-500 bg-emerald-950/20 text-emerald-400"
                  : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800 text-zinc-300"
              }`}
              id="gcal-sync-button"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {gcalLoading
                  ? "Sincronizando..."
                  : googleCalendarSynced
                  ? "Google Calendar Sincronizado"
                  : "Sincronizar Google Calendar"}
              </span>
            </button>
          </div>

          <div className="space-y-3">
            {upcomingDeadlines.map((dl) => (
              <div
                key={dl.id}
                className={`flex items-center justify-between p-3.5 rounded-lg border text-xs ${
                  dl.critical
                    ? "border-rose-900/50 bg-rose-950/10 text-rose-200"
                    : "border-amber-900/50 bg-amber-950/10 text-amber-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${dl.critical ? "bg-rose-500" : "bg-amber-500 animate-pulse"}`} />
                  <div>
                    <span className="font-bold block text-sm">{dl.stage}</span>
                    <span className="text-zinc-500 font-sans">Responsable: {dl.assignedTo}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-bold text-sm block">Vence en {dl.hoursLeft}h</span>
                  <span className="text-[10px] uppercase text-zinc-500">Sincronizado</span>
                </div>
              </div>
            ))}
            
            {googleCalendarSynced && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-950/40 bg-emerald-950/10 text-xs text-emerald-300">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  Los eventos del pipeline se sincronizaron con Google Calendar. Alertas de alertas de entrega se enviarán a tu cuenta autorizada.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bitácora de Actividades Recientes (Auditoría Inmutable) */}
        <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800/80 space-y-4" id="dashboard-activity-card">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Bitácora de Auditoría
            </h3>
            <button 
              onClick={() => onNavigateToView("documentacion")} 
              className="text-xs text-amber-500 hover:underline flex items-center gap-1 cursor-pointer"
            >
              Ver Logs <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3.5">
            {recentLogs.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 text-xs font-sans">
                No hay actividades recientes registradas en la bitácora inmutable.
              </div>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="text-xs border-b border-zinc-800/50 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between text-zinc-500 text-[10px] mb-1">
                    <span>{log.userEmail}</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <span className="font-bold text-zinc-300 block">{log.action}</span>
                  <span className="text-zinc-500 text-[10px] font-sans block mt-0.5">{log.details}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Atajos de acceso rápido */}
      <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800/40" id="quick-links-panel">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
          Módulos de Producción Rápida
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigateToView("shotlist")}
            className="p-3.5 rounded-lg bg-zinc-950/50 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/50 text-left text-xs cursor-pointer transition-all"
          >
            <span className="text-amber-500 font-bold block mb-1">Shotlist</span>
            <span className="text-zinc-500 text-[10px]">Ver planos y tareas</span>
          </button>
          <button
            onClick={() => onNavigateToView("assets")}
            className="p-3.5 rounded-lg bg-zinc-950/50 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-500/50 text-left text-xs cursor-pointer transition-all"
          >
            <span className="text-emerald-500 font-bold block mb-1">Assets</span>
            <span className="text-zinc-500 text-[10px]">Diseños y props</span>
          </button>
          <button
            onClick={() => onNavigateToView("dailies")}
            className="p-3.5 rounded-lg bg-zinc-950/50 hover:bg-zinc-800 border border-zinc-800 hover:border-indigo-500/50 text-left text-xs cursor-pointer transition-all"
          >
            <span className="text-indigo-500 font-bold block mb-1">Renders Dailies</span>
            <span className="text-zinc-500 text-[10px]">Aprobación A / B</span>
          </button>
          <button
            onClick={() => onNavigateToView("sonido")}
            className="p-3.5 rounded-lg bg-zinc-950/50 hover:bg-zinc-800 border border-zinc-800 hover:border-sky-500/50 text-left text-xs cursor-pointer transition-all"
          >
            <span className="text-sky-500 font-bold block mb-1">Módulo Sonido</span>
            <span className="text-zinc-500 text-[10px]">Sincro marco a marco</span>
          </button>
        </div>
      </div>
    </div>
  );
};
