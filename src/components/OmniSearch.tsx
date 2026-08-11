/**
 * Secue - Buscador Principal Omni con Atajos de Teclado
 * SPDX-License-Identifier: AGPL-3.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Search, Film, Package, Users, FileText, Command } from "lucide-react";
import { localDB } from "../db/dexie";
import { Shot, Asset, ProjectMember } from "../types";

interface OmniSearchProps {
  projectId: string;
  onSelectShot: (id: string) => void;
  onSelectAsset: (id: string) => void;
  onSelectView: (view: string) => void;
}

export const OmniSearch: React.FC<OmniSearchProps> = ({
  projectId,
  onSelectShot,
  onSelectAsset,
  onSelectView
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{
    shots: Shot[];
    assets: Asset[];
    members: ProjectMember[];
    actions: { label: string; view: string }[];
  }>({ shots: [], assets: [], members: [], actions: [] });

  const inputRef = useRef<HTMLInputElement>(null);

  // Atajo de teclado: Ctrl + K o Cmd + K para abrir/cerrar buscador
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Enfocar input al abrir
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Realizar búsqueda instantánea sobre IndexedDB
  useEffect(() => {
    if (!query.trim()) {
      setResults({ shots: [], assets: [], members: [], actions: [] });
      return;
    }

    const searchLocalData = async () => {
      const normalizedQuery = query.toLowerCase();

      // Buscar shots
      const shots = await localDB.shots
        .where("projectId")
        .equals(projectId)
        .filter((shot) => 
          shot.id.includes(normalizedQuery) ||
          shot.cameraNotes.toLowerCase().includes(normalizedQuery) ||
          shot.directorNotes.toLowerCase().includes(normalizedQuery)
        )
        .limit(5)
        .toArray();

      // Buscar assets
      const assets = await localDB.assets
        .where("projectId")
        .equals(projectId)
        .filter((asset) =>
          asset.name.toLowerCase().includes(normalizedQuery) ||
          asset.category.toLowerCase().includes(normalizedQuery) ||
          asset.comments.toLowerCase().includes(normalizedQuery)
        )
        .limit(5)
        .toArray();

      // Buscar miembros
      const project = await localDB.projects.get(projectId);
      const members = project
        ? project.members.filter(
            (m) =>
              m.name.toLowerCase().includes(normalizedQuery) ||
              m.email.toLowerCase().includes(normalizedQuery) ||
              m.role.toLowerCase().includes(normalizedQuery)
          )
        : [];

      // Acciones rápidas / Vistas de la aplicación
      const allActions = [
        { label: "Ir a Dashboard General", view: "dashboard" },
        { label: "Ir a Lista de Planos (Shotlist)", view: "shotlist" },
        { label: "Ir a Inventario de Assets", view: "assets" },
        { label: "Ir a Control de Dailies (Aprobaciones)", view: "dailies" },
        { label: "Ir a Control de Versiones de Montaje", view: "montaje" },
        { label: "Ir a Formas de Onda y Sonido", view: "sonido" },
        { label: "Ir a Diagrama de Gantt", view: "gantt" },
        { label: "Ir a Galería Global de Storyboards", view: "galeria" },
        { label: "Ir a Informes de Producción", view: "informes" },
        { label: "Ir a Ajustes de Proyecto", view: "config-proyecto" },
        { label: "Ir a Centro de Documentación Wikipedia", view: "documentacion" }
      ];
      const actions = allActions.filter((act) =>
        act.label.toLowerCase().includes(normalizedQuery)
      );

      setResults({ shots, assets, members, actions });
    };

    searchLocalData();
  }, [query, projectId]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 text-zinc-400 text-sm transition-colors cursor-pointer"
        id="omni-search-trigger"
      >
        <Search className="w-4 h-4" />
        <span>Buscar...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[10px] text-zinc-500 font-mono">
          <Command className="w-2.5 h-2.5" />K
        </kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-black/70 backdrop-blur-sm"
      onClick={() => setIsOpen(false)}
      id="omni-search-overlay"
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-zinc-700/80 bg-zinc-900/95 shadow-2xl p-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        id="omni-search-modal"
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-3 mb-4">
          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent border-none text-zinc-100 outline-none placeholder-zinc-500 text-lg font-mono"
            placeholder="Buscar planos, assets, miembros, vistas..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            id="omni-search-input"
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-400 font-mono">
            ESC
          </kbd>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1 scrollbar-thin">
          {!query.trim() && (
            <div className="text-center py-8 text-zinc-500 text-sm">
              <Command className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Escribe algo para realizar una búsqueda ultrarrápida local offline-first...
            </div>
          )}

          {query.trim() &&
            results.shots.length === 0 &&
            results.assets.length === 0 &&
            results.members.length === 0 &&
            results.actions.length === 0 && (
              <div className="text-center py-8 text-zinc-500 text-sm">
                No se encontraron resultados para "{query}"
              </div>
            )}

          {/* Secciones de Resultados */}
          {results.actions.length > 0 && (
            <div>
              <h3 className="text-[11px] font-mono tracking-wider text-zinc-500 uppercase px-2 mb-1.5">
                Navegación y Atajos
              </h3>
              <div className="space-y-1">
                {results.actions.map((act) => (
                  <button
                    key={act.view}
                    onClick={() => {
                      onSelectView(act.view);
                      setIsOpen(false);
                    }}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800/20 hover:bg-zinc-800 text-zinc-200 hover:text-amber-400 text-sm font-mono transition-colors cursor-pointer"
                  >
                    <Command className="w-4 h-4 text-zinc-500 shrink-0" />
                    {act.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.shots.length > 0 && (
            <div>
              <h3 className="text-[11px] font-mono tracking-wider text-zinc-500 uppercase px-2 mb-1.5">
                Planos (Shotlist)
              </h3>
              <div className="space-y-1">
                {results.shots.map((shot) => (
                  <button
                    key={shot.uuid}
                    onClick={() => {
                      onSelectShot(shot.id);
                      setIsOpen(false);
                    }}
                    className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/20 hover:bg-zinc-800 text-zinc-200 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Film className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="font-mono font-bold text-amber-400 min-w-[50px]">
                        Plano {shot.id}
                      </span>
                      <span className="text-xs text-zinc-400 truncate font-mono">
                        {shot.cameraNotes || "Sin notas de cámara"}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 shrink-0">
                      {shot.frameDuration} frms
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.assets.length > 0 && (
            <div>
              <h3 className="text-[11px] font-mono tracking-wider text-zinc-500 uppercase px-2 mb-1.5">
                Assets del Proyecto
              </h3>
              <div className="space-y-1">
                {results.assets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => {
                      onSelectAsset(asset.id);
                      setIsOpen(false);
                    }}
                    className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/20 hover:bg-zinc-800 text-zinc-200 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Package className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="font-mono font-medium text-emerald-400 min-w-[120px]">
                        {asset.name}
                      </span>
                      <span className="text-xs text-zinc-400 truncate font-mono">
                        {asset.comments || "Sin comentarios"}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 shrink-0">
                      {asset.category}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.members.length > 0 && (
            <div>
              <h3 className="text-[11px] font-mono tracking-wider text-zinc-500 uppercase px-2 mb-1.5">
                Equipo de Producción
              </h3>
              <div className="space-y-1">
                {results.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/10 text-zinc-200"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-4 h-4 text-sky-400 shrink-0" />
                      <span className="text-sm font-medium">{member.name}</span>
                      <span className="text-xs text-zinc-500 font-mono">({member.email})</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-sky-400 border border-sky-900/50">
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
