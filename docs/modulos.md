# Módulos y Flujos Funcionales de Secue

Este documento detalla cada una de las doce vistas modulares creadas e integradas en la plataforma **Secue**, respetando de forma estricta los requerimientos del RPD.

---

## 1. Dashboard General (`DashboardView.tsx`)
- **Resumen Estadístico**: Despliega porcentajes generales de avance y duración acumulada de fotogramas directamente de los contadores agregados del proyecto.
- **Alertas de Pipeline**: Escanea y resalta tareas con plazos críticos menores a 24 horas.
- **Google Calendar Integration**: Botón de sincronización con Google Calendar para vincular hitos y plazos en la nube.
- **Bitácora Reciente**: Vista en tiempo real de los últimos eventos del log de auditoría técnica.

## 2. Planilla de Planos (`ShotlistView.tsx`)
- **ID Flotante Decimal**: Permite la inserción de escenas intermedias usando IDs como `1.5` sin alterar el orden numérico secuencial del cortometraje.
- **Seguimiento por Departamentos**: Control matricial con estados (Pendiente, En Proceso, En Revisión, Completado) para Layout, Animación, Iluminación y Composición.
- **Trazabilidad de Cambios**: Registro automático e inmutable de quién modificó cada celda, qué campo cambió, valor anterior, valor nuevo y fecha exacta.

## 3. Gestor de Biblioteca de Assets (`AssetsView.tsx`)
- **Aislamiento por Proyecto**: Gestión de modelos 3D, sets y props filtrados estrictamente por `projectId`.
- **Filtros por Categorías**: Clasificación instantánea en Personajes, Escenarios y Props.
- **Nivel de Aprobación**: Seguimiento de etapas de modelado y rigging hasta la aprobación del director.

## 4. Revisión de Renders Dailies (`DailiesView.tsx`)
- **Grilla de Miniaturas**: Listado rápido de fotogramas cargados por artistas para su evaluación técnica.
- **Control de Versiones A / B**: Permite al supervisor contrastar alternativas y registrar decisiones inmutables.
- **Bitácora de Supervisor**: Historial integrado de aprobaciones y rechazos con comentarios de corrección.

## 5. Sincronización y Corte de Montaje (`MontajeView.tsx`)
- **Reproductor Marco a Marco**: Reproductor de video HTML5 con avance preciso fotograma por fotograma (1 frame = 1 / 24 segundos).
- **Estampado de Comentarios**: Detiene la reproducción en un cuadro exacto y guarda anotaciones de dirección vinculadas al código de tiempo (Timecode SMPTE HH:MM:SS:FF).
- **Gestión Interactiva de Notas**: Permite conmutar el estado de notas (Pendiente / Resuelto) y eliminarlas permanentemente con registro de trazabilidad en la bitácora de auditoría.

## 6. Sincronización de Audio y Música (`SonidoView.tsx`)
- **Forma de Onda en Canvas**: Renderizado 2D de espectros sonoros directamente en un canvas de alto rendimiento.
- **Timecode Offset**: Campo numérico para ajustar el desfase de pistas de música con los layouts en fotogramas de línea de tiempo.
- **Biblioteca y Selector de Pistas**: Panel izquierdo interactivo para alternar entre pistas y eliminar audio obsoleto.
- **Importador de Audio**: Modal interactivo para cargar nuevas pistas, simular formas de onda y sincronizar los datos de audio en el pipeline de producción.

## 7. Diagrama de Gantt Temporal (`GanttView.tsx`)
- **Cronograma de Pipeline**: Grilla horizontal de días (Día 1 al 36) para auditar solapamientos de departamentos.
- **Editor Interactivo de Etapas**: Permite seleccionar fases para modificar su progreso en %, desplazar días de inicio/fin, reasignar departamentos y colores visuales en caliente.
- **Planificador de Producción**: Creación de nuevas fases desde un modal de importación y eliminación de hitos obsoletos, alertando dinámicamente de posibles cuellos de botella en la producción.

## 8. Galería Unificada del Proyecto (`GaleriaView.tsx`)
- **Muro de Storyboards y Concept Art**: Agrupa imágenes, keyframes de planos y referencias artísticas del proyecto en una galería premium fluida.

## 9. Analíticas de Rendimiento y Exporte (`InformesView.tsx`)
- **Velocímetros**: Gráficos estilizados que indican el rendimiento y velocidad del equipo de trabajo en fotogramas por día.
- **Exportación EDL y OTIO**: Genera archivos estructurados Edit Decision List y OpenTimelineIO para Premiere, DaVinci Resolve o pipelines de postproducción avanzados.
- **Respaldos CSV / JSON**: Descarga física de colecciones completas almacenadas en IndexedDB.

## 10. Vista Unificada de Configuración (`ConfigGeneralView.tsx` y `ConfigProyectoView.tsx`)
- **Panel Unificado con Sidebar**: Consolida la configuración general del sistema, el perfil de usuario, la información técnica de diagnóstico y la gestión detallada del cortometraje en una única interfaz integral de nivel profesional.
- **Tokens de Diseño CSS (Regla 60-30-10)**: Selector de color dinámico que inyecta variables CSS al DOM de la página al instante.
- **Miembros estilo Discord**: Invita colaboradores asignando roles estrictos con privilegios detallados por colección.
- **Seguridad 2FA TOTP & Notificaciones**: Gestión integrada de autenticación multifactor, secretos manuales y simulación de escaneo de código QR (Google Authenticator), junto con preferencias de canales de notificación locales de render.
- **Panel Dev de Auditoría y Semillero**: Consola interactiva para auditar registros de logs locales en tiempo real, limpiar la IndexedDB local o sembrar datos de demostración instantáneamente.

## 11. Arranque Optimizado y Selección de Proyectos (`ProjectSelectionView.tsx`)
- **Arranque Ultra Rápido No Bloqueante**: Se eliminaron retardos artificiales del proceso de inicialización, permitiendo la apertura asíncrona inmediata de DexieJS y la carga instantánea de proyectos locales, mientras la sincronización remota con Firebase ocurre en segundo plano de manera no bloqueante.
- **Encabezado Minimalista**: Interfaz pulida que elimina badges de bienvenida, descripciones redundantes y textos de versión, centrando el protagonismo en el título "Proyectos".
- **Tarjetas de Proyecto Enriquecidas**:
  - **Íconos Personalizados con Canvas**: Soporte para subida de imágenes de hasta 5MB, con herramientas interactivas de recorte, zoom y rotación en tiempo real procesadas a través de Canvas HTML5 y almacenadas como Base64.
  - **Identificación de Roles**: Badge visual que indica el rol del usuario en el proyecto de manera jerárquica (Dueño, Artista, Tutor).
  - **Métricas Claras**: Visualización del progreso en base a la cantidad de "Planos" (renombrado de Shots) y fotogramas totales.

## 12. Barra de Navegación Móvil Condicional
- **Visibilidad Restringida**: La barra de navegación inferior móvil se muestra exclusivamente cuando el usuario se encuentra dentro de un proyecto activo, evitando la sobrecarga visual en la pantalla inicial de selección.
- **Distribución de Módulos Eficiente**: Se eliminó el botón de "Proyectos" de la barra inferior móvil y fue reemplazado en el extremo izquierdo por el acceso directo al módulo de **Informes & Reportes** (ícono `BarChart3`).
