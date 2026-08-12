# Seguridad de Base de Datos y Modelo Multitenant

Este documento describe la arquitectura de seguridad implementada en **Secue** mediante reglas de acceso basado en atributos (**ABAC - Attribute-Based Access Control**) en Cloud Firestore. Estas reglas residen en el archivo de políticas de Firebase y protegen las transacciones de la nueva base de datos remota `secue-main-db` contra manipulaciones no autorizadas, ataques de denegación de cartera ("Denial of Wallet") e inyecciones de datos corruptos.

---

## 1. Los 8 Pilares de Hardening Aplicados

### 1.1 El "Master Gate" (Sincronización Relacional)
Todas las subentidades que pertenecen a un proyecto (`shots`, `assets`, `dailies`, `montages`, `soundtracks`, `audit_logs`) están vinculadas jerárquicamente a través de su propiedad `projectId`. 
Antes de permitir cualquier operación de escritura (`create`, `update`, `delete`), Firestore verifica en tiempo de servidor que:
* El usuario esté autenticado.
* El usuario esté listado dentro del arreglo `members` del documento del proyecto (`/projects/{projectId}`) correspondiente, validando su correo electrónico (`request.auth.token.email`) o ID de usuario (`request.auth.uid`).

### 1.2 Validación de Esquema Completo
Para mitigar la "vulnerabilidad de actualización parcial" (Update-Gaps), cada entidad cuenta con una función de validación standalone (`isValidShot()`, `isValidAsset()`, `isValidDaily()`, etc.). Estas funciones:
* Verifican que todos los tipos de datos sean correctos (`is string`, `is int`, `is list`, `is number`).
* Limitan los valores de estados a enums válidos del pipeline (ej: `Pendiente`, `En_Proceso`, `Aprobado` para planos).
* Controlan de manera estricta la existencia de campos requeridos para evitar registros incompletos.

### 1.3 Protección contra ID Poisoning y Límites de Tamaño
* **Regla de Formato para Identificadores:** Todos los IDs de documentos se someten a `isValidId()`, asegurando que no superen los 64 caracteres de longitud y que cumplan con la expresión regular `^[a-zA-Z0-9_\-]+$`. Esto evita que actores maliciosos inyecten strings pesados como claves.
* **Límites de Tamaño de Campos:** Las descripciones, notas y campos de texto están acotados por `.size() <= MaxLimit` (ej: máximo 1000 caracteres para notas de revisión) para proteger la base de datos contra abusos de almacenamiento.

### 1.4 Lógica de Permisos por Rol
Los usuarios que participan en un proyecto reciben un rol que limita sus acciones:
* **Director / Productor (Admin):** Tiene capacidades completas de aprobación, modificación de rangos de cuadros, asignación de tareas e invitaciones a nuevos miembros.
* **Artista / Colaborador:** Puede subir revisiones (`dailies`), actualizar el progreso de sus renders o tareas asignadas, pero no puede cambiar roles de miembros, eliminar proyectos ni aprobar planos.

### 1.5 Protección Completa de Listas
La lista de cortes de un montaje audiovisual (`cuts` de un `Montage`) y los logs están validados estricta y estructuralmente:
* Se limita la cantidad máxima de cortes por montaje (`cuts.size() <= 200`) para evitar cargas inestables en el render del navegador.
* Las listas de etiquetas de planos (`tags.size() <= 10`) están acotadas para prevenir congestión de metadatos.

### 1.6 Aislamiento de PII (Información Personal Identificable)
La colección `/usuarios/{uid}` resguarda la información del perfil del usuario (nombre, avatar, rol, correo):
* **Lectura:** Un usuario autenticado puede visualizar perfiles del equipo para la asignación ágil de tareas.
* **Escritura (Aislamiento Total):** Un usuario únicamente puede modificar, crear o eliminar su propio documento de perfil, validado por la condición estricta: `request.auth.uid == uid`.

### 1.7 Inmutabilidad del Log de Auditoría
El historial de cambios y bitácora del cortometraje (`/audit_logs/{logId}`) es inmutable por diseño de seguridad:
* **Creación:** Se permite a cualquier usuario miembro del proyecto registrar una entrada de auditoría para documentar acciones en el pipeline.
* **Edición y Eliminación:** Totalmente bloqueada mediante la instrucción `allow update, delete: if false;`. Una vez registrado un log, nunca podrá ser alterado ni eliminado por ningún miembro del equipo o atacante.

### 1.8 Seguridad de Listas y Consultas
Las lecturas masivas (`list`) de colecciones están optimizadas relacionalmente para evitar cobros redundantes O(N) de `get()` en reglas:
* Se evalúa el ID de proyecto directamente del metadato del recurso consultado (`resource.data.projectId`).
* El cliente está obligado a estructurar sus queries de forma segura con la cláusula `.where("projectId", "==", projectId)` para que Firestore apruebe la transacción desde el motor de reglas.

---

## 2. Mapa de Colecciones y Rutas Protegidas

| Colección | Ruta en Firestore | Reglas de Acceso | Mutabilidad |
| :--- | :--- | :--- | :--- |
| **Proyectos** | `/projects/{projectId}` | Lectura general si autenticado; Escritura solo a miembros del proyecto. | Sí |
| **Planos** | `/shots/{shotId}` | Lectura general si miembro; Escritura y asignación limitada a miembros. | Sí |
| **Assets 3D** | `/assets/{assetId}` | Lectura general si miembro; Edición de fases por artistas. | Sí |
| **Daily Renders** | `/dailies/{dailyId}` | Registro por artistas; Edición de comentarios y veredicto por directores. | Sí |
| **Líneas de Tiempo** | `/montages/{montageId}` | Edición reservada a editores y directores de montaje del proyecto. | Sí |
| **Sonido / Foley** | `/soundtracks/{soundtrackId}`| Gestión de pistas de sincronía de audio por timecode. | Sí |
| **Auditoría** | `/audit_logs/{logId}` | Lectura a miembros; Creación para trazabilidad; **Edición prohibida**. | **Inmutable** |
| **Usuarios** | `/usuarios/{uid}` | Escritura restringida estrictamente a `request.auth.uid == uid`. | Sí (Solo dueño) |

---

## 3. Seguridad de Archivos en Firebase Storage

Para proteger los renders (MP4/WebM), storyboards e iconos WebP cargados por los artistas del cortometraje, se implementó un estricto filtrado en Firebase Storage.

### 3.1 Reglas de Acceso a Storage

* **Verificación Relacional en Tiempo de Servidor:** Las rutas de almacenamiento están organizadas bajo la estructura `/projects/{projectId}/{allPaths=**}`.
* **Lógica de Validación de Membresía:** El motor de reglas de Storage realiza una consulta de referencia cruzada asíncrona hacia Firestore mediante `firestore.get()` y `firestore.exists()` para validar que el usuario autenticado (`request.auth.uid` o `request.auth.token.email`) se encuentre registrado como un miembro válido del proyecto en la colección de Firestore.
* **Límite de Tamaño Obligatorio:** Se denegará cualquier intento de subida de archivos que superen los cinco megabytes de tamaño de archivo (`request.resource.size < 5 * 1024 * 1024`) para optimizar el almacenamiento y mitigar abusos de ancho de banda.
* **Seguridad de Archivos:** Esto previene la filtración o manipulación malintencionada de renders y assets multimedia confidenciales de un cortometraje por parte de usuarios externos o atacantes no autorizados.

