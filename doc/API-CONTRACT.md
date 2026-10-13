# API Contract

## Objetivo

Definir el contrato de comunicación entre el Frontend y el Backend del proyecto.

Este documento establece:

* endpoints disponibles;
* métodos HTTP;
* parámetros;
* body esperado;
* estructura de las respuestas;
* códigos de estado;
* formato de errores.

Frontend y Backend deberán respetar este contrato durante el desarrollo.

---

# Configuración general

## URL base

Durante desarrollo local:

```text id="11ht0o"
http://localhost:3000/api
```

Ejemplo:

```text id="cvn5dn"
GET http://localhost:3000/api/tasks
```

En Frontend se deberá utilizar una variable de entorno:

```env id="ipbk0m"
VITE_API_URL=http://localhost:3000/api
```

---

# Formato general

La comunicación entre Frontend y Backend utilizará:

```text id="wpeqtz"
HTTP
+
JSON
```

Las peticiones que envíen información deberán utilizar:

```http id="8xsmxa"
Content-Type: application/json
```

---

# Códigos HTTP

Se utilizarán principalmente:

| Código | Uso                                 |
| ------ | ----------------------------------- |
| `200`  | operación realizada correctamente   |
| `201`  | recurso creado correctamente        |
| `204`  | operación correcta sin contenido    |
| `400`  | datos enviados incorrectos          |
| `401`  | usuario no autenticado              |
| `403`  | usuario sin permisos                |
| `404`  | recurso no encontrado               |
| `409`  | conflicto con información existente |
| `500`  | error interno del servidor          |

---

# Formato de errores

Los errores deberán mantener una estructura consistente.

```json id="mjkhlb"
{
  "message": "La tarea no fue encontrada"
}
```

Cuando existan errores de validación:

```json id="s6egxy"
{
  "message": "Los datos enviados no son válidos",
  "errors": [
    {
      "field": "title",
      "message": "El título es obligatorio"
    }
  ]
}
```

Frontend no deberá depender de mensajes internos del servidor.

---

# Usuarios

## Registrar usuario

```http id="vu0qsd"
POST /api/users
```

### Body

```json id="jpo9qd"
{
  "email": "usuario@email.com",
  "password": "contraseña"
}
```

### Respuesta `201`

```json id="zigajf"
{
  "id": 1,
  "email": "usuario@email.com"
}
```

### Posibles errores

```text id="42z7ih"
400 datos inválidos
409 email ya registrado
```

---

## Obtener usuario

```http id="onnh7j"
GET /api/users/:id
```

### Respuesta `200`

```json id="bgxa2w"
{
  "id": 1,
  "email": "usuario@email.com"
}
```

---

# Autenticación

## Iniciar sesión

```http id="hv2sqc"
POST /api/auth/login
```

### Body

```json id="x25z3s"
{
  "email": "usuario@email.com",
  "password": "contraseña"
}
```

### Respuesta `200`

```json id="l59y6g"
{
  "user": {
    "id": 1,
    "email": "usuario@email.com"
  },
  "token": "TOKEN"
}
```

### Error `401`

```json id="2ccbo0"
{
  "message": "Credenciales incorrectas"
}
```

---

# Perfil

## Obtener perfil

```http id="qo9ya3"
GET /api/profiles/:userId
```

### Respuesta `200`

```json id="ga7laq"
{
  "id": 1,
  "user_id": 1,
  "name": "Iván",
  "last_name": "Gómez",
  "nickname": "IvanDev",
  "avatar_url": null
}
```

---

## Crear perfil

```http id="hzob6x"
POST /api/profiles
```

### Body

```json id="ur42cm"
{
  "user_id": 1,
  "name": "Iván",
  "last_name": "Gómez",
  "nickname": "IvanDev",
  "avatar_url": null
}
```

### Respuesta `201`

```json id="i12mxv"
{
  "id": 1,
  "user_id": 1,
  "name": "Iván",
  "last_name": "Gómez",
  "nickname": "IvanDev",
  "avatar_url": null
}
```

---

## Actualizar perfil

```http id="182vqp"
PUT /api/profiles/:id
```

### Body

```json id="zrgl0b"
{
  "nickname": "Ivan",
  "avatar_url": "https://..."
}
```

### Respuesta `200`

```json id="jf067z"
{
  "id": 1,
  "nickname": "Ivan",
  "avatar_url": "https://..."
}
```

---

# Profesores

## Obtener profesores

```http id="cd0prb"
GET /api/teachers
```

### Respuesta `200`

```json id="4zehln"
[
  {
    "id": 1,
    "name": "Juan Pérez"
  }
]
```

---

## Crear profesor

```http id="uqaguk"
POST /api/teachers
```

### Body

