# Revisión previa al despliegue Web Push

Fecha: 11/10/2026. Rama: `feature/web-push-base`. QStash Free aprobado como propuesta cada dos minutos; activación y cambios en producción NO autorizados. Esta revisión no ejecutó migraciones, envíos ni conexiones a Aiven. No leyó `.env`.

## Verificaciones locales

- Revisión de 37 archivos pendientes del motor, pruebas, contrato y documentación: sin archivos ajenos identificados ni material privado detectado. `.env` de backend/frontend ignorados. El motor sigue sin commit ni push.
- Backend: 286 pruebas aprobadas; frontend: 109 aprobadas, lint y build correctos. Build verificado con API pública.
- Backend usa dialecto MySQL mediante mysql2; no depende de funciones específicas de MariaDB. Los destinos localhost son valores de desarrollo y controles deliberados de la CLI local, no destinos obligatorios del procesador HTTP. Producción exige configuración explícita y TLS; no se verificaron sus valores reales.
- Inicio sin sync ni migraciones automáticas: autentica y verifica el historial versionado.

## Migraciones 9–18: auditoría estática para MySQL 8

Se revisaron dependencias y SQL generado sin ejecutar sentencias. Ninguna migración ascendente elimina tablas o registros. Los CREATE usan InnoDB; las referencias unsigned coinciden con las claves de usuarios. Las reglas ON DELETE de las claves foráneas no eliminan datos al crear el esquema.

| Número | Cambio | Compatibilidad y atención |
| --- | --- | --- |
| 9 | notification_preferences | Una fila por usuario, FK y valores predeterminados; estilos ENUM y horas TIME compatibles. |
| 10 | notification_rules | FK y unicidad usuario/tipo/anticipación. Máximo cinco y 43200 minutos se validan en aplicación, no mediante CHECK SQL. |
| 11 | exams.exam_time | TIME nullable, NULL conserva registros anteriores. |
| 12 | tasks.due_time | TIME nullable, NULL conserva registros anteriores. |
| 13 | notification_phrases | FK y unicidad usuario/tipo/frase; verificar índice de texto con charset y formato reales. |
| 14 | Estilo custom | Agrega valor al final del ENUM; conserva valores anteriores. ALTER puede bloquear/reconstruir tabla. |
| 15 | push_subscriptions | FK, hash de endpoint único y unicidad usuario/dispositivo. |
| 16 | notification_reminders | FK a usuario; unicidad usuario/tipo/evento/anticipación e índice de pendientes. event_id es polimórfico, validado por propiedad del evento. |
| 17 | notification_deliveries | FK a recordatorio y suscripción; unicidad recordatorio/dispositivo; índice de reintentos. |
| 18 | notification_worker_state | Scope único y cursores persistentes. |

Esto NO sustituye una ejecución sobre MySQL 8 aislado. Falta probar versión, sql_mode, collation, utf8mb4, formato/tamaño de página InnoDB, bloqueos del ALTER y permisos del destino Aiven. Los índices de texto requieren los límites habituales de InnoDB moderno; no asumir una configuración especial compatible. No modificar migraciones antiguas ni su helper: sus checksums forman parte del historial.

## Seguridad, concurrencia y QStash

Ver [programación](WEB-PUSH-SCHEDULING.md) y [plantilla inerte](config/qstash-reminders.example.json).

- POST /api/internal/notifications/process: Bearer exclusivo, comparación en tiempo constante, JWT estudiantil no habilita acceso; cuerpo vacío y límite seis solicitudes/minuto. No usar Origin ni credenciales en URL.
- Configurar explícitamente Upstash-Timeout: 120s y Upstash-Retries: 0. Cron */2 * * * *: 720 invocaciones/día antes de otros usos. No crear schedule ahora; su creación puede activarlo inmediatamente.
- GET_LOCK en conexión dedicada, comprobación de propiedad, restricciones únicas y reclamación condicional persistida antes del envío. Verificar conexión al mismo primario MySQL: el lock pertenece a una sesión/servidor, no a un sistema distribuido.
- Entrega incierta no se reintenta automáticamente; 429/5xx admiten reintentos acotados del motor, diferentes de reintentos HTTP QStash. No hay garantía de recepción visual ni de entrega exactamente una vez.
- Presupuesto de 20 segundos cooperativo, no timeout total estricto. Verificación SQL, conexión y consultas pueden extenderlo; medir arranque frío y carga antes de activar.
- Rate limit en memoria, sin firma QStash adicional. El Bearer requiere HTTPS, custodia y redacción de Authorization en QStash.
- HTTP 200 puede contener fallos. Revisar contadores y entregas además del estado HTTP; supervisión inicial manual, sin alarma automática creada.

## Secretos de producción: procedimiento futuro

Generar un par nuevo con web-push.generateVAPIDKeys en un entorno controlado, escribiendo la clave privada directamente a un almacén seguro, sin consola, logs, Git ni Engram. Configurar manualmente VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT con contacto válido. Solo la clave pública puede exponerse mediante el endpoint previsto.

