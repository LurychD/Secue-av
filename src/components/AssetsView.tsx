/**
 * Secue - Vista de Assets y Categorías con Trazabilidad Histórica por Etapa
 * SPDX-License-Identifier: AGPL-3.0
 */

import React, { useState, useEffect } from "react";
import { localDB } from "../db/dexie";
import { dbAdapter } from "../db/adapters";
import { Asset, AssetCategory, AssetApprovalStatus, AuditLog, AssetHistoryEntry } from "../types";
import { Package, ExternalLink, HelpCircle, History, AlertCircle, Plus, Info, Check, ShieldAlert, User } from "lucide-react";

interface AssetsViewProps {
  projectId: string;
  selectedAssetIdFromSearch?: string;
  clearSearchAssetId?: () => void;
}

export const AssetsView: React.FC<AssetsViewProps> = ({
  projectId,
  selectedAssetIdFromSearch,
  clearSearchAssetId
}) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "history">("details");
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | "Todos">("Todos");
  
  // Creación de nuevo asset
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<AssetCategory>(AssetCategory.PERSONAJE);
  const [newDriveUrl, setNewDriveUrl] = useState("");
  const [newComments, setNewComments] = useState("");
  const [pendingAssets, setPendingAssets] = useState<Set<string>>(new Set());

  const loadAssets = async () => {
    const list = await dbAdapter.listAssets(projectId);
    setAssets(list);

    // Cargar pendientes de sincronización para assets
    try {
      const pendingList = await localDB.pendingSync
        .where("collection")
        .equals("assets")
        .toArray();
      const pendingIds = new Set(pendingList.map(item => item.entityId));
      setPendingAssets(pendingIds);
    } catch (err) {
      console.warn("Fallo al cargar assets pendientes de sincronización:", err);
    }

    if (selectedAsset) {
      const updated = list.find(a => a.id === selectedAsset.id);
      if (updated) setSelectedAsset(updated);
    }
  };

  useEffect(() => {
    loadAssets();

    const handleDbUpdated = () => {
      loadAssets();
    };
    window.addEventListener("local-db-updated", handleDbUpdated);
    return () => {
      window.removeEventListener("local-db-updated", handleDbUpdated);
    };
  }, [projectId]);

  // Manejar búsqueda global externa
  useEffect(() => {
    if (selectedAssetIdFromSearch && assets.length > 0) {
      const found = assets.find(a => a.id === selectedAssetIdFromSearch);
      if (found) {
        setSelectedAsset(found);
        setActiveTab("details");
      }
      if (clearSearchAssetId) clearSearchAssetId();
    }
  }, [selectedAssetIdFromSearch, assets]);

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const id = `asset-${Date.now()}`;
    const newAsset: Asset = {
      id,
      projectId,
      name: newName.trim(),
      category: newCategory,
      approvalStatus: AssetApprovalStatus.CONCEPTO,
      keyframeUrl: newCategory === AssetCategory.PERSONAJE
        ? "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=300&auto=format&fit=crop"
        : newCategory === AssetCategory.ESCENARIO
        ? "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=300&auto=format&fit=crop"
        : "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?q=80&w=300&auto=format&fit=crop",
      googleDriveUrl: newDriveUrl.trim() || undefined,
      assignedArtist: "axeldibarra@gmail.com",
      comments: newComments || "Nuevo asset registrado en biblioteca.",
      updatedAt: Date.now(),
      history: [
        {
          timestamp: Date.now(),
          userId: "user-1",
          userEmail: "axeldibarra@gmail.com",
          stage: AssetApprovalStatus.CONCEPTO,
          comment: "Creación del registro de asset."
        }
      ]
    };

    await dbAdapter.saveAsset(newAsset);
    
    // Log Auditoría
    const audit: AuditLog = {
      id: `audit-${Date.now()}`,
      projectId,
      action: "Asset Creado",
      timestamp: Date.now(),
      userId: "user-1",
      userEmail: "axeldibarra@gmail.com",
      details: `Asset '${newName}' creado en categoría ${newCategory}.`
    };
    await dbAdapter.saveAuditLog(audit);

    setShowAddModal(false);
    setNewName("");
    setNewDriveUrl("");
    setNewComments("");
    await loadAssets();
  };

  const handleApprovalChange = async (newStatus: AssetApprovalStatus) => {
    if (!selectedAsset) return;

    const historyEntry: AssetHistoryEntry = {
      timestamp: Date.now(),
      userId: "user-1",
      userEmail: "axeldibarra@gmail.com",
      stage: newStatus,
      comment: `Cambio de estado a '${newStatus}'`
    };

    const updatedAsset: Asset = {
      ...selectedAsset,
      approvalStatus: newStatus,
      updatedAt: Date.now(),
      history: [...selectedAsset.history, historyEntry]
    };

    await dbAdapter.saveAsset(updatedAsset);
    await loadAssets();
  };

  const filteredAssets = selectedCategory === "Todos"
    ? assets
    : assets.filter(a => a.category === selectedCategory);

  const getStatusColor = (status: AssetApprovalStatus) => {
    switch (status) {
      case AssetApprovalStatus.CONCEPTO: return "bg-zinc-800 text-zinc-400 border border-zinc-700";
      case AssetApprovalStatus.MODELADO: return "bg-amber-950/40 text-amber-400 border border-amber-900/40";
      case AssetApprovalStatus.RIGGING: return "bg-indigo-950/40 text-indigo-400 border border-indigo-900/40";
      case AssetApprovalStatus.TEXTURIZADO: return "bg-purple-950/40 text-purple-400 border border-purple-900/40";
      case AssetApprovalStatus.FINAL_APROBADO: return "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40";
      default: return "bg-zinc-850";
    }
  };

  return (
    <div className="flex h-full font-mono text-zinc-200 overflow-hidden" id="assets-view-container">
      {/* Contenido Grid */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Barra superior Filtros */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 shrink-0">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-500" />
              Biblioteca de Assets y Modelos
            </h3>
            <span className="text-[10px] text-zinc-500">Administra personajes, escenarios y props de tu producción</span>
          </div>

          <div className="flex gap-2 items-center w-full sm:w-auto">
            <div className="bg-zinc-950/40 p-1 rounded-lg border border-zinc-800/80 flex gap-1">
              {["Todos", AssetCategory.PERSONAJE, AssetCategory.ESCENARIO, AssetCategory.PROP].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat as any)}
                  className={`px-3 py-1 rounded text-[10px] uppercase font-bold cursor-pointer transition-colors ${
                    selectedCategory === cat
                      ? "bg-emerald-500 text-zinc-950"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {cat === "Todos" ? "Todos" : cat + "s"}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold px-3 py-1.5 rounded text-xs transition-colors shrink-0 cursor-pointer"
              id="add-asset-btn"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Asset</span>
            </button>
          </div>
        </div>

        {/* Grid de Tarjetas */}
        <div className="flex-1 overflow-y-auto" id="assets-cards-grid">
          {filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-600 border border-zinc-800/80 rounded-xl bg-zinc-900/10">
              <Package className="w-12 h-12 mb-3 opacity-40" />
              <span className="text-sm font-bold">No hay assets en esta categoría</span>
              <span className="text-[10px] mt-1">Presiona "Registrar Asset" para subir tu primer modelo</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAssets.map((asset) => {
                // Generar advertencia visual cuando Rigging o Texturizado está pendiente en Personajes
                const isCharacterPendingRig = asset.category === AssetCategory.PERSONAJE && asset.approvalStatus === AssetApprovalStatus.MODELADO;

                return (
                  <div
                    key={asset.id}
                    onClick={() => setSelectedAsset(asset)}
                    className={`rounded-xl border bg-zinc-900 overflow-hidden transition-all duration-250 cursor-pointer group flex flex-col justify-between ${
                      selectedAsset?.id === asset.id
                        ? "border-emerald-500 shadow-md ring-1 ring-emerald-500/20"
                        : "border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-850/50"
                    }`}
                  >
                    {/* Imagen Portada */}
                    <div className="relative aspect-video w-full bg-zinc-950">
                      {asset.keyframeUrl ? (
                        <img
                          src={asset.keyframeUrl}
                          alt={asset.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-700">
                          Sin Previsualización
                        </div>
                      )}

                      {/* Alerta de Etapas Pendientes */}
                      {isCharacterPendingRig && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-amber-500/90 text-zinc-950 text-[9px] font-bold px-2 py-0.5 rounded-full shadow border border-amber-600">
                          <AlertCircle className="w-3 h-3" />
                          <span>RIGGING PENDIENTE</span>
                        </div>
                      )}

                      <span className="absolute bottom-2 right-2 text-[9px] font-mono bg-zinc-950/80 text-zinc-400 px-2 py-0.5 rounded-full uppercase border border-zinc-800">
                        {asset.category}
                      </span>
                    </div>

                    {/* Metadata Básica */}
                    <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors flex items-center justify-between gap-1.5">
                          <span>{asset.name}</span>
                          {pendingAssets.has(asset.id) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0 animate-bounce" title="Pendiente de sincronizar con la nube" />
                          )}
                        </h4>
                        <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 font-sans leading-relaxed">
                          {asset.comments}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-zinc-800/60 pt-3 mt-1">
                        {/* Estado */}
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${getStatusColor(asset.approvalStatus)}`}>
                          {asset.approvalStatus}
                        </span>

                        {/* Enlace Google Drive */}
                        {asset.googleDriveUrl ? (
                          <a
                            href={asset.googleDriveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 transition-colors bg-zinc-950 px-2 py-1 rounded border border-zinc-800 font-sans"
                          >
                            <span>Drive</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-[9px] text-zinc-600 font-sans italic">Sin Drive</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Inspector Lateral de Asset */}
      {selectedAsset && (
        <div className="w-[360px] border-l border-zinc-800 bg-zinc-900/95 flex flex-col h-full overflow-hidden shrink-0" id="asset-inspector">
          {/* Cabecera Inspector */}
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block font-bold">Ficha de Asset</span>
              <h4 className="text-sm font-bold text-emerald-400 truncate max-w-[240px]">{selectedAsset.name}</h4>
            </div>
            <button
              onClick={() => setSelectedAsset(null)}
              className="text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
            >
              Cerrar
            </button>
          </div>

          {/* Selector Pestañas */}
          <div className="flex border-b border-zinc-800 text-xs bg-zinc-950/40">
            <button
              onClick={() => setActiveTab("details")}
              className={`flex-1 py-2 text-center border-b font-medium cursor-pointer ${
                activeTab === "details" ? "border-emerald-500 text-emerald-400 font-bold" : "border-transparent text-zinc-400"
              }`}
            >
              Ficha Técnica
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 py-2 text-center border-b font-medium cursor-pointer ${
                activeTab === "history" ? "border-emerald-500 text-emerald-400 font-bold" : "border-transparent text-zinc-400"
              }`}
            >
              Etapas ({selectedAsset.history.length})
            </button>
          </div>

          {/* Contenido */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
            {activeTab === "details" ? (
              <>
                {/* Detalles Base */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-zinc-400 font-bold uppercase text-[10px]">
                    <Info className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Propiedades del Asset</span>
                  </div>
                  <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/80 space-y-2.5">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Categoría:</span>
                      <span className="font-bold text-zinc-300">{selectedAsset.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Asignado a:</span>
                      <span className="font-bold text-emerald-400">{selectedAsset.assignedArtist}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Google Drive:</span>
                      {selectedAsset.googleDriveUrl ? (
                        <a
                          href={selectedAsset.googleDriveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-400 hover:underline flex items-center gap-0.5"
                        >
                          Ir a Carpeta <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="text-zinc-500 italic">No asociado</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Comentarios del modelador/artista */}
                <div className="space-y-1.5">
                  <span className="text-zinc-500 uppercase font-bold text-[10px] block">Descripción / Notas de Diseño</span>
                  <div className="bg-zinc-950/40 p-2.5 rounded border border-zinc-800/50 text-zinc-300 font-sans italic leading-relaxed">
                    {selectedAsset.comments || "Sin comentarios."}
                  </div>
                </div>

                {/* Actualizador de Estado de Aprobación */}
                <div className="space-y-2">
                  <span className="text-zinc-400 uppercase font-bold text-[10px] block">Aprobar Etapa de Pipeline</span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {Object.values(AssetApprovalStatus).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleApprovalChange(status)}
                        className={`w-full flex items-center justify-between p-2 rounded text-left transition-colors cursor-pointer border ${
                          selectedAsset.approvalStatus === status
                            ? "bg-emerald-950/30 border-emerald-500 text-emerald-400 font-bold"
                            : "bg-zinc-950 border-zinc-850 hover:bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        <span>{status}</span>
                        {selectedAsset.approvalStatus === status && <Check className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              // Historial inmutable por Etapas
              <div className="space-y-4">
                <div className="flex items-center gap-1.5 text-zinc-400 font-bold uppercase text-[10px]">
                  <ShieldAlert className="w-4 h-4 text-emerald-500" />
                  <span>Bitácora de Trazabilidad por Etapa</span>
                </div>

                <div className="space-y-3.5 relative border-l border-zinc-800 pl-3.5 ml-2">
                  {selectedAsset.history.map((hist, idx) => (
                    <div key={idx} className="relative space-y-1">
                      <div className="absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500/80 border border-zinc-900" />
                      <div className="flex items-center justify-between text-[10px] text-zinc-500">
                        <span className="flex items-center gap-1">
                          <User className="w-2.5 h-2.5" /> {hist.userEmail}
                        </span>
                        <span>{new Date(hist.timestamp).toLocaleDateString()}</span>
                      </div>
                      <span className="font-bold text-zinc-300 block">
                        Alcanzó etapa <span className="text-emerald-400">{hist.stage}</span>
                      </span>
                      <p className="text-[10px] bg-zinc-950/40 p-1.5 rounded border border-zinc-800/60 text-zinc-400 font-sans mt-1">
                        {hist.comment || "Sin comentarios técnicos específicos."}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Creación de Asset */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form
            onSubmit={handleCreateAsset}
            className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4 shadow-2xl"
          >
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <h4 className="text-sm font-bold text-emerald-500">Registrar Nuevo Asset</h4>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
              >
                Cancelar
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-[10px] text-zinc-500 block uppercase font-bold mb-1">Nombre del Asset</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Personaje Oliver, Llave Inglesa, Bosque Fondo..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200 outline-none font-sans"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 block uppercase font-bold mb-1">Categoría</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs outline-none text-zinc-300 font-mono"
                >
                  {Object.values(AssetCategory).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 block uppercase font-bold mb-1">Enlace de Google Drive (Escena/Texturas)</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={newDriveUrl}
                  onChange={(e) => setNewDriveUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-200 outline-none font-sans"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 block uppercase font-bold mb-1">Notas de Producción Iniciales</label>
                <textarea
                  placeholder="Instrucciones especiales para modelado o rigging..."
                  value={newComments}
                  onChange={(e) => setNewComments(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 h-20 text-xs text-zinc-200 outline-none resize-none font-sans"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded text-zinc-400 bg-zinc-800 hover:bg-zinc-750 transition-colors text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded text-zinc-950 bg-emerald-500 hover:bg-emerald-600 transition-colors text-xs font-bold cursor-pointer"
              >
                Registrar Asset
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
