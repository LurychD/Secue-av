/**
 * Secue - Plataforma Web de Gestión Visual para Cortometrajes
 * SPDX-License-Identifier: AGPL-3.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from "react-router-dom";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "./firebase";
import { localDB, seedMockData } from "./db/dexie";
import { dbAdapter } from "./db/adapters";
import { Project, Shot, Asset, Daily, SoundTrack } from "./types";

// Importación de Vistas Modulares e Integración de Autenticación
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
import { ProjectSelectionView } from "./components/ProjectSelectionView";
import { ConfigGeneralView } from "./components/ConfigGeneralView";
import { LoginView } from "./components/LoginView";
import { AccesoDenegadoView } from "./components/AccesoDenegadoView";
import { ProtectedRoute } from "./components/ProtectedRoute";

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
  User as UserIcon,
  HelpCircle,
  Sparkles,
  Wifi,
  WifiOff,
  Compass,
  Briefcase,
  Menu,
  X,
  Search,
  Check,
  Home,
  LogOut
} from "lucide-react";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeView, setActiveView] = useState<string>("dashboard");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Estado para la pantalla de carga inicial dinámica
  const [appLoading, setAppLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState("Iniciando...");

  // Estado para el buscador integrado Omnibox
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{
    shots: any[];
    assets: any[];
    actions: { label: string; view: string }[];
    projects: Project[];
  }>({ shots: [], assets: [], actions: [], projects: [] });
  const [searchFocused, setSearchFocused] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Estados y Refs para Sincronización Offline-First
  const [pendingChangesCount, setPendingChangesCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const pendingCountRef = useRef(0);

  // Sincronizar recuento de pendientes en el Ref para antes de salir de la pestaña
  useEffect(() => {
    pendingCountRef.current = pendingChangesCount;
  }, [pendingChangesCount]);

  const updatePendingCount = async () => {
    try {
      const count = await localDB.pendingSync.count();
      setPendingChangesCount(count);
    } catch (e) {
      console.warn("Fallo al contar pendientes:", e);
    }
  };

  const handleSyncPending = async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    try {
      await dbAdapter.syncPendingChanges();
      await updatePendingCount();
    } catch (err) {
      console.warn("Fallo de fondo al sincronizar cambios pendientes:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Al cargar la app, inicializamos y cargamos datos secuencialmente
  useEffect(() => {
    const steps = [
      "Cargando base de datos local (DexieJS)...",
      "Verificando credenciales de acceso seguro...",
      "Sincronizando planos y cronogramas con secue-db...",
      "Cargando biblioteca de assets y foleys...",
      "Inicializando interfaz gráfica optimizada..."
    ];

    let currentStep = 0;
    setLoadingStep(steps[0]);

    const stepInterval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length) {
        setLoadingStep(steps[currentStep]);
      }
    }, 600);

    const initializeApp = async () => {
      try {
        setLoadingStep("Abriendo base de datos local...");
        await localDB.open();

        setLoadingStep("Verificando registros...");
        await seedMockData();

        // Cargar datos locales de inmediato
        const localList = await localDB.projects.toArray();
        setProjects(localList);

        // Desactivar pantalla de carga inmediatamente sin demoras artificiales
        clearInterval(stepInterval);
        setAppLoading(false);

        // Cargar recuento inicial de pendientes
        updatePendingCount();

        // Intentar sincronización inicial de fondo si hay conexión
        if (navigator.onLine) {
          handleSyncPending();
        }

        // Sincronizar de fondo asincrónicamente
        dbAdapter.listProjects().then((remoteList) => {
          if (remoteList && remoteList.length > 0) {
            setProjects(remoteList);
          }
        }).catch(err => {
          console.warn("Fallo de fondo al listar proyectos remotos:", err);
        });

      } catch (err) {
        console.error("Error cargando base de datos, usando respaldo:", err);
        clearInterval(stepInterval);
        setAppLoading(false);
      }
    };

    initializeApp();

    // Verificación periódica de recuento de pendientes
    const pendingCheckInterval = setInterval(updatePendingCount, 4000);

    // Eventos de Conectividad
    const handleOnline = () => {
      setIsOnline(true);
      handleSyncPending();
    };
    const handleOffline = () => {
      setIsOnline(false);
      updatePendingCount();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Escuchar actualizaciones en Dexie
    const handleLocalDbUpdated = () => {
      updatePendingCount();
    };
    window.addEventListener("local-db-updated", handleLocalDbUpdated);

    // Atajarse del cierre de pestaña si hay cambios pendientes
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingCountRef.current > 0) {
        e.preventDefault();
        e.returnValue = "Tenés cambios locales pendientes de sincronización. Si cerrás la pestaña, podrías perderlos hasta que vuelvas a conectarte.";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Atajo global Ctrl+K para enfocar la barra de búsqueda Omnibox
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("local-db-updated", handleLocalDbUpdated);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("keydown", handleKeyDown);
      clearInterval(stepInterval);
      clearInterval(pendingCheckInterval);
    };
  }, []);

  // 1. Observador de estado de autenticación de Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Sincronizar ruta actual de React Router con los estados activeProject y activeView
  useEffect(() => {
    const pathParts = location.pathname.split("/").filter(Boolean);
    
    if (pathParts[0] === "proyecto" && pathParts[1]) {
      const pId = pathParts[1];
      const vId = pathParts[2] || "dashboard";
      
      const found = projects.find(p => p.id === pId);
      if (found) {
        if (activeProject?.id !== pId) {
          setActiveProject(found);
          injectProjectStyles(found);
        }
        if (activeView !== vId) {
          setActiveView(vId);
        }
      }
    } else {
      // Si no es una ruta de proyecto (como / o /proyectos)
      if (activeProject !== null) {
        setActiveProject(null);
      }
      if (location.pathname === "/config-general" && activeView !== "config-general") {
        setActiveView("config-general");
      }
    }
  }, [location.pathname, projects]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveProject(null);
      setActiveView("dashboard");
      navigate("/login");
    } catch (err) {
      console.warn("Fallo al cerrar sesión:", err);
    }
  };

  // Efecto del motor de búsqueda Omnibox integrado
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ shots: [], assets: [], actions: [], projects: [] });
      return;
    }

    const searchLocal = async () => {
      const q = searchQuery.toLowerCase();

      // Mapeo de vistas del sidebar
      const allActions = [
        { label: "Ir a Dashboard General", view: "dashboard" },
        { label: "Ir a Lista de Planos (Shotlist)", view: "shotlist" },
        { label: "Ir a Inventario de Assets", view: "assets" },
        { label: "Ir a Control de Dailies (Aprobaciones)", view: "dailies" },
        { label: "Ir a Cortometraje (Módulo Montaje)", view: "montaje" },
        { label: "Ir a Foleys y Sonido", view: "sonido" },
        { label: "Ir a Gantt de Planificación", view: "gantt" },
        { label: "Ir a Storyboard y Galería", view: "galeria" },
        { label: "Ir a Reportes Técnicos", view: "informes" },
        { label: "Ir a Ajustes del Corto", view: "config-proyecto" },
        { label: "Ir a Wiki de Ayuda", view: "documentacion" }
      ];

      const matchedActions = allActions.filter(act => act.label.toLowerCase().includes(q));
      const matchedProjects = projects.filter(p => p.name.toLowerCase().includes(q));

      let matchedShots: any[] = [];
      let matchedAssets: any[] = [];

      if (activeProject) {
        matchedShots = await localDB.shots
          .where("projectId")
          .equals(activeProject.id)
          .filter(shot =>
            shot.id.includes(q) ||
            shot.cameraNotes.toLowerCase().includes(q) ||
            shot.directorNotes.toLowerCase().includes(q)
          )
          .limit(4)
          .toArray();

        matchedAssets = await localDB.assets
          .where("projectId")
          .equals(activeProject.id)
          .filter(asset =>
            asset.name.toLowerCase().includes(q) ||
            asset.category.toLowerCase().includes(q) ||
            (asset.comments && asset.comments.toLowerCase().includes(q))
          )
          .limit(4)
          .toArray();
      }

      setSearchResults({
        shots: matchedShots,
        assets: matchedAssets,
        actions: matchedActions,
        projects: matchedProjects
      });
    };

    searchLocal();
  }, [searchQuery, activeProject, projects]);

  // Cambiar de proyecto y sincronizar sus estilos de acento
  const handleSelectProject = (proj: Project) => {
    setActiveProject(proj);
    injectProjectStyles(proj);
    setSearchQuery("");
  };

  // Alternar tema claro / oscuro
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

  // Pantalla de Carga Dinámica Inicial
  if (authChecking || appLoading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-200 font-mono p-6 select-none" id="app-loading-screen">
        <div className="flex flex-col items-center max-w-sm w-full text-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-amber-500/10 blur-xl rounded-full animate-ping" />
            <Clapperboard className="w-16 h-16 text-amber-500 relative z-10 animate-pulse" />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold uppercase tracking-widest text-zinc-100">
              SECUE <span className="text-xs text-zinc-500 font-normal">v1.0.0</span>
            </h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
              Gestión de Cortometrajes
            </p>
          </div>

          <div className="w-full h-1 bg-zinc-900 border border-zinc-850 rounded-full overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-300"
              style={{
                width:
                  authChecking ? "40%" :
                  loadingStep.includes("DexieJS") ? "25%" :
                  loadingStep.includes("credenciales") ? "50%" :
                  loadingStep.includes("sincronizando") ? "75%" :
                  loadingStep.includes("assets") ? "90%" : "100%"
              }}
            />
          </div>

          <div className="h-6 flex items-center justify-center">
            <span className="text-[10px] text-zinc-400 animate-pulse font-mono tracking-wider uppercase">
              {authChecking ? "Estableciendo conexión segura..." : loadingStep}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={
        currentUser ? <Navigate to="/" replace /> : <LoginView onAuthSuccess={() => {}} />
      } />
      
      <Route path="/403" element={
        <AccesoDenegadoView 
          onReturnToProjects={() => navigate("/")} 
          userEmail={currentUser?.email} 
        />
      } />

      <Route path="/*" element={
        <ProtectedRoute>
          <div className={`min-h-screen flex flex-col font-mono overflow-x-hidden relative transition-colors ${
            theme === "dark"
              ? "bg-zinc-950 text-zinc-100"
              : "bg-zinc-50 text-zinc-800"
          }`} id="app-root-container">

      {/* CABECERA SUPERIOR GLOBAL PERSISTENTE */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900/95 flex items-center justify-between px-4 sm:px-6 shrink-0 z-40 relative select-none" id="global-persistent-header">
        {/* Lado Izquierdo: Icono Claqueta y Nombre o Botón de Casa para regresar a selección de proyectos */}
        <div className="flex items-center gap-3">
          {(activeProject || activeView === "config-general") ? (
            <button
              onClick={() => {
                navigate("/");
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-zinc-850 hover:border-zinc-750 text-zinc-300 hover:text-zinc-100 transition-all font-bold text-xs cursor-pointer group"
              title="Regresar a Proyectos"
              id="header-home-button"
            >
              <Home className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Inicio</span>
            </button>
          ) : (
            <div className="flex items-center gap-2.5">
              <Clapperboard className="w-5.5 h-5.5 text-amber-500 shrink-0" />
              <span className="font-bold tracking-wider uppercase text-xs sm:text-sm text-zinc-100">
                Secue
              </span>
            </div>
          )}

          {/* Selector rápido de cortometraje (Solo si hay proyecto y no es móvil) */}
          {activeProject && projects.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 ml-4 pl-4 border-l border-zinc-800">
              <Briefcase className="w-3.5 h-3.5 text-zinc-500" />
              <select
                value={activeProject.id}
                onChange={(e) => {
                  if (e.target.value === "back-to-selector") {
                    navigate("/");
                  } else {
                    navigate(`/proyecto/${e.target.value}/dashboard`);
                  }
                }}
                className="bg-zinc-950/80 border border-zinc-850 rounded px-2 py-0.5 text-[10px] text-zinc-400 outline-none font-bold cursor-pointer"
                id="project-header-selector"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value="back-to-selector">← Cambiar Proyecto</option>
              </select>
            </div>
          )}
        </div>

        {/* Centro: Barra de búsqueda Omnibox siempre visible */}
        <div className="relative flex-1 max-w-xs sm:max-w-md mx-3">
          <div className="relative flex items-center bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-1.5 text-xs text-zinc-300">
            <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0 mr-2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar planos, assets, cortometrajes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              className="w-full bg-transparent border-none outline-none text-zinc-100 placeholder-zinc-500 font-mono text-[10px] sm:text-[11px]"
              id="omnibox-input"
            />
            <kbd className="hidden sm:inline-block bg-zinc-900 border border-zinc-800 text-[8px] px-1.5 py-0.5 rounded text-zinc-500 font-mono">
              Ctrl+K
            </kbd>
          </div>

          {/* Menú desplegable Omnibox */}
          {searchFocused && (searchQuery.trim() || searchResults.actions.length > 0) && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-zinc-900/95 border border-zinc-800 rounded-lg shadow-2xl p-3 z-50 max-h-[70vh] overflow-y-auto space-y-3" id="omnibox-results-dropdown">
              {/* Proyectos */}
              {searchResults.projects.length > 0 && (
                <div>
                  <h4 className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold mb-1 px-1">Cortometrajes</h4>
                  <div className="space-y-0.5">
                    {searchResults.projects.map(proj => (
                      <button
                        key={proj.id}
                        onMouseDown={() => navigate(`/proyecto/${proj.id}/dashboard`)}
                        className="w-full text-left px-2 py-1 rounded text-[10px] text-zinc-300 hover:text-zinc-100 hover:bg-zinc-850 flex items-center gap-2"
                      >
                        <Briefcase className="w-3.5 h-3.5 text-amber-500" />
                        <span>{proj.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Vistas / Accesos directos */}
              {searchResults.actions.length > 0 && (
                <div>
                  <h4 className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold mb-1 px-1">Vistas y Atajos</h4>
                  <div className="space-y-0.5">
                    {searchResults.actions.map(act => (
                      <button
                        key={act.view}
                        onMouseDown={() => {
                          if (activeProject) {
                            navigate(`/proyecto/${activeProject.id}/${act.view}`);
                          } else if (projects.length > 0) {
                            navigate(`/proyecto/${projects[0].id}/${act.view}`);
                          } else {
                            setActiveView(act.view);
                          }
                          setSearchQuery("");
                        }}
                        className="w-full text-left px-2 py-1 rounded text-[10px] text-zinc-300 hover:text-zinc-100 hover:bg-zinc-850 flex items-center gap-2"
                      >
                        <Compass className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{act.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Planos (Solo si hay un corto activo) */}
              {activeProject && searchResults.shots.length > 0 && (
                <div>
                  <h4 className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold mb-1 px-1">Shotlist del Corto</h4>
                  <div className="space-y-0.5">
                    {searchResults.shots.map(shot => (
                      <button
                        key={shot.uuid}
                        onMouseDown={() => {
                          navigate(`/proyecto/${activeProject.id}/shotlist`);
                          setSearchQuery("");
                        }}
                        className="w-full text-left px-2 py-1 rounded text-[10px] text-zinc-300 hover:text-zinc-100 hover:bg-zinc-850 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Clapperboard className="w-3.5 h-3.5 text-amber-500" />
                          <span>Plano {shot.id}</span>
                        </div>
                        <span className="text-[8px] text-zinc-500 truncate max-w-[120px]">{shot.cameraNotes}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Assets (Solo si hay un corto activo) */}
              {activeProject && searchResults.assets.length > 0 && (
                <div>
                  <h4 className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold mb-1 px-1">Assets 3D/2D</h4>
                  <div className="space-y-0.5">
                    {searchResults.assets.map(asset => (
                      <button
                        key={asset.id}
                        onMouseDown={() => {
                          navigate(`/proyecto/${activeProject.id}/assets`);
                          setSearchQuery("");
                        }}
                        className="w-full text-left px-2 py-1 rounded text-[10px] text-zinc-300 hover:text-zinc-100 hover:bg-zinc-850 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <FolderKanban className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{asset.name}</span>
                        </div>
                        <span className="text-[8px] text-zinc-500 truncate max-w-[120px]">{asset.category}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchQuery.trim() &&
               searchResults.projects.length === 0 &&
               searchResults.actions.length === 0 &&
               searchResults.shots.length === 0 &&
               searchResults.assets.length === 0 && (
                <div className="text-center py-4 text-zinc-500 text-[10px]">
                  No se encontraron resultados para "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lado Derecho: Conectividad y Botón Configuración de Proyecto */}
        <div className="flex items-center gap-2.5">
          {/* Conectividad e Indicador de Sincronización */}
          <div className="hidden sm:flex items-center gap-2" id="sync-connectivity-indicator">
            {isSyncing ? (
              <span className="flex items-center gap-1.5 bg-amber-950/40 text-amber-400 border border-amber-900/30 px-2.5 py-1 rounded-full text-[10px] font-bold animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                Sincronizando...
              </span>
            ) : !isOnline ? (
              <span className="flex items-center gap-1.5 bg-rose-950/40 text-rose-400 border border-rose-900/30 px-2.5 py-1 rounded-full text-[10px] font-bold" title="No hay conexión a internet">
                <WifiOff className="w-3.5 h-3.5 shrink-0" />
                <span>Sin conexión {pendingChangesCount > 0 && `· ${pendingChangesCount} pend.`}</span>
              </span>
            ) : pendingChangesCount > 0 ? (
              <button 
                onClick={handleSyncPending}
                className="flex items-center gap-1.5 bg-amber-950/40 hover:bg-amber-900/50 text-amber-400 border border-amber-900/30 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer" 
                title="Sincronizar cambios pendientes ahora"
              >
                <Wifi className="w-3.5 h-3.5 shrink-0" />
                <span>{pendingChangesCount} camb. pendientes</span>
              </button>
            ) : (
              <span className="flex items-center gap-1.5 bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-2.5 py-1 rounded-full text-[10px] font-bold" title="Todos los cambios están a salvo en la nube">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>Sincronizado</span>
              </span>
            )}
          </div>

          {/* Botón de Configuración General Unificada */}
          <button
            onClick={() => {
              if (activeProject) {
                navigate(`/proyecto/${activeProject.id}/config-general`);
              } else {
                navigate("/config-general");
              }
            }}
            className={`p-1.5 sm:p-2 rounded-lg cursor-pointer border transition-colors ${
              activeView === "config-general"
                ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border-transparent"
            }`}
            title="Configuración General Unificada"
            id="global-settings-button"
          >
            <Settings className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* Trigger menú lateral para móvil (Despliega desde la DERECHA) */}
          <button
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="md:hidden p-1.5 text-zinc-400 hover:text-zinc-200 cursor-pointer shrink-0"
            id="mobile-drawer-trigger"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-amber-500" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* CUERPO PRINCIPAL ABAJO DE LA CABECERA */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* BACKDROP PARA MOVIL CUANDO EL MENU ESTÁ DESPLEGADO */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
            id="mobile-menu-backdrop"
          />
        )}

        {/* SIDEBAR DE NAVEGACIÓN LATERAL (DESPLIEGA DESDE LA DERECHA EN MÓVILES) */}
        <aside className={`w-[220px] bg-zinc-900/95 border-l md:border-r md:border-l-0 border-zinc-800 p-3 flex flex-col justify-between shrink-0 transition-transform duration-300 md:translate-x-0 z-40 fixed md:relative top-16 bottom-0 right-0 md:right-auto ${
          mobileMenuOpen
            ? "translate-x-0"
            : "translate-x-full md:translate-x-0"
        }`} id="app-sidebar-lateral">
          <div className="space-y-1 overflow-y-auto max-h-[80vh] scrollbar-none">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block px-3 py-1 mb-1">Navegación</span>
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (activeProject) {
                      navigate(`/proyecto/${activeProject.id}/${item.id}`);
                    } else {
                      setActiveView(item.id);
                    }
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-bold transition-all text-left cursor-pointer ${
                    activeView === item.id
                      ? "bg-amber-500 text-zinc-950 shadow-sm font-bold"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850"
                  }`}
                  id={`sidebar-item-${item.id}`}
                >
                  <Icon className="w-4 h-4 shrink-0 text-inherit" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2 mt-4 pt-3 border-t border-zinc-850">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 transition-all text-left cursor-pointer"
              id="sidebar-logout-button"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Cerrar Sesión</span>
            </button>
            <div className="text-[9px] text-zinc-500 text-center select-none">
              Secue © 2026
            </div>
          </div>
        </aside>

        {/* ÁREA DE TRABAJO DE VISTAS */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative pb-16 md:pb-0" id="main-view-viewport">
          {activeView === "config-general" ? (
            <ConfigGeneralView
              currentTheme={theme}
              onToggleTheme={toggleTheme}
              activeProject={activeProject}
              projects={projects}
              onSelectProject={(proj) => {
                navigate(`/proyecto/${proj.id}/dashboard`);
              }}
              onClose={() => {
                if (activeProject) {
                  navigate(`/proyecto/${activeProject.id}/dashboard`);
                } else {
                  navigate("/");
                }
              }}
            />
          ) : activeProject ? (
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
            <ProjectSelectionView
              projects={projects}
              onSelectProject={(proj) => {
                navigate(`/proyecto/${proj.id}/dashboard`);
              }}
              onProjectCreated={(proj) => {
                setProjects(prev => [...prev, proj]);
                navigate(`/proyecto/${proj.id}/dashboard`);
              }}
            />
          )}
        </main>
      </div>

      {/* BARRA DE NAVEGACIÓN INFERIOR PERSISTENTE EN MÓVILES - SOLO SI HAY PROYECTO ACTIVO */}
      {activeProject && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-zinc-900 border-t border-zinc-800 flex items-center justify-around px-2 z-40 select-none pb-safe" id="mobile-persistent-bottom-nav">
          {/* 1. Informes en el extremo izquierdo */}
          <button
            onClick={() => {
              navigate(`/proyecto/${activeProject.id}/informes`);
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
              activeView === "informes" ? "text-amber-500" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Informes y Reportes"
          >
            <BarChart3 className="w-5 h-5 shrink-0" />
            <span className="text-[8px] font-bold mt-1 uppercase tracking-wider">Informes</span>
          </button>

          {/* 2. Shotlist */}
          <button
            onClick={() => {
              navigate(`/proyecto/${activeProject.id}/shotlist`);
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
              activeView === "shotlist" ? "text-amber-500" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Plan de Rodaje"
          >
            <Clapperboard className="w-5 h-5 shrink-0" />
            <span className="text-[8px] font-bold mt-1 uppercase tracking-wider">Shotlist</span>
          </button>

          {/* 3. Assets */}
          <button
            onClick={() => {
              navigate(`/proyecto/${activeProject.id}/assets`);
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
              activeView === "assets" ? "text-amber-500" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Assets 3D/2D"
          >
            <FolderKanban className="w-5 h-5 shrink-0" />
            <span className="text-[8px] font-bold mt-1 uppercase tracking-wider">Assets</span>
          </button>

          {/* 4. Renders Dailies */}
          <button
            onClick={() => {
              navigate(`/proyecto/${activeProject.id}/dailies`);
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
              activeView === "dailies" ? "text-amber-500" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Aprobación de Renders"
          >
            <ClipboardCheck className="w-5 h-5 shrink-0" />
            <span className="text-[8px] font-bold mt-1 uppercase tracking-wider">Dailies</span>
          </button>

          {/* 5. Alertas / Calendario */}
          <button
            onClick={() => {
              navigate(`/proyecto/${activeProject.id}/gantt`);
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
              activeView === "gantt" ? "text-amber-500" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Calendario Gantt"
          >
            <Calendar className="w-5 h-5 shrink-0" />
            <span className="text-[8px] font-bold mt-1 uppercase tracking-wider">Alertas</span>
          </button>

          {/* 6. Sonido */}
          <button
            onClick={() => {
              navigate(`/proyecto/${activeProject.id}/sonido`);
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
              activeView === "sonido" ? "text-amber-500" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Sonido & Foley"
          >
            <Music className="w-5 h-5 shrink-0" />
            <span className="text-[8px] font-bold mt-1 uppercase tracking-wider">Sonido</span>
          </button>
        </nav>
      )}
    </div>
        </ProtectedRoute>
      } />
    </Routes>
  );
}