```json id="9wvj7z"
{
  "name": "Juan Pérez"
}
```

### Respuesta `201`

```json id="0ysmr0"
{
  "id": 1,
  "name": "Juan Pérez"
}
```

---

# Materias

## Obtener materias

```http id="mkjm7p"
GET /api/subjects
```

### Respuesta `200`

```json id="n6xp4m"
[
  {
    "id": 1,
    "name": "Programación",
    "teacher": {
      "id": 1,
      "name": "Juan Pérez"
    }
  }
]
```

---

## Obtener una materia

```http id="5ow14y"
GET /api/subjects/:id
```

### Respuesta `200`

```json id="pa9x6b"
{
  "id": 1,
  "name": "Programación",
  "teacher": {
    "id": 1,
    "name": "Juan Pérez"
  }
}
```

---

## Crear materia

```http id="9tmmu8"
POST /api/subjects
```

### Body

```json id="tsbeky"
{
  "name": "Programación",
  "teacher_id": 1
}
```

### Respuesta `201`

```json id="b90dzx"
{
  "id": 1,
  "name": "Programación",
  "teacher_id": 1
}
```

---

## Actualizar materia

```http id="4cd14t"
PUT /api/subjects/:id
```

### Body

```json id="7ku0nu"
{
  "name": "Programación II",
  "teacher_id": 2
}
```

### Respuesta `200`

```json id="g5vq75"
{
  "id": 1,
  "name": "Programación II",
  "teacher_id": 2
}
```

---

## Eliminar materia

```http id="ksmdac"
DELETE /api/subjects/:id
```

### Respuesta `200`

```json id="hm0ezg"
{
  "message": "La materia fue eliminada correctamente"
}
```

---

# Tareas

## Obtener tareas

```http id="57bpxf"
GET /api/tasks
```

### Respuesta `200`

```json id="mhp1gz"
[
  {
    "id": 1,
    "title": "Trabajo práctico API",
    "description": "Crear endpoints de usuarios",
    "due_date": "2026-09-30",
    "status": "pending",
    "subject_id": 1
  }
]
```

---

## Obtener tareas de una materia

```http id="a9ibcr"
GET /api/subjects/:subjectId/tasks
```

### Respuesta `200`

```json id="j603ax"
[
  {
    "id": 1,
    "title": "Trabajo práctico API",
    "due_date": "2026-09-30",
    "status": "pending"
  }
]
```

---

## Obtener una tarea

```http id="dnf2aq"
GET /api/tasks/:id
```

### Respuesta `200`

```json id="4wwjrc"
{
  "id": 1,
  "title": "Trabajo práctico API",
  "description": "Crear endpoints",
  "due_date": "2026-09-30",
  "status": "pending",
  "subject_id": 1
}
```

---

## Crear tarea

```http id="8gbb0z"
POST /api/tasks
```

### Body

```json id="erqyw3"
{
  "title": "Trabajo práctico API",
  "description": "Crear endpoints de usuarios",
  "due_date": "2026-09-30",
  "subject_id": 1
}
```

### Respuesta `201`

```json id="8tstp2"
{
  "id": 1,
  "title": "Trabajo práctico API",
  "description": "Crear endpoints de usuarios",
  "due_date": "2026-09-30",
  "status": "pending",
  "subject_id": 1
}
```

---

## Actualizar tarea

```http id="1iwx02"
PUT /api/tasks/:id
```

### Body

```json id="1q0rmh"
{
  "title": "Trabajo práctico actualizado",
  "due_date": "2026-10-02"
}
```

### Respuesta `200`

```json id="apg7cn"
{
  "id": 1,
  "title": "Trabajo práctico actualizado",
  "due_date": "2026-10-02",
  "status": "pending"
}
```

---

## Marcar tarea como completada

```http id="79bjeu"
PATCH /api/tasks/:id/status
```

### Body

```json id="6izynn"
{
  "status": "completed"
}
```

### Respuesta `200`

```json id="x6vobv"
{
  "id": 1,
  "status": "completed"
}
```

Estados permitidos:

```text id="oupntx"
pending
in_progress
completed
```

---

## Eliminar tarea

```http id="aujaat"
DELETE /api/tasks/:id
```

### Respuesta `200`

```json id="rqztad"
{
  "message": "La tarea fue eliminada correctamente"
}
```

---

# Notas de tareas

## Obtener notas

```http id="s6ldls"
GET /api/tasks/:taskId/notes
```

### Respuesta `200`

```json id="i8jh4t"
[
  {
    "id": 1,
    "content": "Preguntar al profesor sobre Sequelize",
    "task_id": 1
  }
]
```

---

## Crear nota

```http id="rkdz5o"
POST /api/tasks/:taskId/notes
```

### Body

