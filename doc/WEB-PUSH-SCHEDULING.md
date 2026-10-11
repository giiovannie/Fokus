# Ejecución periódica de recordatorios

Propuesta revisada el 11/10/2026. Rama `feature/web-push-base`. Estado: preparación local; ninguna tarea externa creada/activada, ningún envío ni migración ejecutados en esta etapa. La base local tiene 18 migraciones; no se comprobó ni modificó el esquema remoto.

## Alternativa recomendada

Upstash QStash Free invocando el endpoint existente cada dos minutos (`*/2 * * * *`), timeout de 120 segundos y cero reintentos HTTP adicionales. No necesita SDK, proceso permanente ni computadora encendida. Es un disparador; los cálculos, permisos, deduplicación y reintentos Web Push siguen en Fokus.

| Alternativa | Ventajas | Límites relevantes | Decisión |
| --- | --- | --- | --- |
| QStash Free | HTTP POST, headers reenviados, timeout configurable, cron y logs/DLQ | 1000 solicitudes/día, 10 schedules, logs/DLQ 3 días, sin SLA gratuito | Recomendado para Beta |
| GitHub Actions | Configuración versionada, secretos de Actions, historial | Mínimo 5 minutos; puede retrasar/descartar ejecuciones; solo rama predeterminada; repos públicos sin actividad desactivan schedule tras 60 días; cuota según visibilidad/plan | No usar para la ventana de 15 minutos |
| cron-job.org | Gratuito, intervalo hasta 1 minuto, POST/headers, avisos de fallo/recuperación | Timeout gratuito 30 segundos; suspensión automática tras más de 25 fallos; su FAQ declara que no verifica certificados TLS | No recomendado para nuestro arranque en frío y Bearer de servicio |
| Render Cron Jobs | Programador integrado y proceso separado | No forma parte de los tipos Free | Alternativa futura paga |

