/**
 * Secue - Vista de Error 403 - Acceso Denegado de Seguridad
 * SPDX-License-Identifier: AGPL-3.0
 */

import React from "react";
import { ShieldAlert, LogOut, LayoutGrid } from "lucide-react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

interface AccesoDenegadoViewProps {
  onReturnToProjects: () => void;
  userEmail?: string | null;
}

export const AccesoDenegadoView: React.FC<AccesoDenegadoViewProps> = ({ 
  onReturnToProjects,
  userEmail 
}) => {
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Error al desloguearse desde 403:", err);
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 font-mono p-4" id="access-denied-403-container">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-6" id="access-denied-card">
        {/* Alerta de Seguridad Visual */}
        <div className="flex flex-col items-center">
          <div className="p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20 text-rose-500 mb-2 animate-pulse">
            <ShieldAlert className="w-12 h-12" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-rose-500">403</h1>
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-300 mt-1">Acceso Restringido</h2>
        </div>

        {/* Mensaje Informativo */}
        <div className="space-y-2 text-xs text-zinc-400 leading-relaxed font-sans">
          <p>
            No figurás en la nómina de miembros autorizados para este cortometraje. Las directivas de seguridad bloquean el ingreso a usuarios ajenos al equipo de este proyecto.
          </p>
          {userEmail && (
            <p className="text-[10px] text-zinc-500 font-mono bg-zinc-950/60 p-2 rounded border border-zinc-850 select-all">
              Usuario conectado: {userEmail}
            </p>
          )}
        </div>

        {/* Acciones */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            onClick={onReturnToProjects}
            className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700 hover:border-zinc-600 font-bold py-2.5 px-4 rounded-lg text-xs transition-colors cursor-pointer"
            id="btn-403-return-projects"
          >
            <LayoutGrid className="w-4 h-4 text-amber-500" />
            <span>Mis Proyectos</span>
          </button>
          
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border border-rose-900/40 hover:border-rose-900/60 font-bold py-2.5 px-4 rounded-lg text-xs transition-colors cursor-pointer"
            id="btn-403-logout"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </div>
  );
};