```json id="nnqz66"
{
  "content": "Preguntar al profesor sobre Sequelize"
}
```

### Respuesta `201`

```json id="ggfrnp"
{
  "id": 1,
  "content": "Preguntar al profesor sobre Sequelize",
  "task_id": 1
}
```

---

## Actualizar nota

```http id="8pgjis"
PUT /api/notes/:id
```

### Body

```json id="4plv3v"
{
  "content": "Consultar Sequelize y relaciones"
}
```

---

## Eliminar nota

```http id="7uqdcr"
DELETE /api/notes/:id
```

---

# Exámenes

## Obtener exámenes

```http id="nbwype"
GET /api/exams
```

### Respuesta `200`

```json id="rpthjl"
[
  {
    "id": 1,
    "title": "Primer parcial",
    "exam_date": "2026-10-10",
    "grade": null,
    "subject_id": 1
  }
]
```

---

## Obtener exámenes de una materia

```http id="mk8okc"
GET /api/subjects/:subjectId/exams
```

---

## Obtener un examen

```http id="oets1r"
GET /api/exams/:id
```

---

## Crear examen

```http id="t6qt7b"
POST /api/exams
```

### Body

```json id="5uh16e"
{
  "title": "Primer parcial",
  "exam_date": "2026-10-10",
  "topics": "Express, Sequelize y APIs",
  "subject_id": 1
}
```

### Respuesta `201`

```json id="ufbpu5"
{
  "id": 1,
  "title": "Primer parcial",
  "exam_date": "2026-10-10",
  "topics": "Express, Sequelize y APIs",
  "grade": null,
  "subject_id": 1
}
```

---

## Actualizar examen

```http id="34vbyr"
PUT /api/exams/:id
```

---

## Registrar nota del examen

```http id="3coru3"
PATCH /api/exams/:id/grade
```

### Body

```json id="u6kbxx"
{
  "grade": 8
}
```

### Respuesta `200`

```json id="7y5j0f"
{
  "id": 1,
  "grade": 8
}
```

---

## Eliminar examen

```http id="2tekcs"
DELETE /api/exams/:id
```

---

# Actividades de estudio

## Obtener actividades

```http id="vx3y49"
GET /api/study-activities
```

---

## Crear actividad

```http id="mww7bw"
POST /api/study-activities
```

### Body

```json id="hi36ae"
{
  "title": "Repasar Sequelize",
  "target_date": "2026-10-08",
  "subject_id": 1
}
```

### Respuesta `201`

```json id="v55wj6"
{
  "id": 1,
  "title": "Repasar Sequelize",
  "target_date": "2026-10-08",
  "status": "pending",
  "subject_id": 1
}
```

---

## Actualizar estado

```http id="q897vb"
PATCH /api/study-activities/:id/status
```

### Body

```json id="fn0nsj"
{
  "status": "completed"
}
```

---

# Próximas actividades

Para facilitar la pantalla principal, el backend podrá proporcionar un endpoint que reúna las actividades próximas.

```http id="5itjdj"
GET /api/dashboard/upcoming
```

### Respuesta `200`

```json id="ts26zo"
{
  "tasks": [
    {
      "id": 1,
      "title": "Trabajo práctico",
      "due_date": "2026-09-30",
      "subject": "Programación"
    }
  ],
  "exams": [
    {
      "id": 2,
      "title": "Primer parcial",
      "exam_date": "2026-10-10",
      "subject": "Base de Datos",
      "days_remaining": 20
    }
  ],
  "study_activities": [
    {
      "id": 3,
      "title": "Repasar normalización",
      "target_date": "2026-09-25"
    }
  ]
}
```

El cálculo de:

```text id="x0n6x3"
days_remaining
```

deberá realizarse en función de la fecha actual y la fecha del examen.

---

# Notificaciones

Las notificaciones estarán asociadas principalmente a:

```text id="qbl87g"
tareas próximas
exámenes próximos
actividades de estudio
```

Endpoint inicial:

```http id="hg242a"
GET /api/notifications
```

### Respuesta `200`

```json id="8wqgbe"
[
  {
    "id": 1,
    "type": "exam",
    "message": "Faltan 3 días para el parcial de Programación",
    "read": false
  }
]
```

---

# Convenciones de nombres

Los nombres enviados por la API utilizarán:

```text id="bhx2s7"
snake_case
```

Ejemplos:

```text id="ew4eb0"
user_id
subject_id
task_id
due_date
exam_date
target_date
avatar_url
```

Frontend deberá respetar estos nombres al enviar información al Backend.

---

# Fechas

Las fechas deberán enviarse en formato:

```text id="71lms7"
YYYY-MM-DD
```

Ejemplo:

```text id="xz1cv7"
2026-10-10
```

Si posteriormente se necesitan fecha y hora:

