# Aplicación posterior de migraciones 24–27

Procedimiento preparado, NO ejecutado en producción. No se modificó Aiven,
QStash, Render ni sus credenciales. Falta validación con MySQL8.4 real aislado:
no se encontraron MySQL ni Docker locales. Pruebas actuales usan SQL generado
por Sequelize y dobles de conexión para historial, defaults, FK e índices.

## Revisión de compatibilidad

24: `agenda_events` InnoDB, IDs unsigned compatibles con users/subjects,
DATEONLY→DATE, TIME nullable, TEXT opcional y ENUM personal/academic. FK de
usuario CASCADE; materia opcional SET NULL, no borra agenda al borrar la materia.
Índice (`user_id,event_date,id`). No duplica datos de tasks/exams.

25: MODIFY del enum event_type de notification_reminders: agrega agenda al final
de exam/task sin cambiar sus posiciones y sin agregar UNIQUE a una sola columna.
No modifica la identidad única compuesta ni registros existentes. Cambiar de 2 a
3 valores no incrementa tamaño del almacenamiento del enum. Según
[MySQL8.4 Online DDL](https://dev.mysql.com/doc/refman/8.4/en/innodb-online-ddl-operations.html),
agregar al final con el mismo tamaño admite operaciones instantáneas/in-place;
el runner no fuerza un algoritmo y NO garantiza ausencia de bloqueos.

26–27: índices secundarios no únicos en exams(subject_id,exam_date,id) y
tasks(subject_id,due_date,id); mantienen tareas sin fecha. InnoDB soporta agregar
índices secundarios online, pero necesita espacio/I/O y metadata locks. No se
deben asumir tiempos de Aiven sin una medición representativa.

[Atomic DDL MySQL8.4](https://dev.mysql.com/doc/refman/8.4/en/atomic-ddl.html)
protege cada sentencia soportada, no una transacción de las cuatro migraciones
ni la pareja DDL/INSERT en FokusMigrations. Puede quedar DDL aplicado sin su
registro o solo parte del lote. El runner detecta ese estado y se detiene;
nunca adoptar/repetir a ciegas ni modificar checksums.

## Condiciones obligatorias antes de ejecutar

1. Autorización expresa del equipo para aplicar únicamente24–27 y confirmación
   de respaldo reciente, verificable y con restauración conocida.
2. Confirmar ausencia de escritores: estudiantes, procesos/API y worker
   automático. El lock de migraciones no pausa QStash ni reemplaza una ventana
   de mantenimiento. Cualquier pausa/configuración de producción necesita su
   propia autorización posterior; no se realizó aquí.
3. Conexión segura existente: DB_SSL=true, CA válida y verificación de identidad
   habilitada (`rejectUnauthorized:true`, `verifyIdentity:true` en databaseOptions).
   Reutilizar la CA de Aiven; nunca desactivar verificación ni imprimir variables.
   Ver [certificados Aiven](https://aiven.io/docs/platform/concepts/tls-ssl-certificates).
4. Revisar versión/collation, espacio libre, transacciones largas y bloqueos con
   una conexión de lectura. Validar antes en MySQL8.4 aislado y sin datos reales.

## Secuencia del operador autorizado

Desde backend y con la configuración segura existente (sin compartir secretos),
el script actual se usa MANUALMENTE solo después de cumplir las condiciones.
Estos comandos NO se ejecutaron durante esta tarea.

```powershell
node scripts/migrate.js status
```

Status solo SELECT/SHOW y compara todos los checksums históricos contra el código.
Exigir exactamente23 aplicadas y los cuatro nombres siguientes pendientes:

```text
202610130001-create-agenda-events.js
202610130002-extend-reminder-event-types.js
202610130003-index-exam-calendar-dates.js
202610130004-index-task-calendar-dates.js
```

Ante checksum divergente, objetos parciales, otra cantidad/pendientes o actividad
de escritores, DETENER. No ejecutar el comando siguiente. El script generic up
aplica todas las pendientes: debe usarse con este código revisado y ninguna otra
migración agregada entre comprobación y ejecución.

Solo con confirmación expresa de respaldo reciente y ausencia de escrituras:

```powershell
node scripts/migrate.js up --confirm
node scripts/migrate.js status
node scripts/migrate.js verify
```

`up` toma bloqueo exclusivo de migraciones y registra cada checksum después de
su DDL. Exigir27 aplicadas, cero pendientes y verify exitoso. Revisar en lectura
SHOW CREATE TABLE agenda_events, SHOW COLUMNS notification_reminders y SHOW INDEX
en exams/tasks para FK/tipos/índices; conservar evidencia sin datos personales.
Si algo falla, no continuar con los comandos de publicación ni reintentar DDL
sin análisis del estado parcial. No ejecutar down ni borrar tablas/filas.

Después, y con nueva aprobación, integrar la rama en develop y coordinar despliegue
normal. Este código usa agenda_events también en bandeja: no puede publicarse el
backend antes del esquema. Tras publicar, una prueba Android/Push real requiere
autorización específica; las pruebas con mocks no confirman entrega al celular.

## Respaldo recuperable: evidencia y ensayo previos

La existencia de un plan de respaldo no demuestra la recuperabilidad del servicio
actual. La verificación quedó pendiente: esta sesión no tiene credenciales de
Aiven ni evidencia del panel Backups, y no se leyó `.env`. Tampoco se confirmó el
estado actual aplicado/pendiente mediante una conexión real. No considerar esta
preparación como autorización para ejecutar.

La documentación de [respaldos MySQL de Aiven](https://aiven.io/docs/products/mysql/concepts/mysql-backups)
describe respaldo completo y binlogs para PITR, con retención según plan. También
advierte que el respaldo puede bloquear DDL y que sus ALTER INSTANT pueden usar
INPLACE/COPY. No forzar INSTANT ni prometer ausencia de bloqueos por el soporte
genérico de MySQL. Esperar a que finalice cualquier respaldo activo antes del DDL.

Antes de aplicar, el operador debe registrar sin credenciales:

1. En Console → servicio → Backups → Backup management: identificar el servicio,
   estado completado del último respaldo, fecha UTC, retención y ventana PITR
   realmente disponibles en su plan. Si no existe respaldo utilizable, detener.
2. Tras detener todos los escritores con autorización, registrar `T0` en UTC.
   Verificar que los binlogs recuperables cubran T0 antes de iniciar DDL; o disponer
   de un respaldo completo tomado sin escrituras que represente ese mismo estado.
3. Preparar restauración usando el respaldo elegido, su T0 y un destino separado,
   restringido, sin aplicaciones, QStash ni trabajadores conectados. El flujo de
   [Fork & restore](https://aiven.io/docs/products/mysql/howto/fork-service) crea
   otro servicio y copia bases/usuarios: requiere autorización propia, control de
   acceso y costos. No se crea ni restaura ningún servicio en esta tarea.
4. Ensayar allí la recuperación, comprobar que termina correctamente, conexión
   TLS, historial/checksums y estructura, y comparar conteos o integridad en un
   informe sin datos personales. Registrar respaldo elegido, tiempo recuperado,
   resultado y duración de restauración. No reutilizar esa copia con datos reales
   para la prueba de migraciones: MySQL8.4 aislado debe contener solo datos ficticios.
5. Conservar ruta de recuperación ensayada y decisión operativa de retorno. Ante
   DDL parcial detener primero; restaurar y redirigir servicios exige otra decisión
   autorizada. Un backup no convierte el lote de DDL en una transacción reversible.

No se creó un respaldo, no se verificó su fecha/retención y no se ensayó una
restauración durante esta revisión. Es un requisito pendiente, no un riesgo aceptado.

## Comprobación de lectura preparada

Se preparó fuera del repositorio, reutilizando el ingreso seguro anterior:

```powershell
& 'C:\Users\ivane\AppData\Local\Temp\fokus-calendar-migrations-24-27\inspect.ps1'
```

Solicita host, puerto, usuario y ruta de CA existentes; contraseña oculta enviada
por stdin, sin guardarla ni imprimirla. No lee `.env`. El módulo exige destino
defaultdb, versión8.4, certificado CA vigente, identidad verificada y cifrado TLS.
Solo permite SELECT/SHOW, sin locks de escritura, DDL, consultas de datos personales
ni reintentos automáticos. Compara todos los checksums actuales y detecta objetos
parciales usando el runner del proyecto. Emite estados24–27 y metadatos de tipos,
defaults, índices, FK y motores. Esta consulta NO fue ejecutada contra producción
por falta de acceso en la sesión; el operador debe aportar su salida JSON segura.
La sintaxis y el guard de lectura se comprobaron offline, sin conexión.

## Consultas posteriores de verificación (solo lectura)

Además de `status` y `verify`, comprobar con la misma conexión segura:

```sql
SELECT COUNT(*) AS applied FROM FokusMigrations;
SELECT name, checksum FROM FokusMigrations ORDER BY name;
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (TABLE_NAME = 'agenda_events'
    OR (TABLE_NAME = 'notification_reminders' AND COLUMN_NAME = 'event_type'))
ORDER BY TABLE_NAME, ORDINAL_POSITION;
SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, SUB_PART, INDEX_TYPE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND (TABLE_NAME = 'agenda_events'
    OR (TABLE_NAME = 'exams' AND INDEX_NAME = 'exam_subject_date')
    OR (TABLE_NAME = 'tasks' AND INDEX_NAME = 'task_subject_date')
    OR (TABLE_NAME = 'notification_reminders' AND NON_UNIQUE = 0))
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;
SELECT TABLE_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, UPDATE_RULE, DELETE_RULE
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'agenda_events';
```

Exigir27 hashes correctos; agenda_user_date y ambos índices secundarios con orden
exacto y sin unicidad/prefijo; la identidad única original de recordatorios
conservada; enum exam/task/agenda, FK hacia users CASCADE y subjects SET NULL,
ambas ON UPDATE CASCADE. Verificar también las columnas relacionadas de las FK
con SHOW CREATE TABLE agenda_events, sin asumir que basta ver el nombre de tabla.

## Cierre de preparación: diagnóstico confirmado por el equipo

Datos confirmados posteriormente por el usuario: Aiven MySQL8.4.11, TLS y CA
verificados, migraciones1–23 y checksums correctos;24–27 pendientes. Respaldos
completos de10,11 y12 de octubre, sin ensayo de restauración confirmado. No se
repitió ese diagnóstico. Los párrafos anteriores describen la revisión previa.

Sigue faltando acreditar recuperación a T0 inmediatamente anterior al DDL:
detener escritores autorizadamente, fijar T0 UTC y confirmar que la ventana PITR
del servicio cubre ese estado. Ensayar recuperación en destino separado requiere
autorización adicional y posible costo; no se realizó. Alternativa si no hay PITR:
respaldo completo recuperable de ese estado, con escritores detenidos. Un respaldo
completo del día12 no prueba cobertura de las escrituras posteriores. La pausa
debe incluir usuarios/API; el ejecutor retiene el lock existente del worker durante
DDL y verificaciones, sin modificar QStash ni variables. Una pausa larga puede
afectar recordatorios por su tolerancia15min; medir y limitar ventana de mantenimiento.

MySQL/mysqldump/Docker/Podman aislados no están disponibles; no se instaló nada ni
se utilizaron datos personales para pruebas. Validación real8.4 sigue pendiente,
independiente del ensayo de recuperación de datos. No se afirma que esté realizada.

### Ejecutor controlado preparado (no ejecutado contra Aiven)

Archivos existentes y revisados en esta máquina:
`C:\Users\ivane\AppData\Local\Temp\fokus-calendar-migrations-24-27\apply.ps1`,
`apply.mjs` y `execution-manifest.json`. Son temporales, no recursos del despliegue;
conservarlos para la ejecución y volver a prepararlos si se elimina TEMP.

El módulo reutiliza migrate/migrationStatus y TLS del proyecto; no lee `.env`.
El manifiesto fija27checksums, runner/schema/TLS y propio ejecutor. Rechaza código
distinto, orden distinto o escrituras fuera de cuatro DDL y cuatro INSERT de
historial. Exige autorización final, recuperaciónT0 y ausencia de escrituras antes
de solicitar credenciales ocultas. Version/destino fijados8.4.11/defaultdb.

Bajo locks de migraciones y worker revalida el estado23+4 como comprobación necesaria
en el límite de escritura, no como diagnóstico repetido ahora. No espera un worker
ocupado: se detiene. lock_wait_timeout10s se aplica solo a su sesión. Verifica tipos,
defaults, FK/motor/índice de agenda e índices secundarios después de cada DDL y
antes de registrar éxito. Después de cada registro verifica historial, índice único
original de recordatorios y conteos/huellas SHA256 de todos los registros originales
en lotes500 ordenados por ID. Datos/huellas permanecen en memoria, sin imprimirlos
ni guardarlos; no se realiza una copia del respaldo. Cualquier discrepancia/error
detiene antes del siguiente paso, sin rollback ficticio ni reintento automático.

Validado offline: sintaxisNode/PowerShell, definición de tipos/SQL, orden exacto,
whitelist de ocho escrituras y bloqueo por confirmaciones ausentes sin conexión.
No sustituye una ejecución en MySQL real ni confirma recuperaciónPITR. No se ejecutó
ningún DDL, INSERT, lock ni consulta a producción durante esta preparación.

Solo después de resolver los requisitos y obtener autorización explícita:

```powershell
& 'C:\Users\ivane\AppData\Local\Temp\fokus-calendar-migrations-24-27\apply.ps1' -Execute -FinalAuthorization -RecoveryToT0Confirmed -WritesPaused
```

Este es el comando controlado preferido para exigir verificación individual,
en lugar del up genérico. Éxito esperado: pasos24/25/26/27 verificados,27aplicadas,
cero pendientes y conservación de datos. Usar además las consultas SELECT de arriba
y guardar solo informe seguro. Fallo/DDL parcial: detener publicación y analizar.

### Integración y Render posteriores, preparados pero NO realizados

Con migraciones completas/verificadas y nueva autorización de publicación:

```powershell
git fetch origin
git status --short
git switch develop
git pull --ff-only origin develop
git merge --no-ff --no-commit features/fix-ruleta-solo-materias
```

Resolver conflictos si existen conservando calendario/ruleta/búhos y tutorial
retirado. Revalidar backend/frontend/lint/build de la integración antes de crear
el commit de merge y hacer push origin/develop. Esos comandos de escritura Git no
se ejecutaron aquí. Confirmar que el commit final contiene f098ced/e5b3ba0/96b0ad2.

Verificar en Render que frontend y backend despliegan automáticamente ese mismo
commit y llegan a Live, sin despliegues manuales ni configuración nueva. Revisar
logs seguros de arranque y GET /api/health200; el health solo acredita proceso
disponible, no entrega Push ni funcionamiento completo de la base. Comprobar GET
autenticado /api/calendar por rango, ruta frontend/calendar, ruleta solo materias,
recursos gráficos/manifiesto y ausencia del tutorial. No crear exámenes, modificar
registros ni enviar Push de prueba sin autorización adicional. No declarar publicado
si falta confirmar uno de los servicios o el hash Live del backend/frontend.
