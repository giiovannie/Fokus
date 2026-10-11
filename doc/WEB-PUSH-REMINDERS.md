# Motor de recordatorios Web Push

Estado: implementación en `feature/web-push-base`, con 18 migraciones aplicadas exclusivamente en la base local. Producción no activada. Web Push manual permanece disponible. El checkpoint anterior fue publicado como `cbc0799`; este motor todavía no está commiteado.

## Tiempo y contenido

La fecha DATEONLY se interpreta en la zona IANA del estudiante; se usa la hora explícita del evento o el horario individual por tipo (09:00 inicialmente). Las anticipaciones son duraciones reales en minutos, hasta 43200 (30 días), y se mantienen hasta cinco reglas por tipo. `@js-temporal/polyfill` 0.5.1 resuelve zonas horarias: primera ocurrencia en solapamientos y primer instante válido posterior en huecos, incluso cambios de media hora o de día completo.

El silencio es un intervalo local semiabierto y puede cruzar medianoche. Un aviso se aplaza a su final; se descarta si entonces el examen ya alcanzó su hora efectiva o la entrega ya la superó. Las tareas completadas no se notifican. El mensaje usa la personalidad/frase propia vigente más materia, título, fecha, hora efectiva y zona reales; `Sin filtro` conserva el consentimiento explícito. Los clics de avisos reales abren `/notifications`, los de prueba abren preferencias.

## Persistencia: migraciones 16–18 aplicadas localmente

- `202610110004-create-notification-reminders.js`: `notification_reminders`, FK usuario; identidad única `(user_id, event_type, event_id, offset_minutes)`, instantes UTC, hash de origen, frase seleccionada y estado pendiente/procesado/fallido/cancelado. Índice de estado/fecha/id.
- `202610110005-create-notification-deliveries.js`: `notification_deliveries`, FK recordatorio y FK nullable suscripción (`SET NULL` al eliminarla); identidad única `(reminder_id, device_id)`, estado pendiente/en procesamiento/enviado/fallido/cancelado, intentos y próxima ejecución. Índice de reintentos.
- `202610110006-create-notification-worker-state.js`: `notification_worker_state`, scope único y cursor persistente para rotar estudiantes, eventos, reconciliación y entregas.

`event_id` es una referencia polimórfica: no se inventa una FK a dos tablas. En cada intento se consulta el examen/tarea a través de su materia y propietario real. No se alteraron las quince migraciones anteriores ni el helper incluido en sus checksums. El runner admite índices adicionales en las nuevas tablas. No se implementó rollback destructivo nuevo.

Se recalculan pendientes por lotes desde eventos/reglas/preferencias actuales, y otra rotación cancela eventos borrados, reglas retiradas o tareas completadas. La comprobación también se repite inmediatamente antes de cada dispositivo. Reglas eliminadas y recreadas conservan la identidad del recordatorio; los ya enviados no se reenvían aunque cambie su fecha. Recordatorios aplazados al mismo instante para el mismo evento se agrupan.

## Concurrencia, recuperación y límites

Un `GET_LOCK` de MySQL/MariaDB, mantenido en una conexión dedicada por base, impide procesadores concurrentes. Se comprueba su propiedad durante el procesamiento; la entrega se reclama con una actualización condicional persistente antes de enviar. Las restricciones únicas son una segunda defensa. Dispositivos eliminados cancelan sus pendientes; la renovación no revive un envío ya realizado a la misma identidad de dispositivo.

Cada ejecución limita 20 estudiantes, 50 eventos por tipo/estudiante, 25 recordatorios reconciliados y 25 intentos de entrega; presupuesto de 20 segundos y timeout individual de hasta 10 segundos. Los cursores evitan que reintentos o estudiantes iniciales monopolicen los lotes. Para interrupciones del disparador se permite una recuperación máxima de 15 minutos desde el instante previsto, sin superar la vigencia del evento; avisos más antiguos se cancelan.