```text id="za25wx"
ISO 8601
```

Ejemplo:

```text id="skjcfi"
2026-10-10T18:30:00
```

---

# Regla de modificación del contrato

Frontend y Backend no deberán modificar unilateralmente:

```text id="s6llrv"
rutas
nombres de campos
métodos HTTP
estructura JSON
estados
```

Si se necesita modificar el contrato:

```text id="77blp6"
se propone el cambio
        ↓
se acuerda entre Frontend y Backend
        ↓
se actualiza api-contract.md
        ↓
se modifica el código
```

El documento deberá mantenerse actualizado durante todo el desarrollo.

---

# Resumen de endpoints

```text id="zmk50v"
AUTH
POST   /api/auth/login

USERS
POST   /api/users
GET    /api/users/:id

PROFILES
GET    /api/profiles/:userId
POST   /api/profiles
PUT    /api/profiles/:id

TEACHERS
GET    /api/teachers
POST   /api/teachers

SUBJECTS
GET    /api/subjects
GET    /api/subjects/:id
POST   /api/subjects
PUT    /api/subjects/:id
DELETE /api/subjects/:id

TASKS
GET    /api/tasks
GET    /api/tasks/:id
GET    /api/subjects/:subjectId/tasks
POST   /api/tasks
PUT    /api/tasks/:id
PATCH  /api/tasks/:id/status
DELETE /api/tasks/:id

TASK NOTES
GET    /api/tasks/:taskId/notes
POST   /api/tasks/:taskId/notes
PUT    /api/notes/:id
DELETE /api/notes/:id

EXAMS
GET    /api/exams
GET    /api/exams/:id
GET    /api/subjects/:subjectId/exams
POST   /api/exams
PUT    /api/exams/:id
PATCH  /api/exams/:id/grade
DELETE /api/exams/:id

STUDY ACTIVITIES
GET    /api/study-activities
POST   /api/study-activities
PATCH  /api/study-activities/:id/status

DASHBOARD
GET    /api/dashboard/upcoming

NOTIFICATIONS
GET    /api/notifications
```


# Progreso del tutorial del estudiante

Estas rutas aditivas requieren JWT y rol real `student`; no aceptan un usuario destino.
El perfil debe existir: 404 si falta. No cambian las respuestas de las rutas de perfil.

- `GET /api/profiles/onboarding`: devuelve `{ version: 1, status, step, revision }`
  sin escribir. Sin progreso: `status=not_started`, `step=0`, `revision=0`.
- `PUT /api/profiles/onboarding`: body exacto `{ status, step, revision }`.
  `status`: `in_progress`, `paused`, `skipped`, `completed`; `step`: entero 0–7.
  `completed` exige paso 7. `revision` es un entero coincidente con la última lectura.
  Respuesta 200 con versión 1 y revisión incrementada; revisión obsoleta:409,
  datos/campos extra inválidos:400; sin sesión:401; superadministrador:403.

Persiste únicamente la clave `onboarding` del JSON `profiles.preferences`, conservando
otras preferencias. No crea perfiles ni actividades y no requiere migración.
Detalles: [GUIDED-ONBOARDING.md](GUIDED-ONBOARDING.md).

# Web Push: preferencias y reglas

Configuración web/PWA; el transporte push y planificador se implementarán después.
Todas las rutas requieren JWT Bearer; el usuario se obtiene de req.user.id.
GET /api/notifications conserva su comportamiento.

## Preferencias

GET /api/notifications/preferences devuelve valores predeterminados sin insertar filas.
PUT /api/notifications/preferences reemplaza los campos siguientes (todos obligatorios):

```json
{
  "enabled": false, "timezone": "America/Argentina/Cordoba",
  "exams_enabled": false, "tasks_enabled": false,
  "exam_default_time": "09:00", "task_default_time": "09:00",
  "exam_style": "formal", "task_style": "formal",
  "unfiltered_enabled": false, "quiet_hours_enabled": false,
  "quiet_start": null, "quiet_end": null
}
```

Respuesta 200: esos campos más revision y unfiltered_consented_at (UTC o null).
Estilos: formal, friendly, motivating, sarcastic, unfiltered, custom; visibles en español.
Sin filtro requiere unfiltered_enabled=true explícito; consentimiento registrado por
el servidor. Revocación exige elegir estilos distintos de unfiltered.
Zona IANA editable; horas HH:mm. Silencio activo exige inicio y fin diferentes;
inactivo exige ambos null. Puede cruzar medianoche. Campos desconocidos se rechazan.
No aceptar user_id, revision ni fecha de consentimiento del cliente.

## Reglas

