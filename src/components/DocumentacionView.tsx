/**
 * Secue - Wikipedia de Ayuda, Diagnóstico de Conexión y Panel Dev de Monitoreo
 * SPDX-License-Identifier: AGPL-3.0
 */

import React, { useState, useEffect } from "react";
import { localDB } from "../db/dexie";
import { dbAdapter } from "../db/adapters";
import { Project, HelpArticle } from "../types";
import { HelpCircle, Search, Terminal, Database, Activity, RefreshCw, FileText, CheckCircle2, ShieldCheck } from "lucide-react";

interface DocumentacionViewProps {
  projectId: string;
}

export const DocumentacionView: React.FC<DocumentacionViewProps> = ({ projectId }) => {
  const [query, setQuery] = useState("");
  const [activeArticle, setActiveArticle] = useState<string>("conceptos-base");
  const [activeTab, setActiveTab] = useState<"wiki" | "dev">("wiki");
  
  // Datos diagnósticos de sincronización
  const [connectionStatus, setConnectionStatus] = useState<"Conectado" | "Offline">("Conectado");
  const [pendingChangesCount, setPendingChangesCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);

  // Wikipedia Help Articles
  const [articles, setArticles] = useState<HelpArticle[]>([
    {
      id: "conceptos-base",
      title: "Conceptos Fundamentales de Secue",
      slug: "conceptos-base",
      content: `## Guía Operativa de Secue

Secue funciona como un **centro de mando visual** y ágil para el pipeline de animación independiente.

### Estructura de Trabajo
1. **Shotlist**: Lista ordenable de planos cinematográficos con numeración flexible.
2. **Assets**: Biblioteca de modelos, rigs, sets y props necesarios.
3. **Dailies**: Archivos cargados por artistas listos para revisión y aprobación del director.
4. **Sonido**: Pistas musicales sincronizadas marco a marco basadas en timecode.

### Filosofía Anti-Slop
* **Estructura Plana**: En lugar de anidar tarjetas complejas, se privilegia la fluidez y el espaciado geométrico.
* **Trazabilidad Absoluta**: Cada cambio de estado genera registros inmutables de auditoría técnica.`
    },
    {
      id: "pipeline-stopmotion",
      title: "Pipeline de Animación Stop Motion",
      slug: "pipeline-stopmotion",
      content: `## Producción Stop Motion con Secue

La producción física de stop-motion requiere extrema precisión debido a que la animación se realiza de forma destructiva y directa sobre el set físico.

### Pasos en Secue
* **Layout**: Definir el lente, posición de cámara y marcas físicas del set.
* **Animación (Captura)**: Capturar las pose-a-pose de plastilina o armaduras.
* **Iluminación**: Sincronizar flashes de rebotes de luz física.
* **Dailies**: Cargar renders dailies en Secue al final del día para la revisión crítica del director.`
    },
    {
      id: "explicacion-adapter",
      title: "Patrón Adaptador y Sincronización",
      slug: "explicacion-adapter",
      content: `## Arquitectura de Sincronización Offline First

Secue implementa el patrón **Adaptador Doble** para independizar las vistas de la infraestructura remota.

### IndexedDB y DexieJS
* Los datos se leen y escriben instantáneamente en la base IndexedDB local del navegador.
* Si el dispositivo está sin conexión, los cambios se acumulan en la cola de cambios pendientes \`pendingSync\`.

### Fusión Granular Campo por Campo
* Al recuperar conexión, Secue compara los campos modificados de forma independiente.
* Evita el clásico "Last Write Wins" total sobreescribiendo solo las propiedades modificadas.`
    }
  ]);

  const updateDiagnostics = async () => {
    const count = await localDB.pendingSync.count();
    setPendingChangesCount(count);
    setConnectionStatus(navigator.onLine ? "Conectado" : "Offline");
  };

  useEffect(() => {
    updateDiagnostics();
    const interval = setInterval(updateDiagnostics, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Iniciando sincronización manual...`]);
    
    try {
      // 1. Vaciar cola local pending_sync
      const pendingCount = await localDB.pendingSync.count();
      if (pendingCount > 0) {
        setSyncLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Procesando ${pendingCount} transacciones locales pendientes...`]);
        await dbAdapter.syncPendingChanges();
      }
      
      // 2. Traer novedades remotas
      const pullResult = await dbAdapter.pullRemoteChanges(projectId);
      setSyncLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Sincronización finalizada. Novedades descargadas: ${pullResult.updated}.`
      ]);
      if (pullResult.conflicts.length > 0) {
        pullResult.conflicts.forEach(conflict => {
          setSyncLogs((prev) => [...prev, `[RESOLUCIÓN] ${conflict}`]);
        });
      }
    } catch (e: any) {
      setSyncLogs((prev) => [...prev, `[ERROR] Falló sincronización remota: ${e.message}`]);
    } finally {
      setIsSyncing(false);
      await updateDiagnostics();
    }
  };

  const filteredArticles = articles.filter(art => 
    art.title.toLowerCase().includes(query.toLowerCase()) || 
    art.content.toLowerCase().includes(query.toLowerCase())
  );

  const activeArticleObj = articles.find(a => a.id === activeArticle);

  return (
    <div className="flex h-full font-mono text-zinc-200 overflow-hidden" id="documentacion-view-container">
      {/* Columna Izquierda - Buscador e Índice de Artículos */}
      <div className="w-[280px] border-r border-zinc-800 bg-zinc-900/95 flex flex-col h-full overflow-hidden shrink-0">
        <div className="p-4 border-b border-zinc-800 bg-zinc-900">
          <span className="text-[10px] text-zinc-500 uppercase block font-bold">Ayuda e Instrumentos</span>
          <h4 className="text-sm font-bold text-amber-500">Documentación & Dev</h4>
        </div>

        {/* Selector de Modos */}
        <div className="p-3 border-b border-zinc-800 flex gap-2">
          <button
            onClick={() => setActiveTab("wiki")}
            className={`flex-1 py-1 px-2 rounded text-[10px] font-bold cursor-pointer uppercase tracking-wider transition-colors border ${
              activeTab === "wiki"
                ? "bg-zinc-850 text-amber-400 border-zinc-700"
                : "text-zinc-500 hover:text-zinc-300 border-transparent"
            }`}
          >
            Wikipedia
          </button>
          <button
            onClick={() => setActiveTab("dev")}
            className={`flex-1 py-1 px-2 rounded text-[10px] font-bold cursor-pointer uppercase tracking-wider transition-colors border ${
              activeTab === "dev"
                ? "bg-zinc-850 text-rose-400 border-zinc-700"
                : "text-zinc-500 hover:text-zinc-300 border-transparent"
            }`}
          >
            Dev Panel
          </button>
        </div>

        {activeTab === "wiki" ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Input Buscador */}
            <div className="p-3 border-b border-zinc-800/80 flex items-center gap-2 bg-zinc-950/20">
              <Search className="w-4 h-4 text-zinc-500 shrink-0" />
              <input
                type="text"
                placeholder="Buscar artículo..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent border-none text-xs text-zinc-300 outline-none placeholder-zinc-600"
              />
            </div>

            {/* Lista de páginas */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {filteredArticles.map((art) => (
                <button
                  key={art.id}
                  onClick={() => setActiveArticle(art.id)}
                  className={`w-full text-left p-2 rounded text-xs transition-colors flex items-center gap-2 cursor-pointer ${
                    activeArticle === art.id
                      ? "bg-zinc-800 text-amber-400 font-bold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{art.title}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Pestaña del Diagnóstico de Red / Sincronización */
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-left">
            <span className="text-[10px] text-zinc-500 uppercase font-bold block">Diagnóstico de Enlace</span>
            
            <div className="space-y-3 bg-zinc-950/40 p-3 rounded-lg border border-zinc-850">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Conexión:</span>
                <span className={`font-bold ${connectionStatus === "Conectado" ? "text-emerald-400" : "text-rose-400"}`}>
                  {connectionStatus}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Pendientes en IndexedDB:</span>
                <span className="font-bold text-zinc-300 font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                  {pendingChangesCount} cambs
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Licencia:</span>
                <span className="font-bold text-zinc-400">GNU AGPL v3.0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">DB Remota:</span>
                <span className="text-zinc-400 font-bold">secue-db</span>
              </div>
            </div>

            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="w-full flex items-center justify-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-zinc-950 font-bold py-2 rounded text-xs cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Forzando Sync..." : "Forzar Sync Firestore"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Contenido Derecho de Visualización */}
      <div className="flex-1 overflow-y-auto p-6" id="documentation-content-viewer">
        {activeTab === "wiki" ? (
          activeArticleObj ? (
            <div className="max-w-2xl text-left space-y-4 font-sans leading-relaxed text-zinc-300">
              <h2 className="text-2xl font-bold font-mono text-zinc-100 border-b border-zinc-800 pb-3">
                {activeArticleObj.title}
              </h2>
              {/* Render de Markdown simple sin dependencias externas complejas de React-Markdown */}
              <div className="space-y-4 whitespace-pre-wrap text-sm">
                {activeArticleObj.content}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-zinc-600">
              <HelpCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <span>Selecciona un artículo para leer la documentación técnica</span>
            </div>
          )
        ) : (
          /* Consola de Logs del Desarrollador (Panel Dev) */
          <div className="flex flex-col h-full space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <h3 className="text-sm font-bold text-rose-400 flex items-center gap-1.5 font-mono">
                <Terminal className="w-4 h-4 text-rose-500" />
                Panel Dev - Consola de Auditoría y Transacciones Offline
              </h3>
              <span className="text-[10px] text-zinc-500 uppercase font-mono">Modo Administrador</span>
            </div>

            <div className="flex-1 bg-zinc-950 rounded-xl border border-zinc-900 p-4 font-mono text-xs text-emerald-400 overflow-y-auto space-y-2 text-left shadow-inner">
              <div className="text-zinc-600 border-b border-zinc-900 pb-2 mb-2">
                &gt; Secue Offline First Replication Engine v1.0.0 Inicializado.
                <br />
                &gt; Esperando transacciones locales o sincronizaciones manuales remotos...
              </div>

              {syncLogs.map((log, idx) => (
                <div key={idx} className="leading-relaxed">
                  &gt; {log}
                </div>
              ))}
              
              {syncLogs.length === 0 && (
                <span className="text-zinc-600 italic">No hay logs de transacciones registradas en esta sesión.</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
