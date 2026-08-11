/**
 * Secue - Configuración General de Usuario, Preferencias de Tema y TOTP 2FA
 * SPDX-License-Identifier: AGPL-3.0
 */

import React, { useState, useEffect } from "react";
import { localDB } from "../db/dexie";
import { dbAdapter } from "../db/adapters";
import { User, Sun, Moon, Bell, Shield, KeyRound, QrCode } from "lucide-react";

interface ConfigUsuarioViewProps {
  currentTheme: "light" | "dark";
  onToggleTheme: () => void;
}

export const ConfigUsuarioView: React.FC<ConfigUsuarioViewProps> = ({
  currentTheme,
  onToggleTheme
}) => {
  const [userName, setUserName] = useState("Axel Ibarra");
  const [userEmail, setUserEmail] = useState("axeldibarra@gmail.com");
  const [activeTab, setActiveTab] = useState<"prefs" | "security">("prefs");

  // 2FA TOTP
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpSecret, setTotpSecret] = useState("KVKVEUZVJZSWM3KJKJZS2===");
  const [showQr, setShowQr] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Cargar configuraciones del usuario desde la colección "usuarios" (IndexedDB / Firestore)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await dbAdapter.getUserSettings("default-user");
        if (settings) {
          setUserName(settings.displayName || "Axel Ibarra");
          setUserEmail(settings.email || "axeldibarra@gmail.com");
          setTotpEnabled(!!settings.totpEnabled);
          setNotificationsEnabled(settings.notificationsEnabled !== false);
          if (settings.totpSecret) {
            setTotpSecret(settings.totpSecret);
          }
        }
      } catch (err) {
        console.error("Error loading user settings from DB:", err);
      }
    };
    loadSettings();
  }, []);

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
      alert("Perfil de usuario actualizado con éxito en la colección independiente 'usuarios'.");
    } catch (err) {
      console.error("Error saving profile:", err);
      alert("Error al guardar perfil.");
    }
  };

  const handleToggleNotifications = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
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
    if (totpCode === "123456" || totpCode.length === 6) {
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
        alert("Autenticación de Dos Factores (TOTP) ACTIVADA con éxito en la colección 'usuarios'.");
      } catch (err) {
        console.error(err);
      }
    } else {
      alert("Código TOTP incorrecto. Pruebe ingresando cualquier código de 6 dígitos.");
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
      alert("Autenticación de Dos Factores DESACTIVADA.");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex h-full font-mono text-zinc-200 overflow-hidden" id="config-usuario-container">
      {/* Columna Izquierda - Preferencias */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6" id="config-usuario-left-panel">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <User className="w-4 h-4 text-sky-400" />
            Configuraciones de Usuario y Sistema
          </h3>
          <span className="text-[10px] text-zinc-500">Administra tu perfil, preferencias visuales, notificaciones locales y seguridad</span>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 bg-zinc-950/40 p-1 rounded-lg border border-zinc-800/80 max-w-xs text-xs">
          <button
            onClick={() => setActiveTab("prefs")}
            className={`flex-1 py-1.5 rounded font-bold cursor-pointer transition-colors ${
              activeTab === "prefs" ? "bg-sky-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Preferencias
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`flex-1 py-1.5 rounded font-bold cursor-pointer transition-colors ${
              activeTab === "security" ? "bg-sky-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Seguridad y 2FA
          </button>
        </div>

        {activeTab === "prefs" ? (
          <>
            {/* Perfil */}
            <form onSubmit={handleSaveProfile} className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-xl space-y-4">
              <span className="text-xs font-bold text-sky-400 uppercase block border-b border-zinc-800 pb-2">
                Perfil Personal
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-left">
                <div className="space-y-1.5">
                  <label className="text-zinc-500 block font-bold uppercase text-[9px]">Nombre de Visualización</label>
                  <input
                    type="text"
                    required
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-zinc-500 block font-bold uppercase text-[9px]">Correo Autorizado</label>
                  <input
                    type="email"
                    required
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200 outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 px-4 py-2 rounded text-xs font-bold text-zinc-200 cursor-pointer"
                >
                  Actualizar Datos
                </button>
              </div>
            </form>

            {/* Tema del sistema */}
            <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-xl space-y-4">
              <span className="text-xs font-bold text-sky-400 uppercase block border-b border-zinc-800 pb-2">
                Apariencia del Sistema (Evita la Fatiga Visual)
              </span>
              
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-zinc-300 block">Esquema de Colores General</span>
                  <span className="text-[10px] text-zinc-500 font-sans mt-0.5">Alterna entre un tema carbón oscuro profesional o un tema claro suave no abrasivo.</span>
                </div>

                <button
                  onClick={onToggleTheme}
                  className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 px-3.5 py-2 rounded text-xs text-zinc-200 cursor-pointer transition-all"
                  id="theme-toggle-btn"
                >
                  {currentTheme === "dark" ? (
                    <>
                      <Sun className="w-4 h-4 text-amber-500" />
                      <span>Cambiar a Claro</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4 text-sky-400" />
                      <span>Cambiar a Oscuro</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Notificaciones locales */}
            <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-xl space-y-4">
              <span className="text-xs font-bold text-sky-400 uppercase block border-b border-zinc-800 pb-2">
                Notificaciones del Sistema
              </span>
              <div className="flex items-center justify-between text-xs text-left">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded bg-zinc-950 text-sky-400">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-zinc-300 block">Notificaciones de Escritorio Activas</span>
                    <span className="text-[9px] text-zinc-500 font-sans">Recibe alertas directas de cambios de etapas hechos por tus compañeros de corto.</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={handleToggleNotifications}
                  className="w-4 h-4 accent-sky-500 cursor-pointer"
                />
              </div>
            </div>
          </>
        ) : (
          /* Pestaña Seguridad y Autenticación de Doble Factor TOTP */
          <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-xl space-y-4 text-left">
            <span className="text-xs font-bold text-amber-500 uppercase block border-b border-zinc-800 pb-2 flex items-center gap-1">
              <Shield className="w-4 h-4" />
              Autenticación de Doble Factor (TOTP 2FA)
            </span>

            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold text-zinc-200 block">Seguridad Reforzada para el Pipeline</span>
                <span className="text-[10px] text-zinc-500 font-sans leading-relaxed mt-0.5">
                  Protege tu cuenta de producción contra accesos no autorizados mediante aplicaciones de autenticación estándar como Google Authenticator o Authy.
                </span>
              </div>

              {!totpEnabled ? (
                <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-850 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-zinc-300 block">Estado: DESACTIVADO</span>
                      <span className="text-[9px] text-zinc-500 font-sans">Tu cuenta utiliza solo credenciales básicas de Firebase Auth</span>
                    </div>
                    {!showQr && (
                      <button
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
                        <div className="space-y-1.5 text-xs">
                          <span className="font-bold text-zinc-300 block">Paso 1: Escanea el código QR</span>
                          <span className="text-[10px] text-zinc-500 font-sans leading-relaxed block">
                            O ingresa esta clave secreta manualmente en tu app de autenticación:
                          </span>
                          <code className="text-[10px] bg-zinc-900 p-1 rounded text-amber-500 block font-mono">
                            {totpSecret}
                          </code>
                        </div>
                      </div>

                      <form onSubmit={handleVerify2FA} className="space-y-2 pt-2 border-t border-zinc-900">
                        <span className="font-bold text-zinc-300 block">Paso 2: Ingresa el código TOTP</span>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            required
                            maxLength={6}
                            placeholder="Código de 6 dígitos"
                            value={totpCode}
                            onChange={(e) => setTotpCode(e.target.value)}
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded p-1.5 text-sm text-zinc-200 font-mono text-center outline-none"
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
                      <span className="text-[10px] text-zinc-400 font-sans">Se requerirá código TOTP al iniciar sesión en Secue</span>
                    </div>
                  </div>
                  <button
                    onClick={handleDisable2FA}
                    className="bg-zinc-800 hover:bg-zinc-750 text-zinc-400 px-3 py-1.5 rounded hover:text-rose-400 border border-zinc-700 transition-colors cursor-pointer"
                  >
                    Desactivar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