GET /api/notifications/rules (filtro opcional event_type=exam|task).
POST /api/notifications/rules (201). PUT /api/notifications/rules/:id (200).
DELETE /api/notifications/rules/:id (204). Solo reglas propias.
Cuerpo POST/PUT completo: { event_type, amount, unit, enabled }.
amount: entero >=0; unit: minutes, hours o days; enabled: booleano.
Respuesta: { id, event_type, offset_minutes, enabled }; horas x60 y días x1440.
Máximo 5 reglas por tipo y estudiante, incluyendo desactivadas; hasta 43200 minutos
(30 días) por regla; 0 permite aviso a la hora efectiva. Duplicados por tipo/duración:409.
JWT inválido:401; regla inexistente/ajena:404; validaciones:400; límite excedido:409.
Las escrituras se serializan por usuario para no superar el límite concurrentemente.

## Hora del evento y cálculo

Agregar exam_time a exámenes y due_time a tareas, opcionales HH:mm o null.
Fecha YYYY-MM-DD obligatoria en exámenes. En tareas, due_date puede omitirse o ser null para indicar «Sin fecha de entrega»; una cadena vacía no es válida. Omitir due_date al actualizar conserva la fecha, y null la elimina y limpia due_time. Las tareas sin fecha no generan recordatorios de vencimiento. Omitir hora conserva compatibilidad.
En actualización, omitir conserva y null elimina. Persistencia TIME HH:mm:00.
Hora explícita prevalece sobre fallback del tipo. Fecha/hora se interpretan en zona
del estudiante; duración se resta en minutos transcurridos y los instantes usan UTC.
Hora inexistente por DST: primera hora válida posterior; ambigua: primera ocurrencia.
Silencio: aplazar hasta el final solo si no pasó el evento; omitir si lo supera.
No enviar exámenes al alcanzar/pasar su hora efectiva; tareas completadas cancelan
pendientes. Los avisos en el instante exacto del examen se omiten por esta regla.
Cambios efectivos de preferencias/reglas incrementan revision; replanificar solo
pendientes, sin reenviar entregados. Eventos editados se releen antes del envío.
La cola de entregas, cancelación persistente y deduplicación de envíos pertenecen
a la siguiente etapa, no a estos endpoints de configuración.


## Frases propias y vista previa local

Sexto estilo `custom` (Mis propias frases), independiente para examen/entrega.
Se exige al menos una frase propia del tipo al guardar ese estilo. Las cinco
personalidades originales se conservan; `unfiltered` sigue exigiendo consentimiento.

Todas estas rutas requieren JWT Bearer y usan exclusivamente `req.user.id`:

- GET `/api/notifications/phrases`: lista propia, filtro opcional `event_type=exam|task`.
- POST `/api/notifications/phrases`: 201; cuerpo `{ "event_type": "exam", "content": "Mi frase" }`.
- PUT `/api/notifications/phrases/:id`: 200; mismo cuerpo completo.
- DELETE `/api/notifications/phrases/:id`: 204.

Respuesta de frase: `{ id, event_type, content }`. Máximo **10 frases total por usuario**
entre ambos tipos, con escrituras serializadas por bloqueo de la fila del usuario.
Texto plano recortado, 1–240 caracteres; vacío, saltos de línea, controles y controles
bidireccionales se rechazan. Se permite lenguaje coloquial. No interpretar HTML.
No aceptar `user_id` ni otros campos. Duplicado por usuario/tipo/contenido: 409
(la unicidad en MySQL también respeta su collation). Límite: 409; ajena/inexistente:404;
JWT:401; validación:400. Cambios efectivos incrementan `revision`.
Si el estilo guardado es custom, no se puede eliminar o cambiar de tipo su última
frase:409; elegir primero otro estilo. No se pierde la selección silenciosamente.

POST `/api/notifications/preview` es de **solo lectura**, aunque usa POST para el cuerpo:

```json
{ "event_type": "exam", "style": "formal", "unfiltered_consent": false }
```

`previous_phrase` es opcional (texto de hasta 240 caracteres); permite elegir otra
frase cuando hay alternativas. Respuesta 200: `{ title, body, phrase }`.
Usa un evento claramente ficticio para mañana en la zona y horario predeterminado
**guardados** del estudiante, sin crear eventos. Custom usa solo sus frases del tipo;
sin frases:400. Sin filtro exige `unfiltered_consent=true` explícito para esa prueba,
sin modificar ni registrar consentimiento o preferencias guardadas.

GET `/api/notifications` conserva formato `{ id, type, message, read }`, pertenencia
y ventana de próximos siete días, sin depender de la activación Push. Exámenes y
entregas usan ahora la personalidad guardada, alternando variantes en la lista.
Fokus siempre agrega título del evento, materia, fecha DATEONLY, hora efectiva y zona.
Hora explícita prevalece sobre horario guardado; custom sin frases o sin filtro sin
consentimiento usa formal como protección. Actividades de estudio conservan su texto.