404/410 caduca la suscripción exacta fallida; 429/5xx admite hasta tres intentos, esperando un minuto y luego cinco, respetando silencio y vigencia. Otros rechazos terminan fallidos. Un timeout, pérdida de conexión o proceso interrumpido con entrega `processing` se conserva como `delivery_uncertain`, sin reintento automático. No existe transacción atómica entre el proveedor Push y MariaDB: se prioriza no reenviar una entrega incierta; no se promete entrega exactamente una vez. El tag estable del service worker complementa la deduplicación.

## Ejecución independiente de HTTP

No hay temporizadores permanentes en Express. Una ejecución procesa un lote y termina.

Prueba local, únicamente después de autorizar y aplicar las tres migraciones en `127.0.0.1:3306/fokus_web_push_local`:

```powershell
cd C:\dev\Fokus\backend
npm run notifications:process -- --confirm --local
```

El comando rechaza otro host, puerto, base, ambiente o SSL, autentica, verifica las migraciones y requiere VAPID. No migra ni hace sync. Produce solamente contadores; configura variables reales manualmente sin compartirlas. Las migraciones locales ya están aplicadas. La prueba real se hizo con un ejecutor restringido al examen3 y dispositivo ivan pc1, no con el lote global de esta CLI.

Para un disparador externo futuro:

```text
POST /api/internal/notifications/process
Authorization: Bearer <token exclusivo del servicio>
Content-Type: application/json
{}
```

No es una API del estudiante: rechaza JWT de usuario, cuerpos con parámetros o selección de destinatarios y devuelve únicamente contadores agregados o `skipped: busy`. Comparación del token en tiempo constante; límite de seis solicitudes por minuto. `.env.example` define `NOTIFICATION_WORKER_ENABLED=false` y `NOTIFICATION_SERVICE_TOKEN` vacío; el token debe tener al menos 32 caracteres sin espacios. Nunca se entrega al frontend. La habilitación remota exige aprobación y configuración futura; no se modificó ningún `.env`.

Render Free suspende el servicio HTTP tras 15 minutos de inactividad y su reactivación puede demorar alrededor de un minuto. Sus Cron Jobs son servicios separados y no pertenecen al plan gratuito. Un cron externo puede invocar este endpoint cada minuto, con timeout suficiente y sin solapar deliberadamente solicitudes; el lock tolera solapamientos/repeticiones. No se creó cron ni workflow activo. No hay garantía de puntualidad estricta en Free: si la demora excede 15 minutos se cancela el aviso. Revisar cuota, disponibilidad y volumen antes de activar un disparador.

Fuentes: [Render Free](https://render.com/docs/free), [Render Cron Jobs](https://render.com/docs/cronjobs).

## Prueba real local posterior

1. Verificar las 18 migraciones ya aplicadas localmente; mantener los permisos DDL fuera del usuario de la aplicación.
2. Verificar el arranque de Express: ya fue comprobado con las 18 migraciones locales.
3. Iniciar sesión y conservar una suscripción Push propia activa. Activar preferencias y una regla de un minuto; crear un examen/entrega futuro para hoy con hora efectiva varios minutos adelante (hora del evento o fallback individual), fuera del silencio. No usar datos simulados como persistentes.
4. Ejecutar el comando una vez para planificar; cerrar la pestaña de Fokus y volver a ejecutarlo al llegar el instante del recordatorio. Chrome debe permanecer funcionando y las notificaciones del sistema permitidas.
5. Ejecutarlo otra vez y comprobar contadores sin reenvío. En Windows se podrá configurar posteriormente el Programador de tareas para invocarlo cada minuto, con directorio de trabajo backend; no se creó ninguna tarea durante este desarrollo.

Las pruebas automatizadas usan reloj, repositorio y proveedor simulados. Además, las migraciones se verificaron en MariaDB local y el examen3 produjo un envío aceptado, con una segunda pasada sin duplicados; su aparición visual en Windows sigue sin confirmación. El examen4 solo fue simulado, sin envío real. Producción permanece sin validar ni activar.

La propuesta de ejecución externa, comparación de proveedores, plantilla y pasos futuros se detallan en [WEB-PUSH-SCHEDULING.md](WEB-PUSH-SCHEDULING.md).
