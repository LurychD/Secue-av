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

---

## 4. Optimización de Consumo de Base de Datos

### 4.1 Escrituras Acumuladas (Debounce de 2 Segundos)
- Las modificaciones continuas en campos de texto (ej: notas de dirección, comentarios en dailies, cambios rápidos de estado) se guardan instantáneamente en IndexedDB.
- Un temporizador pospone la subida a Firestore durante **2 segundos**. Si el usuario sigue tipeando, el temporizador se reinicia. Al finalizar la inactividad, se envía un lote consolidado a Firestore en una única operación de red.

### 4.2 Contadores Agregados en el Documento Raíz
- Para evitar lecturas masivas y costosas de toda la shotlist para calcular estadísticas del proyecto:
- El documento raíz de cada proyecto en la colección `/projects/{projectId}` aloja un objeto de contadores de alto nivel (ej: `totalShots`, `completedShots`, `totalDuration`).
- Cada vez que un plano se crea, borra o cambia de estado a "completado", el adaptador actualiza de forma atómica estos contadores en el servidor mediante transacciones de Firestore.