El botón de prueba muestra exactamente `title`/`body` de la vista previa, con ícono
Fokus. La prueba local no usa transporte remoto. El transporte Web Push manual se define abajo; todavía no hay cola ni registros de entrega.


## Web Push manual por dispositivo

Contrato detallado en [WEB-PUSH-TRANSPORT.md](WEB-PUSH-TRANSPORT.md).
Todas las rutas JWT bajo `/api/notifications/push`:

- GET `/config`: `{ enabled, public_key }`, solo clave pública.
- GET `/subscriptions`: metadata de dispositivos propios, nunca endpoints/claves.
- POST `/subscriptions`: UUIDv4 `device_id`, `device_label` opcional y `subscription`
  estándar `{ endpoint, keys: { p256dh, auth }, expirationTime? }`. Alta/renovación200.
- DELETE `/subscriptions/:id`: propia204; ajena/inexistente404.
- POST `/test/:id`: cuerpo de preview con `selected_phrase` opcional validada;
  destino propio,202 aceptación de proveedor. Sin filtro exige consentimiento explícito.

Máximo10 dispositivos por usuario; unicidad usuario/dispositivo y endpoint hash global.
HTTPS/proveedores y curva de claves validados. Rechazar user_id/campos desconocidos.
400 inválida,401 JWT,404 ajena,409 duplicado/límite,410 vencida y eliminada,429 pruebas
excesivas,503 VAPID no configurado/proveedor falló. No revelar errores del proveedor.
`selected_phrase` también es opcional en preview (1–240 caracteres y debe pertenecer
al estilo o al usuario/tipo). Preserva exactamente la frase visible al probar envío.
Ninguna prueba modifica preferencias ni crea recordatorios/eventos/registros de entrega.
No implementa aún planificador, reintentos ni envío automático de próximos eventos.

## Procesamiento interno de recordatorios (preparado, deshabilitado)

`POST /api/internal/notifications/process` acepta únicamente cuerpo vacío/`{}` y autenticación Bearer de servicio mediante `NOTIFICATION_SERVICE_TOKEN`; el JWT estudiantil no autoriza esta operación. Requiere habilitación explícita `NOTIFICATION_WORKER_ENABLED=true`, VAPID y migraciones vigentes. Responde contadores agregados o `{ "skipped": "busy" }`; errores 401 (servicio no autorizado), 400 (parámetros no admitidos), 429 (límite), 503 (deshabilitado/configuración). No permite elegir usuarios ni modificar el tamaño del lote. Véase `WEB-PUSH-REMINDERS.md`.


## Gestión de cuentas, administración y bandeja (rama de implementación)

Requiere migraciones 20 y 21 preparadas, todavía sin ejecutar. El registro siempre crea
un usuario `student`, incluso si recibe un campo `role` o el correo del administrador.
Login devuelve `user: { id, email, role }`; la autorización verifica existencia y rol
actuales en la base en cada petición. Un JWT de una cuenta eliminada recibe 401.

- `DELETE /api/users/me`: JWT, contraseña actual (`password`) y
  `confirmation: "ELIMINAR"`. No acepta un identificador de otro usuario.
  Devuelve 204 únicamente tras confirmar la transacción; 400 por confirmación inválida,
  403 por contraseña incorrecta y 409 si el worker está ocupado o hay relaciones
  inconsistentes/una foto cuya propiedad no se puede verificar. Limitado por usuario.
  Borra datos propios y fotos del espacio de nombres verificado del usuario, sin alterar respaldos del proveedor. Las subidas de avatar comparten el bloqueo de cuenta.
  Comparte el bloqueo existente del worker. La foto externa no participa de la
  transacción SQL: si su retiro ocurrió antes de un fallo SQL, no afirmar éxito;
  la cuenta conserva sus registros y se puede reintentar la eliminación idempotente.
- `GET /api/admin/statistics`: JWT y rol real `superadmin`. Devuelve únicamente
  `totals` (users/subjects/tasks/exams), registros en 7 días, usuarios con cambios
  académicos en 7 días, definición de esa actividad, 30 conteos diarios de registros,
  zona UTC y fecha de cálculo. No informa visitas/logins ni datos personales.
- `GET /api/notifications`: conserva mensajes y devuelve además `date`; `id` pasa
  a ser una clave opaca estable (SHA-256) por usuario, tipo, evento y fecha.
  La bandeja sigue siendo una proyección de eventos próximos; no se presenta como
  un historial de recepción del proveedor Push. Omite los avisos eliminados.
