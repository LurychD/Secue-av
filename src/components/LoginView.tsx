/**
 * Secue - Formulario de Autenticación, Registro y Recuperación de Contraseña
 * SPDX-License-Identifier: AGPL-3.0
 */

import React, { useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Clapperboard, Mail, Lock, User, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate, useLocation } from "react-router-dom";

interface LoginViewProps {
  onAuthSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onAuthSuccess }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [mode, setMode] = useState<"login" | "register" | "recovery">("login");
  
  // Campos del formulario
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  
  // Estados de proceso y feedback
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Expresión regular estándar para validar email
  const validateEmailFormat = (emailStr: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(emailStr);
  };

  // Traducir códigos de error de Firebase Auth a español argentino amigable
  const getFriendlyErrorMessage = (code: string): string => {
    switch (code) {
      case "auth/email-already-in-use":
        return "Este correo ya está registrado por otro usuario. Probá iniciando sesión.";
      case "auth/invalid-credential":
        return "Las credenciales ingresadas son incorrectas. Verificá tu correo y contraseña.";
      case "auth/wrong-password":
        return "La contraseña ingresada no es válida. Intentá de nuevo.";
      case "auth/user-not-found":
        return "No encontramos ninguna cuenta con ese correo electrónico.";
      case "auth/invalid-email":
        return "El formato de correo ingresado no es válido.";
      case "auth/weak-password":
        return "La contraseña debe tener al menos 8 caracteres por seguridad.";
      case "auth/too-many-requests":
        return "Tu cuenta fue bloqueada temporalmente por exceso de intentos. Intentá de nuevo en unos minutos.";
      case "auth/user-disabled":
        return "Este usuario fue desactivado por la dirección de Secue.";
      case "auth/missing-password":
        return "Tenés que escribir una contraseña para continuar.";
      case "auth/missing-email":
        return "Tenés que ingresar tu dirección de correo electrónico.";
      default:
        return "Ocurrió un inconveniente al procesar tu solicitud. Por favor, reintentá.";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // 1. Validar correo electrónico
    if (!validateEmailFormat(email)) {
      setErrorMsg("El formato del correo electrónico no es válido. Ej: usuario@secue.com");
      return;
    }

    // 2. Validar longitud de contraseña (para ingreso y registro)
    if (mode !== "recovery" && password.length < 8) {
      setErrorMsg("La contraseña debe tener una longitud mínima de 8 caracteres.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
        const from = (location.state as any)?.from || "/";
        navigate(from, { replace: true });
        onAuthSuccess();
      } else if (mode === "register") {
        if (!displayName.trim()) {
          setErrorMsg("Por favor, ingresá tu nombre completo para el perfil.");
          setLoading(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Actualizar el perfil con el nombre de visualización
        await updateProfile(userCredential.user, {
          displayName: displayName.trim()
        });
        const from = (location.state as any)?.from || "/";
        navigate(from, { replace: true });
        onAuthSuccess();
      } else if (mode === "recovery") {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg("¡Enlace enviado! Revisá tu bandeja de entrada para restablecer tu contraseña.");
        // Opcional: limpiar campo
        setEmail("");
      }
    } catch (err: any) {
      console.error("Error en autenticación Firebase:", err);
      setErrorMsg(getFriendlyErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      // Verificar si el usuario se autentica por primera vez
      const userDocRef = doc(db, "usuarios", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        // Crear documento automáticamente si no existe
        await setDoc(userDocRef, {
          id: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split("@")[0] || "Artista de Secue",
          createdAt: new Date().toISOString()
        });
      }

      const from = (location.state as any)?.from || "/";
      navigate(from, { replace: true });
      onAuthSuccess();
    } catch (err: any) {
      console.error("Error en inicio de sesión con Google:", err);
      // Evitar error si el usuario canceló la ventana emergente
      if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
        setErrorMsg(getFriendlyErrorMessage(err.code));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 font-mono p-4" id="login-module-container">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
        id="login-card-wrapper"
      >
        {/* Cabecera del Módulo */}
        <div className="flex flex-col items-center text-center mb-6 space-y-2 select-none">
          <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 mb-1">
            <Clapperboard className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold uppercase tracking-widest text-zinc-100">
            SECUE <span className="text-xs text-amber-500 font-bold ml-1">PIPELINE</span>
          </h2>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
            {mode === "login" && "Ingreso seguro para miembros de producción"}
            {mode === "register" && "Creá tu cuenta de artista en la plataforma"}
            {mode === "recovery" && "Recuperación de contraseña por correo electrónico"}
          </p>
        </div>

        {/* Feedback visual de Alertas */}
        {errorMsg && (
          <div className="bg-rose-950/40 border border-rose-900/50 text-rose-400 text-[11px] p-3 rounded-lg flex items-start gap-2 mb-4 animate-shake" id="login-alert-error">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 text-[11px] p-3 rounded-lg flex items-start gap-2 mb-4" id="login-alert-success">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* Formulario de Acción */}
        <form onSubmit={handleSubmit} className="space-y-4" id="auth-action-form">
          {mode === "register" && (
            <div className="space-y-1 text-left">
              <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Nombre Completo</label>
              <div className="relative flex items-center bg-zinc-950 border border-zinc-850 rounded-lg focus-within:border-amber-500/50 transition-all">
                <User className="w-4 h-4 text-zinc-500 absolute left-3 shrink-0" />
                <input
                  type="text"
                  required
                  placeholder="Ej: Axel Ibarra"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-transparent border-none outline-none py-2.5 pl-10 pr-3 text-xs text-zinc-100 placeholder-zinc-600"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div className="space-y-1 text-left">
            <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Correo Electrónico</label>
            <div className="relative flex items-center bg-zinc-950 border border-zinc-850 rounded-lg focus-within:border-amber-500/50 transition-all">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3 shrink-0" />
              <input
                type="email"
                required
                placeholder="Ej: artista@secue.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border-none outline-none py-2.5 pl-10 pr-3 text-xs text-zinc-100 placeholder-zinc-600"
                disabled={loading}
              />
            </div>
          </div>

          {mode !== "recovery" && (
            <div className="space-y-1 text-left">
              <div className="flex justify-between items-center">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Contraseña</label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      setMode("recovery");
                    }}
                    className="text-[9px] font-bold text-amber-500 hover:text-amber-400 cursor-pointer"
                  >
                    ¿La olvidaste?
                  </button>
                )}
              </div>
              <div className="relative flex items-center bg-zinc-950 border border-zinc-850 rounded-lg focus-within:border-amber-500/50 transition-all">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3 shrink-0" />
                <input
                  type="password"
                  required
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent border-none outline-none py-2.5 pl-10 pr-3 text-xs text-zinc-100 placeholder-zinc-600"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {/* Botón Principal Deshabilitable */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-2.5 rounded-lg text-xs tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
              loading ? "opacity-50 cursor-not-allowed select-none" : ""
            }`}
            id="auth-submit-button"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
            ) : mode === "login" ? (
              "INICIAR SESIÓN"
            ) : mode === "register" ? (
              "CREAR CUENTA"
            ) : (
              "ENVIAR ENLACE DE RECUPERACIÓN"
            )}
          </button>
        </form>

        {mode !== "recovery" && (
          <>
            <div className="relative flex py-3 items-center" id="google-auth-divider">
              <div className="flex-grow border-t border-zinc-800/80"></div>
              <span className="flex-shrink mx-4 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">O ingresá con</span>
              <div className="flex-grow border-t border-zinc-800/80"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className={`w-full bg-zinc-950 hover:bg-zinc-850 text-zinc-200 border border-zinc-800/80 font-bold py-2.5 rounded-lg text-xs tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2.5 ${
                loading ? "opacity-50 cursor-not-allowed select-none" : ""
              }`}
              id="google-login-button"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                />
              </svg>
              <span>CONTINUAR CON GOOGLE</span>
            </button>
          </>
        )}

        {/* Links de intercambio de Modos */}
        <div className="mt-6 pt-5 border-t border-zinc-850 text-center text-[10px] text-zinc-500 space-y-2">
          {mode === "login" && (
            <p>
              ¿No tenés una cuenta de Secue?{" "}
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setMode("register");
                }}
                className="font-bold text-amber-500 hover:text-amber-400 cursor-pointer"
              >
                Registrate gratis
              </button>
            </p>
          )}

          {mode === "register" && (
            <p>
              ¿Ya estás registrado en Secue?{" "}
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setMode("login");
                }}
                className="font-bold text-amber-500 hover:text-amber-400 cursor-pointer"
              >
                Iniciá sesión
              </button>
            </p>
          )}

          {mode === "recovery" && (
            <button
              onClick={() => {
                setErrorMsg(null);
                setSuccessMsg(null);
                setMode("login");
              }}
              className="inline-flex items-center gap-1.5 font-bold text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver al inicio de sesión</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
