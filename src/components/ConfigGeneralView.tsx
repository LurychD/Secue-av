/**
 * Secue - Vista Unificada y Completa de Configuración de Sistema, Perfil y Proyecto
 * SPDX-License-Identifier: AGPL-3.0
 */

import React, { useState, useEffect } from "react";
import { localDB, seedMockData } from "../db/dexie";
import { dbAdapter } from "../db/adapters";
import { ConfigProyectoView } from "./ConfigProyectoView";
import { Project, UserSettings, AuditLog } from "../types";
import { 
  User, 
  Info, 
  Terminal, 
  Shield, 
  Bell, 
  KeyRound, 
  QrCode, 
  Trash2, 
  RefreshCw, 
  Database,
  Film,
  Settings,
  X,
  History,
  CheckCircle2,
  ChevronRight,
  Sparkles
} from "lucide-react";

interface ConfigGeneralViewProps {
  currentTheme: "light" | "dark";
  onToggleTheme: () => void;
  activeProject: Project | null;
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onClose: () => void;
}

export const ConfigGeneralView: React.FC<ConfigGeneralViewProps> = ({
  currentTheme,
  onToggleTheme,
  activeProject,
  projects,
  onSelectProject,
  onClose
}) => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<"perfil" | "info" | "dev" | "proyecto">("perfil");

  // User Settings States
  const [userName, setUserName] = useState("Axel Ibarra");
  const [userEmail, setUserEmail] = useState("axeldibarra@gmail.com");
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpSecret, setTotpSecret] = useState("KVKVEUZVJZSWM3KJKJZS2===");
  const [showQr, setShowQr] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Db Stats
  const [stats, setStats] = useState({
    projectsCount: 0,
    shotsCount: 0,
    assetsCount: 0,
    dailiesCount: 0,
    logsCount: 0
  });

  // Dev Logs
  const [devLogs, setDevLogs] = useState<AuditLog[]>([]);

  // Selected Project for Home/Start mode
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  // Toast helper
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  };

  // Load User Data & Database Stats
  const reloadData = async () => {
    try {
      // User Settings
      const settings = await dbAdapter.getUserSettings("default-user");
      if (settings) {
        setUserName(settings.displayName || "Axel Ibarra");
        setUserEmail(settings.email || "axeldibarra@gmail.com");
        setTotpEnabled(!!settings.totpEnabled);
        setNotificationsEnabled(settings.notificationsEnabled !== false);
        if (settings.totpSecret) setTotpSecret(settings.totpSecret);
      }

      // Db Stats
      const projC = await localDB.projects.count();
      const shotC = await localDB.shots.count();
      const assetC = await localDB.assets.count();
      const dailyC = await localDB.dailies.count();
      const logC = await localDB.audit_logs.count();
      setStats({
        projectsCount: projC,
        shotsCount: shotC,
        assetsCount: assetC,
        dailiesCount: dailyC,
        logsCount: logC
      });

      // Recent dev logs
      const logs = await localDB.audit_logs.orderBy("timestamp").reverse().limit(15).toArray();
      setDevLogs(logs);
    } catch (err) {
      console.error("Error reading db data:", err);
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Initialize selected project if inside active project
  useEffect(() => {
    if (activeProject) {
      setSelectedProjectId(activeProject.id);
      setActiveTab("proyecto");
    } else if (projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [activeProject, projects]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dbAdapter.saveUserSettings({
        uid: "default-user",
        email: userEmail,
        displayName: userName,
        theme: currentTheme,
        totpEnabled,
        totpSecret,
        notificationsEnabled
      });
      showToast("Perfil de usuario guardado correctamente.");
    } catch (err) {
      console.error(err);
      showToast("Error al guardar perfil.");
    }
  };

  const handleToggleNotifications = async (checked: boolean) => {
    setNotificationsEnabled(checked);
    try {
      await dbAdapter.saveUserSettings({
        uid: "default-user",
        email: userEmail,
        displayName: userName,
        theme: currentTheme,
        totpEnabled,
        totpSecret,
        notificationsEnabled: checked
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length === 6) {
      setTotpEnabled(true);
      setShowQr(false);
      try {
        await dbAdapter.saveUserSettings({
          uid: "default-user",
          email: userEmail,
          displayName: userName,
          theme: currentTheme,
          totpEnabled: true,
          totpSecret,
          notificationsEnabled
        });
        showToast("2FA TOTP activado con éxito.");
      } catch (err) {
        console.error(err);
      }
    } else {
      showToast("Código incorrecto. Ingrese 6 dígitos.");
    }
  };

  const handleDisable2FA = async () => {
    setTotpEnabled(false);
    try {
      await dbAdapter.saveUserSettings({
        uid: "default-user",
        email: userEmail,
        displayName: userName,
        theme: currentTheme,
        totpEnabled: false,
        totpSecret,
        notificationsEnabled
      });
      showToast("2FA desactivado.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearIndexedDB = async () => {
    if (confirm("¿Estás absolutamente seguro de limpiar la IndexedDB local? Todos los planos y cambios pendientes de sincronizar se eliminarán.")) {
      try {
        await localDB.delete();
        await localDB.open();
        showToast("IndexedDB limpia. Recargando...");
        setTimeout(() => window.location.reload(), 1000);
      } catch (err) {
        console.error(err);
        showToast("Error al limpiar IndexedDB.");
      }
    }
  };

  const handleSeedDefaultData = async () => {
    try {
      await seedMockData();
      showToast("Datos por defecto sembrados en IndexedDB.");
      reloadData();
    } catch (err) {
      console.error(err);
      showToast("Error al sembrar datos.");
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 text-zinc-100 font-mono h-full" id="config-general-view-wrapper">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-zinc-900 border border-amber-500/40 text-amber-400 text-xs px-4 py-3 rounded-lg shadow-2xl flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Cabecera Interna de Configuración */}
      <div className="h-16 border-b border-zinc-900 px-6 flex items-center justify-between shrink-0 bg-zinc-900/20">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-amber-500 animate-spin-slow" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
            Panel de Configuración del Sistema
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          title="Cerrar Configuración"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Cuerpo Principal: Sidebar Izquierdo + Contenedor de Contenido */}
      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR IZQUIERDO */}
        <aside className="w-64 border-r border-zinc-900 bg-zinc-900/40 p-4 space-y-6 flex flex-col shrink-0 select-none overflow-y-auto">
          {/* Categoría General */}
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block px-2.5 mb-2">
              Sección General
            </span>
            <button
              onClick={() => setActiveTab("perfil")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                activeTab === "perfil" 
                  ? "bg-amber-500/10 text-amber-400 border-l-2 border-amber-500 font-bold" 
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              <span>Perfil de Usuario</span>
            </button>

            <button
              onClick={() => setActiveTab("info")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                activeTab === "info" 
                  ? "bg-amber-500/10 text-amber-400 border-l-2 border-amber-500 font-bold" 
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
              }`}
            >
              <Info className="w-4 h-4 shrink-0" />
              <span>Info de la App</span>
            </button>

            <button
              onClick={() => setActiveTab("dev")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                activeTab === "dev" 
                  ? "bg-amber-500/10 text-amber-400 border-l-2 border-amber-500 font-bold" 
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
              }`}
            >
              <Terminal className="w-4 h-4 shrink-0" />
              <span>Panel Dev / Semillero</span>
            </button>
          </div>

          {/* Categoría Proyecto */}
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block px-2.5 mb-2">
              Configuración de Proyecto
            </span>
            <button
              onClick={() => setActiveTab("proyecto")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                activeTab === "proyecto" 
                  ? "bg-amber-500/10 text-amber-400 border-l-2 border-amber-500 font-bold" 
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
              }`}
            >
              <Film className="w-4 h-4 shrink-0" />
              <span>Ajustes del Corto</span>
            </button>
          </div>
        </aside>

        {/* PANE DE CONTENIDO DERECHO */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-zinc-950">
          {/* PESTAÑA: PERFIL */}
          {activeTab === "perfil" && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
                  Perfil de Usuario de Producción
                </h3>
                <p className="text-[10px] text-zinc-500 font-sans mt-0.5">
                  Administra tu identidad digital de pipeline y las credenciales de sincronización híbrida.
                </p>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4 text-xs bg-zinc-900/50 border border-zinc-900 p-5 rounded-xl">
                <div className="space-y-1">
                  <label className="text-zinc-400 block font-bold uppercase text-[9px]">Nombre en Producción</label>
                  <input
                    type="text"
                    required
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded p-2 text-zinc-200 outline-none focus:border-zinc-700 transition-all font-sans text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 block font-bold uppercase text-[9px]">Email de Sincronización</label>
                  <input
                    type="email"
                    required
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded p-2 text-zinc-200 outline-none focus:border-zinc-700 transition-all font-sans text-sm"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold px-4 py-2 rounded text-xs transition-colors cursor-pointer"
                  >
                    Guardar Perfil
                  </button>
                </div>
              </form>

              {/* Ajustes de Notificaciones y Seguridad */}
              <div className="bg-zinc-900/50 border border-zinc-900 p-5 rounded-xl space-y-4">
                <span className="text-xs font-bold text-zinc-300 uppercase block border-b border-zinc-850/50 pb-2 flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-indigo-400" />
                  Preferencias de Canal
                </span>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-zinc-300 block text-xs">Notificaciones Locales de Render</span>
                    <span className="text-[10px] text-zinc-500 font-sans block mt-0.5">
                      Recibe alertas instantáneas en tu navegador cuando finalice el renderizado de dailies.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationsEnabled}
                    onChange={(e) => handleToggleNotifications(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* 2FA TOTP */}
              <div className="bg-zinc-900/50 border border-zinc-900 p-5 rounded-xl space-y-4">
                <span className="text-xs font-bold text-zinc-300 uppercase block border-b border-zinc-850/50 pb-2 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  Seguridad de Doble Factor (TOTP 2FA)
                </span>

                {!totpEnabled ? (
                  <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-850 space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-xs font-bold text-zinc-300 block">Estado: DESACTIVADO</span>
                        <span className="text-[10px] text-zinc-500 font-sans">Protege tu cuenta con verificación dinámica TOTP.</span>
                      </div>
                      {!showQr && (
                        <button
                          type="button"
                          onClick={() => setShowQr(true)}
                          className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold px-3 py-1.5 rounded text-xs cursor-pointer transition-colors"
                        >
                          Activar 2FA
                        </button>
                      )}
                    </div>

                    {showQr && (
                      <div className="space-y-4 pt-3 border-t border-zinc-850">
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                          <div className="w-24 h-24 bg-white p-2 rounded flex items-center justify-center border border-zinc-700">
                            <QrCode className="w-full h-full text-zinc-900" />
                          </div>
                          <div className="space-y-1 text-xs">
                            <span className="font-bold text-zinc-300 block">Paso 1: Escanea el QR</span>
                            <span className="text-[10px] text-zinc-500 font-sans block">
                              Usa Google Authenticator o introduce la siguiente clave secreta:
                            </span>
                            <code className="text-[10px] bg-zinc-900 p-1.5 rounded text-amber-500 block font-mono">
                              {totpSecret}
                            </code>
                          </div>
                        </div>

                        <form onSubmit={handleVerify2FA} className="space-y-2 pt-2 border-t border-zinc-850">
                          <span className="font-bold text-zinc-300 block">Paso 2: Confirma el código de 6 dígitos</span>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              required
                              maxLength={6}
                              placeholder="123456"
                              value={totpCode}
                              onChange={(e) => setTotpCode(e.target.value)}
                              className="bg-zinc-900 border border-zinc-800 rounded p-1.5 text-xs text-zinc-200 font-mono text-center outline-none w-36"
                            />
                            <button
                              type="submit"
                              className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold px-4 py-1.5 rounded text-xs cursor-pointer"
                            >
                              Verificar y Activar
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-emerald-950/20 p-4 rounded-lg border border-emerald-900/40 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <KeyRound className="w-5 h-5 text-emerald-400" />
                      <div>
                        <span className="font-bold text-emerald-400 block">2FA ACTIVO</span>
                        <span className="text-[10px] text-zinc-400 font-sans">Se solicita código TOTP en los inicios de sesión.</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDisable2FA}
                      className="bg-zinc-800 hover:bg-zinc-750 text-zinc-400 px-3 py-1.5 rounded hover:text-rose-400 border border-zinc-700 transition-colors cursor-pointer"
                    >
                      Desactivar 2FA
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PESTAÑA: INFO DE LA APP */}
          {activeTab === "info" && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
                  Información Técnica y Diagnóstico de Secue
                </h3>
                <p className="text-[10px] text-zinc-500 font-sans mt-0.5">
                  Monitorea el estado de la base de datos IndexedDB local y el pipeline de render.
                </p>
              </div>

              {/* Estadísticas de IndexedDB */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" id="db-stats-grid">
                <div className="bg-zinc-900/50 border border-zinc-900 p-4 rounded-xl flex items-center gap-3">
                  <Database className="w-5 h-5 text-amber-500 shrink-0" />
                  <div>
                    <span className="text-[9px] text-zinc-500 uppercase font-bold block">Cortometrajes</span>
                    <span className="text-lg font-bold text-zinc-200">{stats.projectsCount}</span>
                  </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-900 p-4 rounded-xl flex items-center gap-3">
                  <Film className="w-5 h-5 text-amber-500 shrink-0" />
                  <div>
                    <span className="text-[9px] text-zinc-500 uppercase font-bold block">Planos / Shots</span>
                    <span className="text-lg font-bold text-zinc-200">{stats.shotsCount}</span>
                  </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-900 p-4 rounded-xl flex items-center gap-3">
                  <History className="w-5 h-5 text-amber-500 shrink-0" />
                  <div>
                    <span className="text-[9px] text-zinc-500 uppercase font-bold block">Historial Logs</span>
                    <span className="text-lg font-bold text-zinc-200">{stats.logsCount}</span>
                  </div>
                </div>
              </div>

              {/* Especificación de Versión */}
              <div className="bg-zinc-900/50 border border-zinc-900 p-5 rounded-xl space-y-3 text-xs leading-relaxed">
                <span className="text-xs font-bold text-zinc-300 uppercase block border-b border-zinc-850/50 pb-2">
                  Especificación de Entorno
                </span>
                <div className="space-y-1.5 font-mono text-zinc-400 text-[11px]">
                  <p>• <strong className="text-zinc-300">Client Engine:</strong> Secue Local Node Engine</p>
                  <p>• <strong className="text-zinc-300">Database Engine:</strong> IndexedDB (v1.0.0 via DexieJS wrapper)</p>
                  <p>• <strong className="text-zinc-300">Sync Mode:</strong> Híbrido offline-first con cola de subida asíncrona</p>
                  <p>• <strong className="text-zinc-300">Workspace Tenant:</strong> Secue multi-tenant local aislado</p>
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA: PANEL DEV / SEMILLERO */}
          {activeTab === "dev" && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
                  Panel de Desarrollo y Sembrado de Datos
                </h3>
                <p className="text-[10px] text-zinc-500 font-sans mt-0.5">
                  Herramientas avanzadas de diagnóstico de almacenamiento local y auditoría técnica.
                </p>
              </div>

              {/* Botonera Dev */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleSeedDefaultData}
                  className="bg-indigo-900/40 hover:bg-indigo-800/40 text-indigo-400 border border-indigo-800/40 font-bold p-4 rounded-xl flex flex-col items-center justify-center text-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-5 h-5 animate-spin-slow" />
                  <span className="text-xs font-bold uppercase">Sembrar Datos Demo</span>
                  <span className="text-[9px] text-zinc-500 font-sans">Escribe el corto de ejemplo 'Oliver y el Bosque Mágico' en IndexedDB</span>
                </button>

                <button
                  onClick={handleClearIndexedDB}
                  className="bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border border-rose-900/30 font-bold p-4 rounded-xl flex flex-col items-center justify-center text-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase">Limpiar IndexedDB</span>
                  <span className="text-[9px] text-zinc-500 font-sans">Elimina y recrea la estructura de base de datos local</span>
                </button>
              </div>

              {/* Real-time audit logs */}
              <div className="bg-zinc-900/50 border border-zinc-900 rounded-xl p-5 space-y-3">
                <span className="text-xs font-bold text-zinc-300 uppercase block border-b border-zinc-850/50 pb-2">
                  Logs de Auditoría Local Recientes
                </span>
                
                <div className="space-y-1.5 max-h-56 overflow-y-auto text-[10px] font-mono leading-relaxed pr-2">
                  {devLogs.length === 0 ? (
                    <span className="text-zinc-500 block py-4 text-center">No hay registros de auditoría aún.</span>
                  ) : (
                    devLogs.map((log) => (
                      <div key={log.id} className="border-b border-zinc-850/40 pb-1.5 text-left flex justify-between gap-4">
                        <div>
                          <strong className="text-amber-500 font-bold">[{log.action}]</strong>{" "}
                          <span className="text-zinc-400">{log.details}</span>
                        </div>
                        <span className="text-zinc-600 text-[9px] shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA: CONFIGURACIÓN DE PROYECTO */}
          {activeTab === "proyecto" && (
            <div className="space-y-6">
              {/* Selector de Proyecto en caso de no haber proyecto activo */}
              {!activeProject ? (
                <div className="max-w-2xl bg-zinc-900/40 border border-zinc-900 p-5 rounded-xl space-y-4 text-left">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                      <Film className="w-4 h-4 text-amber-500 animate-pulse" />
                      Selección de Cortometraje a Configurar
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-sans mt-0.5">
                      No hay ningún proyecto activo en este espacio de trabajo. Selecciona uno para abrir sus preferencias detalladas.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-500 block font-bold uppercase text-[9px]">Elegir Proyecto</label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 text-zinc-300 rounded p-2.5 text-xs outline-none font-bold"
                    >
                      <option value="">-- Selecciona un cortometraje --</option>
                      {projects.map((proj) => (
                        <option key={proj.id} value={proj.id}>
                          {proj.name.toUpperCase()} ({proj.productionType})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-900/20 border border-zinc-900/60 p-4 rounded-lg flex items-center justify-between max-w-4xl text-left">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Proyecto de Configuración Activo</span>
                      <span className="text-xs font-bold text-zinc-200 uppercase">{activeProject.name}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Renderizar ConfigProyectoView si existe un ID de proyecto seleccionado */}
              {selectedProjectId ? (
                <div className="pt-2" id="project-dedicated-config-view">
                  <ConfigProyectoView projectId={selectedProjectId} />
                </div>
              ) : (
                <div className="max-w-2xl bg-zinc-900/20 p-8 text-center text-zinc-500 border border-dashed border-zinc-850 rounded-xl text-xs">
                  Sube o selecciona un cortometraje arriba para ver sus canales de color 60-30-10, roles estilo Discord e integrantes.
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
