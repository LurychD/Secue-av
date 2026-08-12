# Arquitectura Técnica de Secue

Este documento describe detalladamente la arquitectura técnica, los patrones de diseño y los mecanismos de seguridad implementados en la plataforma Secue.

---

## 1. Arquitectura Multi-Tenant

Secue garantiza el aislamiento absoluto de los datos de cada proyecto para evitar cruces de información entre diferentes cortometrajes o equipos de producción.

### 1.1 Aislamiento de Datos
- **Firestore**: Cada documento dentro de las colecciones de la shotlist, assets, dailies, sonido, y bitácoras de auditoría almacena obligatoriamente una propiedad `projectId` de tipo string.
- **Consultas**: Todas las consultas a Firestore y réplicas locales filtran de forma estricta por el `projectId` del proyecto actualmente activo.
- **IndexedDB (DexieJS)**: La base de datos local utiliza esquemas indexados por `[projectId + id]` o mantiene el campo `projectId` como índice secundario clave para asegurar que las lecturas y escrituras offline queden recluidas al espacio de trabajo correcto.

### 1.2 Reglas de Seguridad en Servidor (Firestore Rules)
Las solicitudes se validan en el servidor comprobando que:
1. El usuario esté autenticado (`request.auth != null`).
2. El usuario pertenezca al arreglo `members` del documento del proyecto en la colección principal `/projects/{projectId}`.

---

## 2. Patrón Adaptador Doble

Para independizar el frontend de los proveedores de servicios en la nube, Secue implementa interfaces de abstracción que desacoplan la lógica de presentación de los sistemas de almacenamiento y bases de datos.

```typescript
// Interfaz de Base de Datos
export interface IDatabaseAdapter {
  getDocument<T>(collection: string, id: string): Promise<T>;
  queryDocuments<T>(collection: string, projectId: string, filters?: any): Promise<T[]>;
  saveDocument<T>(collection: string, id: string, data: Partial<T>): Promise<void>;
  deleteDocument(collection: string, id: string): Promise<void>;
  syncPending(pendingChanges: any[]): Promise<void>;
}

// Interfaz de Almacenamiento (Storage)
export interface IStorageAdapter {
  uploadFile(path: string, file: File | Blob): Promise<string>;
  deleteFile(path: string): Promise<void>;
}
```

- **Implementación por Defecto**: Se conecta directamente con Firebase Firestore (apuntando a la instancia de base de datos personalizada `secue-db` de la instancia `secue-av`) y Firebase Storage.
- **Modularidad**: Permite ser sustituido por CouchDB, Supabase, PocketBase o buckets S3 simplemente implementando la misma interfaz.

---

## 3. Sincronización Offline First y Resolución de Conflictos

La plataforma prioriza la operatividad sin conexión a red utilizando una réplica local ultra-eficiente en IndexedDB gestionada con DexieJS.

### 3.1 Tabla de Cambios Pendientes (`pending_sync`)
Cuando el dispositivo se encuentra offline:
1. Las operaciones de escritura impactan inmediatamente en la base de datos local de DexieJS para mantener la interfaz actualizada en tiempo real.
2. Se registra un ticket en la tabla local `pending_sync` con el siguiente esquema:
   - `id`: Autoincremental
   - `collection`: Colección afectada (ej: "shots")
   - `entityId`: ID único del documento
   - `projectId`: ID del proyecto
   - `timestamp`: Marca de tiempo de la modificación local
   - `changes`: Objeto serializado con los campos modificados

### 3.2 Sincronización Remota Incremental
- Al recuperar la conexión, la aplicación envía los paquetes acumulados en `pending_sync` de forma secuencial.
- Las lecturas desde el servidor se optimizan solicitando únicamente los documentos cuya estampa de tiempo `updatedAt` sea superior a la última sincronización guardada localmente.

### 3.3 Fusión Granular Campo por Campo
En lugar de sobreescribir el documento completo con la técnica "Last Write Wins":
1. Se compara cada campo de forma independiente.
2. Si un usuario edita el estado de layout y otro edita la duración de un plano mientras están offline, ambos cambios se fusionan armoniosamente.
3. Si hay conflicto sobre un mismo campo, prevalece la versión con la estampa de tiempo del servidor más reciente.
4. Se levanta un aviso visual no intrusivo en el pie de página de la interfaz para informar al usuario de la resolución.