- `DELETE /api/notifications/:id`: JWT y clave propia. Devuelve 204 idempotente,
  400 para formato inválido y 404 si no pertenece a la bandeja del usuario.
  Guarda la eliminación sin borrar eventos ni cambiar futuros recordatorios.
  El mismo evento con una fecha nueva representa otro aviso; cambios de orden
  o personalidad no reintroducen el aviso eliminado.

### Habilitación controlada del superadministrador

Comprobar manualmente identidad y titularidad del correo aprobado, obtener el ID
existente y usar una conexión operativa autorizada con variables solo en el proceso.
El ejecutor no carga `.env`. No asigna roles durante el registro ni se ejecuta al arrancar.
Después de las migraciones autorizadas:

```powershell
node scripts/grant-superadmin.js --user-id <ID_VERIFICADO> --identity-verified --confirm
```

En producción o un host remoto requiere además `--confirm-production` y TLS verificado.
Solicita la contraseña actual de esa cuenta en una terminal interactiva, sin eco ni logs.
El operador debe verificar previamente el control del correo: el login actual no prueba
por sí solo su titularidad. Volver a iniciar sesión para actualizar la navegación.
No se ejecutó este procedimiento ni se concedieron privilegios en producción.

## Administración avanzada (Beta 0.1)

Migraciones nuevas preparadas, **sin ejecutar**: `202610120003-add-users-status.js`
(estado `active|suspended`, cuentas existentes habilitadas por defecto) y
`202610120004-create-admin-events.js` (actor, objetivo, acción, motivo opcional y fecha).
La segunda usa FK `SET NULL`; al borrar una cuenta se limpian los motivos de sus
eventos y el evento de eliminación conserva únicamente actor, acción y fecha.
No almacena email, nombre, contraseña ni identificador del objetivo eliminado.

Todas las rutas `/api/admin` requieren JWT y rol **actual** `superadmin`, devuelven
`Cache-Control: no-store` y tienen límites de solicitudes. El rol nunca depende del
correo. Las rutas académicas y de notificaciones requieren `student`; superadmin
recibe 403. Login de cuenta suspendida recibe 403; un JWT previo de esa cuenta
recibe 401 y el frontend cierra la sesión.

- `GET /api/admin/users`: query `page` (1–100000), `limit` (1–100, predeterminado 20),
  `search` (hasta 160 caracteres: ID/nombre/email), `role`, `status`,
  `sort=id|email|createdAt|role|status`, `direction=ASC|DESC`.
  Respuesta `{ users, total, page, limit, totalPages }`; cada cuenta contiene solo
  `{ id, email, username, role, status, createdAt }`. No se inventa última actividad.
- `GET /api/admin/users/:id`: `{ user, totals: { subjects, teachers }, events,
  activity_note }`. Hasta 20 eventos administrativos recientes del objetivo,
  con actor, acción, motivo y fecha; sin contenidos académicos ni datos Push.
- `PATCH /api/admin/users/:id/status`: cuerpo
  `{ status: "active"|"suspended", confirmation: "CONFIRMAR", reason?: string }`.
  Motivo opcional, hasta 500 caracteres. Respuesta `{ id, status }` tras commit.
  Repetir el mismo estado no duplica auditoría. Cuenta propia:403, inexistente:404,
  worker ocupado:409. Comparte el lock del worker; no borra datos académicos ni
  preferencias. Mientras esté bloqueada, no se planifican ni envían nuevos avisos.
- `DELETE /api/admin/users/:id`: `{ password, confirmation: "ELIMINAR" }`.
  La contraseña es la del **superadministrador**, verificada dentro de la
  transacción con su rol/estado actual. Cuenta propia:403. Reutiliza todas las
  comprobaciones, cascadas, bloqueo y limpieza Cloudinary de la eliminación propia.
  204 solo tras commit; inexistente:404, contraseña:403, conflictos:409.
- `GET /api/admin/subjects`: `page`, `limit`, `search`, `direction` y
  `sort=frequency`. Respuesta `{ subjects, total, totalUnique, totalRegistrations,
  topSubjects, page, limit, totalPages }`. Cada grupo incluye
  `{ key, name, frequency, variant_count, variants }`, con hasta 20 variantes
  originales. Agregación SQL en lotes de 500 nombres y normalización Unicode NFD,
  tildes, espacios y minúsculas; no compara similitud ni altera registros.
  La agregación recorre todos los nombres distintos para calcular totales exactos.
- `GET /api/admin/system`: `{ api, database, application_version, notifications,
  generated_at }`. MySQL se comprueba por conexión; notificaciones informa
  habilitación del worker y conteos persistidos pending/failed/sent. No demuestra
  que QStash invoque puntualmente ni que los dispositivos lean los avisos. Sin
  conexión, `database=unavailable`, `notifications=null`. No publica configuración.
