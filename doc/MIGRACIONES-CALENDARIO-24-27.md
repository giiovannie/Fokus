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