Generar NOTIFICATION_SERVICE_TOKEN independiente con 32 bytes aleatorios codificados base64url; no reutilizar JWT, VAPID ni secretos locales. Guardarlo en Render y el header reenviado del schedule, con redacción. QSTASH_TOKEN administrativo queda exclusivamente en el entorno seguro de administración, no en Render ni frontend.

Mantener NOTIFICATION_WORKER_ENABLED=false inicialmente. La validación de entorno no exige token/VAPID por el mero hecho de habilitar: verificar ambos expresamente antes de cambiarlo a true. Las suscripciones son propias del origen y clave VAPID; las locales no sirven en producción. No reemplazar claves productivas existentes sin revisar consecuencias y reinscripción.

## Plan de respaldo, migración, despliegue y prueba

1. Resolver las verificaciones pendientes y solicitar autorización independiente para commit/push y despliegue. Revisar antes si Render despliega automáticamente al publicar; no publicar suponiendo que eso es inocuo.
2. Ensayar las migraciones en MySQL 8 aislado con configuración equivalente y datos de prueba: conservar filas existentes, comprobar FK, índices, valores y contratos; probar fallos parciales y la versión de contingencia.
3. Con futura autorización, inspeccionar solo el historial real de Aiven y checksums. No asumir ocho migraciones ni ejecutar automáticamente 9–18 si hay otras aplicadas. Cualquier discrepancia exige detenerse.
4. Preparar respaldo completo del esquema, datos e historial versionado, cifrado y fuera de Git, y comprobar restauración en otra base. Revisar disponibilidad/retención real del respaldo Aiven según plan. Un dump contiene datos personales y claves de suscripciones: tratarlo como sensible. Usar conexión TLS verificada y credenciales protegidas fuera de argumentos/logs; no exportar otras bases.
5. Coordinar ventana sin escrituras ni cambios DDL y sin procesadores activos. No existe una bandera de mantenimiento implementada: definir el cierre operativo antes. Usar administrador temporal de migración; conservar usuario de aplicación con CRUD limitado.
6. Ejecutar únicamente pendientes verificadas mediante runner versionado autorizado. Cada DDL MySQL tiene commits implícitos; el conjunto y el registro posterior de historial no son una transacción única. Ante fallo parcial, detenerse e inspeccionar; no borrar tablas ni editar historial para ocultarlo.
7. Comprobar historial completo, tablas, FK/índices, recuentos/datos conservados y permisos. Desplegar versión compatible con esquema 18, worker deshabilitado y schedule inexistente. Probar health, login y regresiones; verificar Node/configuración TLS/CA del entorno real.
8. Preparar prueba remota explícitamente aislada y autorizada. El endpoint actual procesa un lote global y no acepta filtro de cuenta: antes de un piloto en producción hace falta un ejecutor restringido revisado, o un staging aislado. No usar la CLI local contra Aiven ni suponer que probar el endpoint afecta solo al estudiante de prueba.
9. Validar recepción visual con pestaña cerrada, segunda pasada sin duplicados, errores y arranque frío. Solo después autorizar procesamiento global y crear un único schedule con retries 0 y timeout 120s. Revisar ID existente, cuotas y redacción sin sobrescribir tareas.

## Reversión conservando datos

Pausar QStash y deshabilitar worker; esperar/observar el lote en curso, que puede terminar. Conservar suscripciones, eventos, entregas e historial.

No volver directamente a un backend con solo ocho o quince migraciones: su verificador rechaza las migraciones adicionales y puede impedir el inicio. Preparar y ensayar una versión de contingencia que reconozca las 18 migraciones y mantenga el motor deshabilitado; este artefacto aún no está preparado/validado. Preferir corrección hacia adelante compatible con el esquema. No ejecutar down ni borrar historial para hacer compatible una versión antigua.

Si se necesita recuperación de datos, restaurar primero a otra base aislada y verificarla. No sobrescribir la base activa con un respaldo antiguo: perdería escrituras posteriores. Cualquier cambio de destino y reconciliación requiere autorización y plan específico.

## Pendientes antes de publicar/desplegar

- Ensayo real MySQL 8, respaldo restaurable e historial/configuración Aiven comprobados con futura autorización.
- Artefacto de contingencia compatible con esquema 18 y piloto de envío restringido o staging.
- Medición de latencia/carga/arranque frío, cuotas compartidas y supervisión de contadores, no solo HTTP.
- Secretos productivos nuevos, permisos/TLS correctos y suscripciones del origen productivo.

Fuentes: [MySQL DDL atómico y commits implícitos](https://dev.mysql.com/doc/refman/8.0/en/atomic-ddl.html), [GET_LOCK](https://dev.mysql.com/doc/refman/8.0/en/locking-functions.html), [QStash schedules](https://upstash.com/docs/qstash/api-reference/schedules/create-a-schedule), [Aiven respaldo lógico](https://aiven.io/docs/products/mysql/howto/migrate-database-mysqldump), [Render Free](https://render.com/docs/free).
