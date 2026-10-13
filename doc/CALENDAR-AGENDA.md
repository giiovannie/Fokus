# Calendario y agenda

Implementación en `features/calendario-agenda`, desde `origin/develop` `58ddd09`.
No requiere dependencias nuevas ni cambios de entorno o de QStash.

## Interfaz

`/calendar` es una ruta protegida de estudiante. Tiene vistas mensual (42 días)
y semanal (lunes a domingo), navegación, Hoy, selección de días y detalles.
Los indicadores incluyen color y cantidad por categoría: examen violeta, tarea
naranja, personal azul y académico verde. Los botones se operan con teclado y
los formularios reutilizan `FormModal`, incluidos foco, Escape y confirmación
de eliminación. CSS acotado al calendario, variables de tema y diseño móvil.
No hay animaciones nuevas que necesiten excepciones para movimiento reducido.

Exámenes y tareas se leen de sus modelos originales, con enlace a la tarjeta
real. Las tareas sin fecha quedan fuera del rango. Las completadas se muestran
identificadas como tales; consultar o seleccionar un día no modifica su estado.
Los eventos personales/académicos usan CRUD persistente, nunca registros ficticios.
El Dashboard muestra hasta cuatro eventos propios próximos de agenda en los
siguientes 14 días; no repite los exámenes ni las tareas de sus tarjetas existentes.
Los eventos de hoy con hora ya pasada se excluyen de ese resumen.

## Persistencia y contrato

`AgendaEvent` / `agenda_events` pertenece a `User`; FK CASCADE. Materia opcional
solo para tipo académico, verificada contra el usuario autenticado; FK SET NULL
conserva el evento al eliminar la materia. Título hasta 180 caracteres,
descripción opcional hasta 5000, tipo `personal|academic`, `event_date` DATEONLY,
`event_time` TIME nullable y `reminder_minutes` nullable, con valores 0/15/60/1440.
Campos desconocidos, IDs ajenos y fechas/horas inválidas se rechazan.
El servidor asigna `user_id`; nunca lo acepta del body.

Endpoints añadidos, con el contrato detallado en `API-CONTRACT.md`:

- `GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`: hasta 63 fechas inclusivas.
- Query opcional `custom_only=true`: solo agenda para el Dashboard.
- `POST /api/calendar/events`, `PUT /api/calendar/events/:id` y
  `DELETE /api/calendar/events/:id`: creación, edición completa y eliminación propia.

El GET realiza cuatro consultas independientes en paralelo (agenda, tareas,
exámenes, zona guardada), con joins de materia, sin N+1. El resumen usa dos
consultas, sin releer tareas/exámenes. Límite de 500 por origen por rango;
`truncated=true` informa recorte y la interfaz sugiere vista semanal. No hay
polling, caché global de datos personales ni carga del historial de agenda.
Cambio de rango/cuenta aborta la consulta e ignora respuestas obsoletas. Las
mutaciones confirmadas invalidan la vista mediante un evento local.

## Fechas y recordatorios

Las fechas civiles no se convierten a timestamps para asignar su día. El día
actual se calcula con Intl en la zona guardada; la conversión de fecha+hora a
instante usa el resolver Temporal existente, incluidos cambios estacionales.
Un evento sin hora es de día completo y no admite recordatorio hasta que el
estudiante indique un horario. No se asigna una medianoche o una hora de aviso
implícita a un evento de día completo.

La categoría interna `agenda` reutiliza `notification_reminders`,
`notification_deliveries`, suscripciones y worker. No agrega otro proceso.
Exige preferencias generales habilitadas y suscripción válida; los interruptores
de exámenes/tareas no desactivan agenda. El interruptor general sigue pausando
todos los avisos. El ciclo existente de permisos y renovación también considera
agenda, siempre solicitando permiso mediante interacción explícita.

La creación/edición calcula únicamente avisos futuros dentro de la transacción
del usuario y bajo el lock del worker. Si este está ocupado, se devuelve 503 sin
guardar y el formulario conserva sus datos. Editar/eliminar cancela pendientes y
sus intentos pendientes; cambiar horario conserva la identidad cuando corresponde.
Una identidad ya procesada o fallida no se reabre por editar; la recuperación de
suscripciones 404/410 sigue su mecanismo específico y nunca revive endpoints
rechazados. Avisos aceptados o inciertos no se vuelven a enviar.