- `GET /api/admin/statistics` conserva campos existentes y agrega `accounts`
  (active/suspended), `registrations` (today/last_7_days/month_to_date/previous_month),
  `academic` (activities/tasks_without_date/tasks_with_date) y `academic_history`
  (30 filas `{ day, tasks, exams }`). Fechas UTC; mes actual parcial y mes anterior
  completo se identifican claramente. Cuentas habilitadas no equivale a visitantes
  activos. Históricos describen registros aún existentes; no registran eliminados.
- `DELETE /api/notifications`: solo estudiante autenticado; descarta una instantánea
  de todos los avisos existentes mediante `notification_dismissals`, con inserción
  idempotente. Responde 204. No borra eventos ni cancela Push; nuevos eventos o
  nuevas fechas siguen produciendo avisos. Una creación concurrente posterior a la
  instantánea se conserva. Frontend exige confirmación y actualiza lista/contador
  después de la respuesta correcta del servidor.

Antes de producción: respaldo y prueba en MySQL 8 aislado, revisión del SQL y del
historial, luego aplicación autorizada de ambas migraciones **antes** de publicar
el backend. `ALTER TABLE users` puede bloquear temporalmente; el DDL MySQL no tiene
rollback transaccional. Un fallo parcial requiere revisión, nunca repetir DDL a
ciegas. Se prepararon pruebas de SQL generado y correspondencia modelo/migración;
no sustituyen una prueba con el motor real. No ejecutar en Aiven durante desarrollo.

## Calendario y agenda (rama features/calendario-agenda)

Todas las operaciones requieren JWT y estudiante activo; no aceptan `user_id`.
Sin sesión:401; superadmin:403; eventos ajenos o inexistentes:404. Se conserva
el formato de errores y la autenticación existentes.

- `GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`: fechas civiles válidas,
  años 1000–9999, orden ascendente y diferencia máxima de 62 días (63 fechas
  inclusivas). Query opcional `custom_only=true|false`, false por defecto.
  Respuesta 200 `{ events, timezone, truncated }`. Hasta 500 eventos por origen,
  ordenados por fecha, hora e identidad. `custom_only=true` omite tareas/exámenes.
  Tareas sin fecha no se asignan a un día. La zona es la preferencia guardada,
  o America/Argentina/Cordoba si no existe.
- Cada evento contiene `{ key, id, type, title, description, date, time,
  subject?, subject_id }`. `key` es `exam:ID|task:ID|agenda:ID`; `type` es
  `exam|task|personal|academic`. `date` conserva YYYY-MM-DD, `time` puede ser null;
  no representa un timestamp UTC. Exámenes/tareas tienen `href` a su tarjeta
  original, tareas también `status`. Agenda agrega `kind`, `event_date`,
  `event_time` y `reminder_minutes`. No se exponen datos de suscripciones.
- `POST /api/calendar/events`: body
  `{ title, description?, kind, event_date, event_time, subject_id, reminder_minutes }`.
  Título string no vacío, trim y hasta 180; descripción string/null hasta 5000;
  `kind=personal|academic`; fecha válida; `event_time=null|HH:mm`;
  `subject_id=null|integer positivo` (materia propia, únicamente académico);
  `reminder_minutes=null|0|15|60|1440` (valor numérico, requiere hora explícita).
  Campos no permitidos:400. Los nullable deben enviarse como null para indicar
  día completo/sin materia/sin aviso. Respuesta 201 con los campos del evento
  e ID, sin `user_id`. No activa preferencias ni crea registros de examen/tarea.
- `PUT /api/calendar/events/:id`: reemplazo completo con el mismo body;
  respuesta 200 igual que POST. Cancela pendientes anteriores y programa solo
  avisos futuros; conserva identidades ya consumidas.
- `DELETE /api/calendar/events/:id`: respuesta 204 tras cancelar pendientes
  propios y eliminar el evento; el cliente confirma antes de llamar.
- Las mutaciones comparten lock del worker y transacción por usuario. Si el
  worker está ocupado:503 sin guardar, con mensaje para reintentar. El frontend
  conserva el formulario. Materia ajena:400.

Agenda emplea la categoría interna `agenda` de notification_reminders; no amplía
las reglas/frases de exámenes/tareas. Respeta habilitación general, silencio,
autorización, suscripciones, ledger y reintentos existentes. Día completo no
programa avisos. No se crean avisos con vencimiento ya pasado; los previamente
programados admiten tolerancia de 15 minutos, también para aviso al comenzar.
La bandeja incluye proyecciones de agenda con hora y recordatorio configurado;
una proyección no acredita envío Web Push. Descartarla no cancela el evento.

Requiere migraciones preparadas 24–27 y revisión previa a producción; ver
[Calendario y agenda](CALENDAR-AGENDA.md). No fueron ejecutadas en producción.
