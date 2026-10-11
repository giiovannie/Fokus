# Web Push: preferencias y recordatorios

Estado: reglas confirmadas e implementación local de configuración en feature/web-push-base.
Aplicación web/PWA; sin Capacitor. Contrato público: API-CONTRACT.md.
No hay transporte push, suscripciones ni planificador implementados en esta etapa.

## Arquitectura y compatibilidad

- users tiene profiles opcional y subjects propios; exams y tasks pertenecen a subjects.
- JWT identifica al estudiante por req.user.id. Nunca aceptar user_id del cliente.
- notification_preferences: una fila opcional por usuario, FK con CASCADE y UNIQUE(user_id).
- notification_rules: reglas propias, FK con CASCADE y UNIQUE(user_id, event_type, offset_minutes).
- No reutilizar profiles.preferences: no se expone actualmente y un perfil no es obligatorio.
- GET /api/notifications conserva sus avisos derivados. GET de preferencias devuelve defaults sin escribir.
- Mantener las ocho migraciones originales y schema.js intactos. Cuatro migraciones nuevas:
  dos tablas y dos columnas TIME NULL DEFAULT NULL en exams.exam_time y tasks.due_time.
- Runner ampliado para columnas aditivas; rechaza esquemas parciales y conserva los checksums.
- No se ejecutaron migraciones en una base real; no desplegar antes de revisar/aplicar las nuevas.

## Preferencias

Predeterminados: enabled, exams_enabled y tasks_enabled=false; timezone=America/Argentina/Cordoba;
exam_default_time y task_default_time=09:00, editables independientemente; estilos formal.
Estilos internos: formal, friendly, motivating, sarcastic, unfiltered.
Sin filtro exige unfiltered_enabled explícito; el servidor registra unfiltered_consented_at
UTC y lo borra al revocar. La revocación requiere seleccionar otros estilos.

Silencio: quiet_hours_enabled=false y quiet_start/quiet_end=null inicialmente.
Cuando está activo exige dos horas HH:mm distintas; permite cruzar medianoche.
revision comienza en 1 y aumenta ante cambios efectivos de preferencias o reglas.
created_at/updated_at siguen las convenciones existentes. Restricciones de coherencia,
horas y zona IANA se validan en la API; enums, FK y unicidad también en la base.
No se añadieron CHECK ni índices redundantes. Los índices únicos cubren consultas por usuario.

## Reglas

Máximo cinco por estudiante y tipo (exam/task), incluidas las desactivadas.
Anticipación entre 0 y 30 días: amount entero y unit minutes/hours/days,
persistida como offset_minutes entre 0 y 43200. Un día equivale a 1440 minutos transcurridos.
UNIQUE por usuario, tipo y anticipación evita duplicados incluso entre unidades equivalentes.
Cada regla tiene enabled; solo producirá avisos si la activación global y del tipo también lo permiten.
Las escrituras bloquean la fila del usuario dentro de una transacción para serializar el límite.
Cambiar de tipo respeta la capacidad del tipo destino. No crear reglas activas automáticamente.

## Fecha, hora y políticas temporales confirmadas

Fecha YYYY-MM-DD obligatoria; hora opcional HH:mm o null. Registros anteriores conservan
fecha y reciben NULL; omitir hora al actualizar la conserva, null vuelve al horario individual.
Hora específica prevalece sobre el horario predeterminado del tipo.
Fecha/hora local se interpreta en la zona del estudiante; cambiar zona conserva la hora local.
Resolver a UTC y restar la duración en minutos, sin usar la zona del servidor.
DST: primera hora válida posterior si no existe; primera ocurrencia si es ambigua.
Silencio [inicio, fin): aplazar al final solo si no pasó la hora efectiva del evento;
si la supera, omitir. Fusionar avisos del mismo evento desplazados al mismo instante.
Exámenes: detener al alcanzar su hora efectiva, incluido un offset cero.
Tareas completadas: cancelar pendientes. No reenviar avisos ya enviados ni vencidos.

El futuro planificador invalidará planes pendientes al cambiar fecha, hora, zona,
fallback, reglas, silencio o activación. Un cambio de fallback no afecta eventos con hora.
Releer evento y revisión antes de enviar; un cambio de estilo actualiza mensajes pendientes.
Eliminar eventos/reglas o revocar activación cancela pendientes. revision permite detectar
cambios de configuración; los eventos deben releerse también después de sus propias ediciones.
Estas políticas quedan contratadas, pero el motor temporal y cancelación persistente son otra etapa.

## Endpoints implementados

Todos autenticados mediante JWT:

| Método / ruta | Resultado |
|---|---|
| GET /api/notifications/preferences | Preferencias/defaults, sin escrituras |
| PUT /api/notifications/preferences | Reemplazo completo validado, revision y consentimiento |
| GET /api/notifications/rules | Reglas propias; filtro event_type opcional |
| POST /api/notifications/rules | Crear regla propia (201) |
| PUT /api/notifications/rules/:id | Reemplazar regla propia (200) |
| DELETE /api/notifications/rules/:id | Eliminar regla propia (204) |

400 validación; 401 JWT inválido; 404 regla ajena/inexistente; 409 duplicado o límite.
Campos desconocidos y campos administrados por el servidor se rechazan.

## Verificación y siguientes etapas

Pruebas locales de autenticación, propiedad, consentimiento/revocación, silencio,
conversión, límite cinco, duplicados, idempotencia, compatibilidad sin hora y migraciones.
Pruebas de migración usan conexiones simuladas, sin escribir en Aiven.

Siguiente: motor temporal con pruebas DST/silencio/cancelación; suscripciones por dispositivo;
cola e historial con deduplicación y reintentos; ejecución programada; interfaz de preferencias.
Revisar políticas de recuperación tras caídas al diseñar el planificador.