Los horarios de silencio posponen un aviso solo si todavía puede ocurrir antes
o al comenzar el evento; de lo contrario no se programa. No hay avisos
retroactivos al crear un evento ni al descubrirlo durante planificación.
Los avisos previamente programados conservan la tolerancia de 15 minutos. Para
agenda, el envío al comenzar admite esa tolerancia después del horario del evento,
incluida recuperación de suscripción y TTL; exámenes/tareas conservan sus reglas.
`missed_window` cancela un aviso anticipado que excedió esa ventana aunque el
evento todavía sea futuro. No se crea un intento si no existe suscripción.

Se conserva entrega prioritaria antes de planificación y reconciliación, con
presupuesto compartido de 20 segundos, límites existentes e idempotencia por
evento/anticipación y dispositivo. La bandeja agrega proyecciones de agenda con
hora y aviso configurado; verla no acredita una entrega Web Push.

## Migraciones preparadas y publicación posterior

Se mantienen sin cambios las 23 migraciones históricas y su helper de checksum.

24. `202610130001-create-agenda-events.js`: tabla y `agenda_user_date`
    (`user_id,event_date,id`).
25. `202610130002-extend-reminder-event-types.js`: enum de recordatorios agrega
    `agenda`, conserva valores existentes e índice único compuesto.
26. `202610130003-index-exam-calendar-dates.js`: `exam_subject_date`
    (`subject_id,exam_date,id`).
27. `202610130004-index-task-calendar-dates.js`: `task_subject_date`
    (`subject_id,due_date,id`).

El runner admite índices aditivos y detecta índices parciales/incompatibles
mediante SHOW INDEX; no adopta DDL parcial como exitoso. Pruebas comprueban SQL
MySQL generado, FK, tipos, defaults, historial, índices y orden de aplicación con
mocks. No equivalen a aplicar las migraciones en MySQL 8 real. No se ejecutaron
migraciones ni consultas contra Aiven en esta tarea.

Antes de publicar: revisar la rama y el SQL; probar las cuatro migraciones en
MySQL 8 aislado y medir consultas con datos representativos; obtener autorización
expresa para aplicación controlada en producción con respaldo reciente, ausencia
de escrituras y TLS verificado; verificar checksums y esquema después. Coordinar
la integración y despliegue del backend después de preparar el esquema. El
arranque comprueba migraciones y no publica un backend con pendientes. El merge
y despliegue quedan para una acción posterior autorizada.

Riesgos: ALTER de enum/índices puede esperar metadata locks, usar I/O o bloquear
escrituras; MySQL DDL no ofrece rollback de todo el lote. Ante aplicación parcial,
detener y revisar, sin repetir ciegamente ni borrar datos. Los índices aumentan
espacio y costo de escritura. El volumen de agenda comparte capacidad del worker
con exámenes/tareas; no se aumentaron límites. Muchas entregas simultáneas pueden
necesitar varios ciclos y eventualmente exceder la tolerancia. El comportamiento
Android depende del permiso, suscripción, conexión y política del dispositivo;
las pruebas con mocks no acreditan recepción real en producción.

## Archivos

Backend: modelo AgendaEvent, asociaciones, índices de Exam/Task, enum
NotificationReminder, cuatro migraciones y runner; controlador/validador/rutas
calendar; reminderTime, reminderRepository, reminderProcessor, textos compartidos,
proyección de bandeja, recuperación de Push y limpieza de cursores al borrar cuenta.
Frontend: CalendarPage y CSS, utilidades de fechas, servicio y hook de calendario,
UpcomingAgenda; rutas, Sidebar, Dashboard y adaptación del ciclo/preferencias Push.
Pruebas: CRUD/permisos/rangos, entrega simulada/deduplicación/ventanas/silencio,
SQL/historial/índices, bandeja/renovación; interfaz, formularios, navegación,
coincidencias, fechas y aislamiento. Fixtures existentes actualizados únicamente
para la nueva categoría y el nuevo bloque del Dashboard.