### 3.4 Resiliencia ante Conflictos de Modo de API (Datastore vs. Native)
En proyectos de Google Cloud / Firebase donde la base de datos predeterminada `(default)` fue configurada por error en **Modo Datastore**, cualquier llamada a las APIs de Firestore Nativo provocará un fallo fatal de permisos/modo de acceso.
Para asegurar la resiliencia y evitar fallas en la experiencia de usuario:
1. **Detección Dinámica**: El adaptador intercepta las excepciones que contienen patrones de error específicos como `"Firestore in Native mode API is disabled"`, `"Datastore mode"` o `"Data Access modes"`.
2. **Degradación del Servicio (Graceful Fallback)**: Al detectarse la falla, la aplicación marca de manera reactiva una bandera global `isFirestoreDisabledForModeConflict` que inhabilita las llamadas salientes a Firestore para toda la sesión.
3. **Persistencia Autónoma**: La aplicación continúa operando con un rendimiento del 100% sobre la base local IndexedDB (DexieJS), previniendo inundaciones de logs de error en consola o pantallas en blanco.
4. **Alerta de Diagnóstico**: Se despacha un evento nativo (`firestore-mode-conflict`) que captura la consola del desarrollador en el **Panel Dev** de Secue para aconsejar al administrador cómo configurar una base de datos secundaria nativa e inyectar el parámetro `VITE_FIREBASE_DATABASE_ID`.

---

## 4. Optimización de Consumo de Base de Datos

### 4.1 Escrituras Acumuladas (Debounce de 2 Segundos)
- Las modificaciones continuas en campos de texto (ej: notas de dirección, comentarios en dailies, cambios rápidos de estado) se guardan instantáneamente en IndexedDB.
- Un temporizador pospone la subida a Firestore durante **2 segundos**. Si el usuario sigue tipeando, el temporizador se reinicia. Al finalizar la inactividad, se envía un lote consolidado a Firestore en una única operación de red.

### 4.2 Contadores Agregados en el Documento Raíz
- Para evitar lecturas masivas y costosas de toda la shotlist para calcular estadísticas del proyecto:
- El documento raíz de cada proyecto en la colección `/projects/{projectId}` aloja un objeto de contadores de alto nivel (ej: `totalShots`, `completedShots`, `totalDuration`).
- Cada vez que un plano se crea, borra o cambia de estado a "completado", el adaptador actualiza de forma atómica estos contadores en el servidor mediante transacciones de Firestore.

---

## 5. Mejoras de Interfaz, Navegación y Token de Diseño

En la última iteración, se aplicaron cinco correcciones estructurales para optimizar la experiencia de usuario, la navegación global y la maquetación adaptable en dispositivos móviles.

### 5.1 Pantalla de Carga Inicial Secuencial y Dinámica
- **Objetivo**: Brindar retroalimentación visual amigable al iniciar la aplicación.
- **Implementación**: Se integró un temporizador de pasos de inicialización que muestra secuencialmente el estado del pipeline local (DexieJS, verificación de credenciales, sincronización de planos con `secue-db` e inicialización de la interfaz).
- **Control Visual**: Barra de progreso con gradiente y animación de pulso sobre el icono de claqueta nativa de Secue.

### 5.2 Cabecera Superior Global Persistente y Omnibox
- **Estructura Fija**: Cabecera de `16px (h-16)` anclada en la parte superior en todas las vistas de la aplicación.
- **Elementos**: Icono de claqueta, nombre de marca "Secue", selector rápido de cortometraje multi-tenant, barra de búsqueda Omnibox centralizada, botón de configuración general.
- **Omnibox Unificado**: El buscador integrado realiza consultas en tiempo real a IndexedDB filtrando vistas de la aplicación, proyectos disponibles, planos del corto activo y assets asociados. Soporta enfoque rápido con el atajo de teclado nativo `Ctrl+K`.

### 5.3 Selector de Color de Acento (RGB Picker) y WCAG 2.0
- **Rango Cromático**: Selector RGB integrado en `ConfigProyectoView.tsx` mediante tres controles deslizantes independientes (Red, Green, Blue) para dar acceso a más de 16 millones de colores.
- **Cálculo de Legibilidad Automático**: Se programó un helper matemático HSL que analiza el color seleccionado en tiempo real. Genera de forma automatizada dos colores de acento complementarios de alto contraste (`accentLight` para temas claros y `accentDark` para temas oscuros) que garantizan una relación de contraste superior a 4.5:1 (conforme a la norma WCAG 2.0 AA).
- **Inyección de CSS**: Los tokens se inyectan dinámicamente en el DOM como variables CSS (`--secue-bg`, `--secue-panel`, `--secue-accent`, `--secue-accent-light`, `--secue-accent-dark`).