Fuentes oficiales: [QStash precios](https://upstash.com/pricing/qstash), [creación de schedules](https://upstash.com/docs/qstash/api-reference/schedules/create-a-schedule), [GitHub schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [cron-job.org FAQ](https://cron-job.org/en/faq/), [Render Free](https://render.com/docs/free).

## Frecuencia, arranque en frío y cuota

Un único schedule de dos minutos produce 720 invocaciones/día; frente al límite gratuito de 1000 deja 280 para otros usos/pruebas. Una frecuencia de un minuto produciría 1440 y excedería el plan. Se configura explícitamente `Upstash-Retries: 0` porque QStash usa tres por defecto y cada intento cuenta contra la cuota. No se añaden callbacks, grupos de URLs ni un segundo job de despertar: también sumarían solicitudes. Otros usos de la misma cuenta deben contabilizarse antes de activar.

La siguiente ejecución periódica recupera un fallo HTTP; esto es diferente de los reintentos de entrega que ya controla el motor. El cron no ejecuta una entrega directa ni obliga a reenviar una entrega fallida/incierta.

Render suspende el servicio tras 15 minutos sin tráfico y despierta aproximadamente en un minuto. Un timeout de 120 segundos deja margen para despertar y el presupuesto de procesamiento de 20 segundos, pero no constituye garantía. Con el servicio caliente, demora nominal hasta dos minutos; con arranque en frío, alrededor de tres, sin contar problemas externos. La ventana de recuperación es 15 minutos; el evento debe seguir vigente. Si la demora alcanza la hora efectiva del evento, el aviso se cancela aunque siga dentro de esos 15 minutos. Los recordatorios muy próximos al evento (p. ej. un minuto antes) no tienen puntualidad garantizada con este intervalo; el recordatorio de examen con anticipación cero se descarta por la regla funcional vigente.

Render Free ofrece 750 horas/mes por workspace. Tráfico periódico puede mantener el backend activo todo el mes: un único servicio consume hasta 744 horas en un mes de 31 días; otros servicios del workspace pueden agotar la cuota. También hay límites de tráfico/pipeline. Revisar el uso agregado antes de activar. No se añade tráfico de mantenimiento separado.

## Endpoint inspeccionado

`POST /api/internal/notifications/process`, cuerpo `{}`, `Content-Type: application/json`. No enviar header Origin: no es una petición de navegador y no necesita ampliar CORS.

- Bearer exclusivo `NOTIFICATION_SERVICE_TOKEN`, al menos 32 caracteres sin espacios; comparación hash en tiempo constante, distinto de JWT y VAPID. Un JWT estudiantil no concede permisos, aunque técnicamente todo poseedor del Bearer de servicio puede disparar el lote global.
- `NOTIFICATION_WORKER_ENABLED=false` por defecto; solo `true` habilita. El token no permite seleccionar destinatarios ni cambiar límites.
- Rate limit: seis solicitudes/minuto, después de autenticar. Contador en memoria por proceso, se reinicia con Express; no es una defensa distribuida. El control principal es el token, y el lock persistente evita procesadores concurrentes.
- Requiere VAPID válido y todas las migraciones verificadas, sin ejecutar ninguna. El token autentica un endpoint público: la palabra internal no implica red privada.
- Lote: 20 estudiantes, 50 eventos por tipo/estudiante, 25 reconciliaciones, 25 intentos; presupuesto 20 segundos. Ese presupuesto es cooperativo: queries/verificación de esquema y operaciones en curso pueden extender el tiempo total HTTP.

| HTTP | Significado | Acción de supervisión |
| --- | --- | --- |
| 200 + contadores | Lote terminado | Inspeccionar también `failed`, `retried`, `cancelled`; HTTP exitoso no prueba recepción en Windows |
| 200 + `skipped: busy` | Otro procesador tiene el lock | Aceptable ocasionalmente; si se repite investigar duración/lock |
| 400 | Body no admitido | Corregir configuración, no reintentar en bucle |
| 401 | Secreto faltante/incorrecto | Pausar schedule y revisar/rotar token |
| 403 | Origin rechazado por CORS, si se agregó | Quitar Origin en el disparador |
| 404 | Endpoint aún no desplegado/ruta equivocada | Pausar y revisar versión/URL |
| 429 | Rate limit | Revisar schedules duplicados o tráfico ajeno |
| 503 / timeout | Deshabilitado, configuración/migraciones, base o ejecución fallida | Revisar antes de activar; una vez operativo, siguiente tick puede recuperar fallo transitorio |

Render/proxy también puede devolver respuestas de arranque o errores externos; no interpretar toda respuesta de infraestructura como un lote procesado. El servicio siempre se debe verificar habilitado y migrado antes de crear el schedule.

## Concurrencia y deduplicación

`GET_LOCK` por base en conexión dedicada excluye ejecuciones simultáneas de CLI/HTTP; se comprueba propiedad del lock. La entrega se reclama con actualización condicional y se persiste `processing` antes de llamar al proveedor. Índices únicos cubren `(usuario,tipo,evento,anticipación)` y `(recordatorio,dispositivo)`. Un timeout del disparador puede dejar un lote todavía ejecutándose: el siguiente intento toma el mismo lock o recibe busy.

Las pruebas existentes cubren concurrencia, pérdida/liberación de lock, segundo procesamiento sin envío, dispositivos múltiples y reintentos. La prueba local real de examen3 también produjo un solo envío y cero en la segunda pasada. Un proceso interrumpido con entrega incierta no se reintenta automáticamente: puede perderse un aviso, priorizando evitar duplicados. No se promete entrega exactamente una vez ni confirmación visual; `sent` indica aceptación del proveedor.

## Secretos y plantilla

`doc/config/qstash-reminders.example.json` contiene únicamente placeholders y parámetros. No hay workflow de GitHub ni script de creación: no puede activar tareas por un push accidental. La plantilla no se importa directamente; sus campos corresponden a los headers de creación documentados por QStash.

- `NOTIFICATION_SERVICE_TOKEN`: secreto de producción nuevo y aleatorio (p. ej. 32 bytes codificados base64url). Configurar manualmente el mismo valor en Render y en el header reenviado del schedule. No usar el secreto local ni JWT ni una clave VAPID. No colocar en URL, frontend, Git, Engram o capturas.
- `QSTASH_TOKEN`: token administrativo de la cuenta Upstash, usado solo desde su consola o cliente de configuración seguro. No guardarlo en Render ni reenviarlo al backend. Para configurar desde la consola no se necesita añadir ninguna variable al proyecto.
- Claves VAPID de producción separadas de desarrollo, exclusivamente backend; no reenviar a QStash. La habilitación requiere revisar suscripciones reales de producción y esquema autorizado.
- `Upstash-Forward-Authorization` reenvía el Bearer de servicio. `Upstash-Redact-Fields: header[Authorization]` oculta su valor en dashboard/API; no elimina la necesidad de confiar el secreto al proveedor. Revisar que la redacción quede aplicada antes de compartir logs. No adjuntar secretos como labels.

El endpoint existente valida el Bearer; no incorpora todavía validación de firma QStash. No se introducen claves de firma/SDK porque la autenticación actual basta para esta propuesta; queda como defensa adicional futura, con pruebas y cambios autorizados. Rotación: pausar schedule, sustituir token en backend y disparador, verificar redacción y reanudar. Para detener envío de producción: pausar y deshabilitar worker; una llamada ya en curso puede terminar. No borrar entregas ni suscripciones para detenerlo.

## Activación futura, con autorización independiente

1. Revisar y publicar el motor bajo el flujo Git del proyecto. No integrar ni desplegar ahora.
2. Auditar historial de migraciones remoto y respaldos, y obtener autorización para aplicar únicamente las pendientes reales; las 18 aplicadas localmente no prueban el estado de Aiven. No activar el motor sobre esquema incompleto.
3. Configurar manualmente VAPID de producción, token de servicio y variables del worker en Render; desplegar versión compatible y verificar health, migraciones, permisos de DB y endpoint. Mantener worker deshabilitado hasta autorizar prueba/remoto. No usar la CLI local contra Aiven: rechaza otro destino.
4. Elegir QStash Free y revisar cuotas compartidas. Completar parámetros en consola de forma segura. La creación por API puede activar inmediatamente el schedule: no ejecutar un comando de creación para "solo preparar". Crear/habilitar únicamente cuando el backend esté listo y se autorice el procesamiento global de estudiantes.
5. Configurar POST, destino exacto, `{}`, cron de dos minutos, timeout120s, retries0, label, Bearer reenviado y redacción. Mantener un solo schedule y revisar IDs existentes antes de crear para no sobrescribir otros; el Schedule-Id de QStash actualiza si ya existe.
6. Realizar prueba remota separadamente autorizada y observar ejecución, respuesta y recepción del dispositivo. Comprobar segunda pasada sin duplicados y arranque en frío sin ampliar las ventanas.
7. Activar periodicidad y supervisar. No habilitar replay masivo de DLQ: verificar vigencia y que no cambie destinatarios antes de cualquier reejecución.

## Supervisión inicial y límites restantes

Revisar QStash Logs/DLQ y uso diariamente (retención Free tres días). Registrar última respuesta exitosa, duración y errores HTTP; investigar ausencia de ejecución satisfactoria durante diez minutos, antes de vencer ventanas de quince. Esta revisión inicial es manual: no se creó alarma automática, webhook, correo ni otro schedule.

Además, revisar los registros `notification_deliveries`: fallos/entregas inciertas y suscripciones caducadas. HTTP200 puede incluir `failed > 0` y un servicio de estado HTTP no lo detecta; la supervisión automática de esos contadores necesita un monitor que interprete el resultado o métricas posteriores. Tampoco hay heartbeat persistente dedicado de todos los lotes vacíos. No confundir éxito HTTP o `sent` con visualización confirmada.

Quedan sin validar en producción: permisos GET_LOCK y CRUD contra el esquema remoto, duración real del lote con carga, arranque frío, versión de service worker y recepción visual; no hay SLA gratuito. Si el volumen supera los lotes y aparecen atrasos, ajustar tras medir o migrar a un worker/hosting pago. El plan preparado no cambia el presupuesto ni los reintentos del motor.
