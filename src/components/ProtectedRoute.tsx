/**
 * Secue - Componente Guardián de Rutas Protegidas y Validación de Membresía
 * SPDX-License-Identifier: AGPL-3.0
 */

import React, { useState, useEffect } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../firebase";
import { dbAdapter } from "../db/adapters";
import { Project } from "../types";
import { Clapperboard } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [membershipChecking, setMembershipChecking] = useState(false);
  const [hasAccess, setHasAccess] = useState(true);
  
  const location = useLocation();
  const { projectId } = useParams<{ projectId?: string }>();

  // 1. Monitorear el estado de autenticación de Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Monitorear la pertenencia al proyecto (Control de acceso 403)
  useEffect(() => {
    if (authLoading || !user) {
      setHasAccess(true);
      return;
    }

    if (!projectId) {
      setHasAccess(true);
      return;
    }

    const verifyMembership = async () => {
      setMembershipChecking(true);
      try {
        const project: Project | null = await dbAdapter.getProject(projectId);
        if (!project) {
          // Si el proyecto no existe local ni remotamente, denegar acceso por seguridad
          setHasAccess(false);
          setMembershipChecking(false);
          return;
        }

        // Comprobación relacional en el cliente de acuerdo a las especificaciones del Director Axel
        const uid = user.uid;
        const email = user.email?.toLowerCase() || "";

        // Un miembro es válido si su uid coincide, su id coincide o su email coincide
        const isMember = project.members?.some((member) => {
          const mUid = (member as any).uid || member.id;
          const mEmail = member.email?.toLowerCase() || "";
          return mUid === uid || mEmail === email;
        });

        setHasAccess(!!isMember);
      } catch (err) {
        console.warn("Fallo al verificar membresía en ProtectedRoute:", err);
        setHasAccess(false);
      } finally {
        setMembershipChecking(false);
      }
    };

    verifyMembership();
  }, [user, authLoading, projectId]);

  // Pantalla de carga global fija con el icono de la claqueta
  if (authLoading || (user && membershipChecking)) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-200 font-mono p-6 select-none" id="global-route-loader">
        <div className="flex flex-col items-center max-w-sm w-full text-center space-y-4">
          <div className="relative">
            <div className="absolute inset-0 bg-amber-500/10 blur-xl rounded-full animate-ping" />
            <Clapperboard className="w-14 h-14 text-amber-500 relative z-10 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h1 className="text-sm font-bold uppercase tracking-widest text-zinc-300">
              SECUE <span className="text-[10px] text-zinc-500 font-normal">PIPELINE</span>
            </h1>
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider animate-pulse">
              Verificando credenciales y permisos de acceso...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Si no está autenticado, redirigir a Login y guardar la ubicación original
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si está autenticado pero no forma parte del arreglo de miembros del proyecto, redirigir a 403
  if (!hasAccess) {
    return <Navigate to="/403" replace />;
  }

  // Si supera todas las capas de seguridad, permitir renderizar el contenido protegido
  return <>{children}</>;
};
