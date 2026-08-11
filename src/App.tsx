/**
 * Secue - Plataforma Web de Gestión Visual para Cortometrajes
 * SPDX-License-Identifier: AGPL-3.0
 */

import React, { useState, useEffect } from "react";
import { localDB, seedMockData } from "./db/dexie";
import { dbAdapter } from "./db/adapters";
import { Project, Shot, Asset, Daily, SoundTrack } from "./types";

// Importación de Vistas Modulares
import { DashboardView } from "./components/DashboardView";
import { ShotlistView } from "./components/ShotlistView";
import { AssetsView } from "./components/AssetsView";
import { DailiesView } from "./components/DailiesView";
import { MontajeView } from "./components/MontajeView";
import { SonidoView } from "./components/SonidoView";
import { GanttView } from "./components/GanttView";
import { GaleriaView } from "./components/GaleriaView";
import { InformesView } from "./components/InformesView";
import { ConfigProyectoView, injectProjectStyles } from "./components/ConfigProyectoView";
import { ConfigUsuarioView } from "./components/ConfigUsuarioView";
import { DocumentacionView } from "./components/DocumentacionView";
import { OmniSearch } from "./components/OmniSearch";
import { ProjectSelectionView } from "./components/ProjectSelectionView";

// Iconos lucide-react
import {
  LayoutDashboard,
  Clapperboard,
  FolderKanban,
  ClipboardCheck,
  Video,
  Music,
  Calendar,
  Image,
  BarChart3,
  Settings,
  User,
  HelpCircle,
  Sparkles,
  Wifi,
  WifiOff,
  Compass,
  Briefcase,
  Menu,
  X,
  Search
} from "lucide-react";

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeView, setActiveView] = useState<string>("dashboard");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Al cargar la app, inicializamos y cargamos datos
  useEffect(() => {
    const initializeApp = async () => {
      // 1. Sembrar datos de prueba si IndexedDB está vacía
      await seedMockData();

      // 2. Cargar proyectos
      const list = await dbAdapter.listProjects();
      setProjects(list);
    };

    initializeApp();

    // Eventos de Conectividad
    const handleOnline = () => {
      setIsOnline(true);
      // Forzar sincro automático al recuperar internet
      dbAdapter.syncPendingChanges();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Atajo global Ctrl+K para OmniSearch
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Cambiar de proyecto y sincronizar sus estilos de acento
  const handleSelectProject = (proj: Project) => {
    setActiveProject(proj);
    injectProjectStyles(proj);
  };

  // Alternar tema claro / oscuro (fatiga visual)
  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      if (next === "light") {
        document.documentElement.classList.add("light");
      } else {
        document.documentElement.classList.remove("light");
      }
      return next;
    });
  };

  // Sidebar items definition
  const sidebarItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "shotlist", label: "Shotlist", icon: Clapperboard },
    { id: "assets", label: "Assets 3D/2D", icon: FolderKanban },
    { id: "dailies", label: "Dailies & Revisión", icon: ClipboardCheck },
    { id: "montaje", label: "Montaje & Corte", icon: Video },
    { id: "sonido", label: "Sonido & Música", icon: Music },
    { id: "gantt", label: "Gantt Temporal", icon: Calendar },
    { id: "galeria", label: "Galería & Story", icon: Image },
    { id: "informes", label: "Informes & Exporte", icon: BarChart3 },
    { id: "config-proyecto", label: "Ajustes de Corto", icon: Settings },
    { id: "documentacion", label: "Ayuda Wiki & Dev", icon: HelpCircle },
  ];

  if (!activeProject) {
    if (projects.length === 0) {
      return (
        <div className="w-screen h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-500 font-mono">
          <Compass className="w-12 h-12 mb-3 text-zinc-700 animate-spin" />
          <span>Iniciando el pipeline local de Secue...</span>
        </div>
      );
    }

    return (
      <ProjectSelectionView 
        projects={projects}
        onSelectProject={(proj) => {
          setActiveProject(proj);
          injectProjectStyles(proj);
        }}
        onProjectCreated={(proj) => {
          setProjects(prev => [...prev, proj]);
          setActiveProject(proj);
          injectProjectStyles(proj);
        }}
      />
    );
  }

  return (
    <div className={`min-h-screen flex flex-col font-mono overflow-hidden transition-colors ${
      theme === "dark" 
        ? "bg-zinc-950 text-zinc-100" 
        : "bg-zinc-50 text-zinc-800"
    }`}>
      {/* Cabecera Principal */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-900/90 flex items-center justify-between px-4 shrink-0 z-40 relative">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="md:hidden text-zinc-400 hover:text-zinc-200 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-indigo-500 animate-spin" />
            <span className="font-bold tracking-wider uppercase text-sm text-zinc-100">
              Secue <span className="text-[10px] text-zinc-500 font-normal">v1.0.0</span>
            </span>
          </div>

          {/* Selector de Proyecto Multi-tenant */}
          <div className="hidden sm:flex items-center gap-1.5 ml-4 pl-4 border-l border-zinc-800">
            <Briefcase className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={activeProject?.id || ""}
              onChange={(e) => {
                if (e.target.value === "back-to-selector") {
                  setActiveProject(null);
                } else {
                  const selected = projects.find(p => p.id === e.target.value);
                  if (selected) handleSelectProject(selected);
                }
              }}
              className="bg-zinc-950/80 border border-zinc-850 rounded px-2.5 py-1 text-xs text-zinc-300 outline-none font-bold cursor-pointer"
              id="project-selector"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="back-to-selector">← Cambiar de Corto</option>
            </select>
          </div>
        </div>

        {/* Acciones y Conectividad */}
        <div className="flex items-center gap-3">
          {/* OmniSearch Trigger Button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 bg-zinc-950 hover:bg-zinc-850 text-zinc-500 hover:text-zinc-300 border border-zinc-850 rounded px-3 py-1.5 text-xs font-mono cursor-pointer transition-all"
            title="Buscar en IndexedDB (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-zinc-500" />
            <span className="hidden md:inline">Buscar...</span>
            <kbd className="hidden md:inline-block bg-zinc-900 border border-zinc-800 text-[9px] px-1 rounded">
              Ctrl+K
            </kbd>
          </button>

          {/* Botón de Configuración de Usuario Independiente */}
          <button
            onClick={() => setActiveView(activeView === "config-usuario" ? "dashboard" : "config-usuario")}
            className={`flex items-center gap-2 border rounded px-3 py-1.5 text-xs font-mono cursor-pointer transition-all ${
              activeView === "config-usuario"
                ? "bg-indigo-500 text-white border-indigo-500 font-bold"
                : "bg-zinc-950 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border-zinc-850"
            }`}
            title="Configuración de Usuario y Sistema"
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Usuario</span>
          </button>

          {/* Estado de Sincronización Remota (Firebase) */}
          <div className="flex items-center gap-1.5">
            {isOnline ? (
              <span className="flex items-center gap-1 bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 px-2.5 py-1 rounded-full text-[10px] font-bold">
                <Wifi className="w-3 h-3 text-emerald-400" />
                ONLINE
              </span>
            ) : (
              <span className="flex items-center gap-1 bg-rose-950/40 text-rose-400 border border-rose-900/40 px-2.5 py-1 rounded-full text-[10px] font-bold">
                <WifiOff className="w-3 h-3 text-rose-400" />
                OFFLINE
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Cuerpo Principal */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar de Navegación Lateral */}
        <aside className={`w-[220px] bg-zinc-900/80 border-r border-zinc-800/80 p-3 flex flex-col justify-between shrink-0 transition-transform duration-250 md:translate-x-0 z-30 ${
          mobileMenuOpen 
            ? "translate-x-0 absolute top-14 bottom-0 left-0" 
            : "-translate-x-full md:relative md:translate-x-0"
        }`}>
          <div className="space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveView(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-bold transition-all text-left cursor-pointer ${
                    activeView === item.id
                      ? "bg-indigo-500 text-white shadow-sm font-bold"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850"
                  }`}
                  id={`sidebar-item-${item.id}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-zinc-850 pt-3 text-[10px] text-zinc-500 text-center">
            Diseñado para Producción
          </div>
        </aside>

        {/* Área de Trabajo de Vistas */}
        <main className="flex-1 overflow-hidden relative">
          {activeProject ? (
            <>
              {activeView === "dashboard" && <DashboardView projectId={activeProject.id} />}
              {activeView === "shotlist" && <ShotlistView projectId={activeProject.id} />}
              {activeView === "assets" && <AssetsView projectId={activeProject.id} />}
              {activeView === "dailies" && <DailiesView projectId={activeProject.id} />}
              {activeView === "montaje" && <MontajeView projectId={activeProject.id} />}
              {activeView === "sonido" && <SonidoView projectId={activeProject.id} />}
              {activeView === "gantt" && <GanttView projectId={activeProject.id} />}
              {activeView === "galeria" && <GaleriaView projectId={activeProject.id} />}
              {activeView === "informes" && <InformesView projectId={activeProject.id} />}
              {activeView === "config-proyecto" && <ConfigProyectoView projectId={activeProject.id} />}
              {activeView === "config-usuario" && (
                <ConfigUsuarioView 
                  currentTheme={theme} 
                  onToggleTheme={toggleTheme} 
                />
              )}
              {activeView === "documentacion" && <DocumentacionView projectId={activeProject.id} />}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500">
              <Compass className="w-12 h-12 mb-3 text-zinc-700 animate-spin" />
              <span>Iniciando el pipeline local de Secue...</span>
            </div>
          )}
        </main>
      </div>

      {/* OmniSearch Portal */}
      {searchOpen && (
        <OmniSearch 
          projectId={activeProject?.id || "corto-1"} 
          onClose={() => setSearchOpen(false)} 
        />
      )}
    </div>
  );
}
