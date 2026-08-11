/**
 * Secue - Galería Global del Proyecto y Storyboard
 * SPDX-License-Identifier: AGPL-3.0
 */

import React, { useState, useEffect } from "react";
import { localDB } from "../db/dexie";
import { Image, ExternalLink, Grid, Eye } from "lucide-react";

interface GaleriaViewProps {
  projectId: string;
}

export const GaleriaView: React.FC<GaleriaViewProps> = ({ projectId }) => {
  const [images, setImages] = useState<{ src: string; title: string; category: string }[]>([]);

  useEffect(() => {
    const fetchImages = async () => {
      // Unir imágenes de shots (keyframes) y de assets
      const shots = await localDB.shots.where("projectId").equals(projectId).toArray();
      const assets = await localDB.assets.where("projectId").equals(projectId).toArray();

      const list: { src: string; title: string; category: string }[] = [];

      shots.forEach(s => {
        if (s.keyframeUrl) {
          list.push({ src: s.keyframeUrl, title: `Plano ${s.id} (Keyframe)`, category: "Storyboard / Plano" });
        }
      });

      assets.forEach(a => {
        if (a.keyframeUrl) {
          list.push({ src: a.keyframeUrl, title: a.name, category: `Modelado / ${a.category}` });
        }
      });

      // Sumar algunas de referencia por defecto
      list.push({
        src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop",
        title: "Paleta de Color General - Concepto de Luces",
        category: "Concept Art / Referencia"
      });

      setImages(list);
    };

    fetchImages();
  }, [projectId]);

  return (
    <div className="flex flex-col h-full p-4 space-y-4 font-mono text-zinc-200 overflow-hidden" id="galeria-view-container">
      {/* Cabecera */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <Image className="w-4 h-4 text-amber-500" />
            Galería de Arte y Storyboards del Cortometraje
          </h3>
          <span className="text-[10px] text-zinc-500">Muro visual unificado de referencias, artes conceptuales y planos cargados en Secue</span>
        </div>
      </div>

      {/* Grid de exploración */}
      <div className="flex-1 overflow-y-auto" id="galeria-scroll-grid">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {images.map((img, idx) => (
            <div
              key={idx}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden hover:border-zinc-700 transition-all shadow-sm"
            >
              <div className="relative aspect-video w-full bg-zinc-950 overflow-hidden">
                <img
                  src={img.src}
                  alt={img.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                />
                <span className="absolute top-2 left-2 text-[9px] font-bold bg-zinc-950/80 text-amber-400 border border-zinc-800 px-2 py-0.5 rounded-full uppercase">
                  {img.category}
                </span>
              </div>
              <div className="p-3">
                <span className="text-xs font-bold text-zinc-200 group-hover:text-amber-400 transition-colors block truncate">
                  {img.title}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