### 5.4 Maquetación Móvil y Control de Desbordes
- **Aislamiento de Ancho**: Se aplicó la restricción `overflow-x-hidden` en el contenedor raíz para erradicar cualquier desplazamiento horizontal indeseado en pantallas chicas.
- **Sidebar Derecha**: La barra lateral en móviles se comporta como un cajón (drawer) que se desliza de derecha a izquierda (`right-0`, traducción de `translate-x-full` a `0`), complementado por un fondo oscuro difuminado (backdrop blur) para cerrar con un toque simple.

### 5.5 Barra de Navegación Inferior en Celulares (6 Iconos)
- **Posición Fija**: Menú inferior de `16px (h-16)` visible en pantallas móviles (`md:hidden`) anclada en el borde inferior.
- **Secciones Sincronizadas**:
  1. **Proyectos**: Regresa al panel general de cortometrajes.
  2. **Shotlist**: Despliega la lista de planos.
  3. **Assets**: Inventario de utilería y modelos 3D/2D.
  4. **Dailies**: Panel de aprobación de renders de producción.
  5. **Alertas**: Cronograma Gantt de hitos temporales.
  6. **Sonido**: Módulo de pistas de sonido y foleys.
- **Control de Colisión**: Se añadió un relleno inferior adaptado a dispositivos móviles para evitar colisiones con elementos interactivos de los extremos de la pantalla.

---

## 6. Mejoras de Resiliencia y Visualización Offline First

En esta iteración se consolidó la arquitectura Offline First mediante tres mecanismos técnicos avanzados que aseguran una operatividad impecable frente a desconexiones o redes inestables:

### 6.1 Estrategia de Carga Local-First y Sincronización en Segundo Plano
- **Lectura Local Inmediata**: Las funciones de lectura del adaptador (`getProject`, `listProjects`, `getUserSettings`, etc.) consultan obligatoriamente la base IndexedDB (DexieJS) en primera instancia. Si los datos existen localmente, se entregan de forma instantánea al frontend sin esperar a que se resuelva la consulta en la nube, eliminando bloqueos de interfaz.
- **Sincronización Asíncrona**: En segundo plano (background sync), si el navegador tiene conectividad, se consulta Firestore de forma silenciosa para obtener posibles actualizaciones y fusionarlas localmente. Si se detectan cambios con respecto a la memoria local, se actualiza IndexedDB de forma incremental y se despacha un evento global nativo (`local-db-updated`) para refrescar las pantallas correspondientes de forma reactiva.

### 6.2 Captura Silenciosa de Errores de Red
- **Supresión de Excepciones Ruidosas**: Los bloques `catch` de las operaciones de base de datos interceptan errores de conexión del cliente (`Failed to get document because the client is offline` o fallos de conexión similares).
- **Manejo Discreto**: En lugar de saturar la consola con trazas de error (`console.error`), el adaptador evalúa la naturaleza del fallo, devuelve de forma fluida los datos existentes en la memoria local IndexedDB y registra un mensaje estrictamente informativo (`console.info`) sobre la continuidad en modo sin conexión.

### 6.3 Indicadores Visuales en la Interfaz (UI/UX)
- **Badge Global de Cabecera**: Un indicador dinámico integrado en la barra de navegación superior muestra en tiempo real el estado de sincronización:
  - **Sincronizado**: Verde, indica que la cola de cambios pendientes está vacía y listos en la nube.
  - **Sincronizando...**: Amarillo, con animación de latido, mientras se ejecuta la subida en segundo plano de cambios pendientes.
  - **Sin Conexión**: Rojo, detallando el recuento preciso de modificaciones pendientes de sincronizar acumuladas en DexieJS.
- **Indicadores por Elemento**: Las tarjetas de assets y las filas de planos despliegan un punto de alerta ámbar pulsante discreto cuando contienen modificaciones realizadas offline que todavía residen en la cola de sincronización.
- **Protección de Cierre de Pestaña**: Se registró un manejador para el evento `beforeunload`. Si el usuario intenta cerrar o refrescar el navegador teniendo cambios pendientes en la cola local, se despliega una advertencia clara para evitar la pérdida accidental de datos.
