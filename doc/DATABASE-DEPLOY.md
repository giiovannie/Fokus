# MySQL remoto: transición segura a migraciones

Infraestructura de testing acordada: Render Static Site, Render Web Service,
Aiven MySQL y Cloudinary. La conexión TLS y las ocho migraciones iniciales ya
fueron verificadas en la base de testing. No repetir su aplicación al desplegar.

## Configuración y TLS

Configurar manualmente las variables de `backend/.env.example`. En Render usar
variables del servicio, no subir archivos `.env`. Establecer `NODE_ENV=production`,
`DB_SSL=true` y los parámetros DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT.
Usar el hostname suministrado por Aiven, no sustituirlo por una IP.
Descargar la CA del proyecto Aiven y montarla como Secret File; configurar
`DB_SSL_CA_PATH` con su ruta absoluta, por ejemplo `/etc/secrets/aiven-ca.pem`.
La CA pública no es una clave privada, pero se administra fuera del repositorio.

Se valida el PEM, que sea una CA y su vigencia. mysql2 verifica la cadena de
confianza y la identidad del hostname (`rejectUnauthorized: true`,
`verifyIdentity: true`). No hay opción para desactivar esas verificaciones ni
volver silenciosamente a una conexión sin TLS. Una CA inválida o ilegible bloquea
el arranque con el nombre DB_SSL_CA_PATH, sin mostrar contenido ni ruta.
Rotar el archivo cuando Aiven renueve la CA. La conexión TLS real fue verificada
desde desarrollo; el montaje del archivo y la conexión desde Render quedan
pendientes de validar en staging.

En desarrollo DB_SSL puede quedar en false. En todos los entornos el arranque
solo autentica la conexión y verifica el historial de migraciones mediante consultas
de lectura; nunca ejecuta sync ni migraciones ni crea o altera tablas. Si el esquema
no está preparado, el servidor informa el error y no abre el puerto HTTP.
Las migraciones se aplican por separado, mediante una operación manual autorizada.

## Esquema versionado

Ocho migraciones inmutables en `backend/migrations/`, en orden: users, profiles,
teachers, subjects, tasks, task_notes, exams y study_activities. Reproducen tipos,
nullabilidad, defaults, timestamps físicos created_at/updated_at, claves únicas
y relaciones actuales. Las claves foráneas actuales utilizan CASCADE en DELETE
y UPDATE, incluida subjects.teacher_id. No se cambia esa política.
La validación de grade entre 0 y 10 continúa siendo una validación del modelo,
como hasta ahora; no se agrega una restricción SQL distinta.

`FokusMigrations` conserva nombre, checksum SHA-256 y fecha. Los saltos CRLF se
normalizan a LF para conservar los hashes entre Windows y Linux. El checksum incluye
la definición histórica compartida `src/migrations/schema.js`: tampoco editar
ese archivo después de aplicar las migraciones. Los cambios futuros requieren
nuevas versiones y revisión del runner para operaciones distintas de crear tablas.

El runner usa Sequelize y mysql2 existentes; no se instaló otra dependencia.
Cada versión crea una tabla y luego registra su éxito. Un bloqueo MySQL GET_LOCK,
retenido en la misma conexión durante todo el lote, evita ejecuciones simultáneas
de este runner. No se promete rollback de DDL: MySQL hace commits implícitos.
No se incluyen comandos down, drop ni reset.

## Comandos del operador

Desde backend, con las variables configuradas:

```text
npm run db:migrate:status
npm run db:migrate:verify
npm run db:migrate -- --confirm
```

status y verify solo leen. verify falla si hay versiones pendientes, checksums
modificados, versiones desconocidas, tablas registradas ausentes o tablas creadas
sin registro. up requiere confirmación explícita; no conectarse ni ejecutarlo hasta
revisar destino, respaldo y autorización. No integrar up en npm start ni en cada
arranque de Render. Ejecutarlo una sola vez como paso controlado de release.
Los scripts validan también la configuración general del backend.
En producción se requiere además TRUST_PROXY_HOPS, según la guía de Render.

La instancia local MySQL 8.4.7 verificó creación y segunda ejecución sin cambios.
La base de testing Aiven MySQL 8.4.11 tiene las ocho tablas vacías y ocho versiones
registradas con checksums correctos. Para ese entorno usar status y verify;
no es necesario volver a ejecutar up. Este estado describe la última validación,
no reemplaza una consulta actual autorizada.

La primera ejecución requiere una base vacía. Una base creada previamente con
sync y sin historial se rechaza: no existe adopción automática. Antes de una
transición sobre datos existentes, comparar SHOW CREATE TABLE, índices, relaciones,
collation y motor con el esquema esperado y diseñar un baseline revisado aparte.
verify comprueba historial y presencia de tablas; no detecta todos los cambios
manuales en columnas o índices. No equivale a una auditoría completa del esquema.

Si CREATE TABLE tiene éxito pero falla el registro, o el proceso se interrumpe,
el siguiente intento detecta una tabla pendiente existente y se detiene.
Investigar el esquema y el respaldo; no borrar la tabla ni marcar la versión como
aplicada sin una comparación y autorización explícitas.

## Respaldos y restauración

Antes de cambiar un esquema existente:

1. Confirmar destino, versión MySQL y permisos; detener cambios DDL concurrentes.
2. Verificar la política de backups y retención efectiva del plan Aiven; no asumir
   que está disponible. Crear además un respaldo lógico fuera del repositorio.
3. Con cliente MySQL compatible, usar contraseña interactiva, nunca en argumentos:

```text
mysqldump --host=HOST --port=PORT --user=USER --password --ssl-mode=VERIFY_IDENTITY --ssl-ca=CA_PATH --single-transaction --no-tablespaces --set-gtid-purged=OFF --skip-add-drop-table --result-file=BACKUP_PATH DATABASE
```

Los nombres en mayúsculas son marcadores, no valores reales. Adaptar permisos,
triggers, rutinas y eventos si se incorporan al proyecto. single-transaction
requiere InnoDB y que no ocurran cambios de esquema durante el dump. Usar
result-file evita problemas de codificación/redirección en PowerShell.
Comprobar código de salida, tamaño, integridad y hash SHA-256 del archivo.
Cifrar el respaldo, limitar acceso y definir retención: contiene datos personales
y hashes de contraseñas. Nunca guardarlo en Git, logs o Engram.

4. Ensayar la restauración únicamente en una base aislada y vacía, autorizada:

```text
mysql --host=HOST --port=PORT --user=USER --password --ssl-mode=VERIFY_IDENTITY --ssl-ca=CA_PATH DATABASE_RESTORE
```

Desde ese cliente usar `SOURCE /ruta/al/respaldo.sql;`. No usar la base original.
Revisar restricciones, conteos, historial de migraciones y funcionamiento de la
aplicación sobre la copia. Restaurar sobre producción requiere un plan separado,
ventana de mantenimiento y autorización; no se incluye automatización destructiva.

## Antes de conectar Aiven

Configurar secretos y CA manualmente, comprobar red y permisos mínimos, ensayar
las migraciones en MySQL descartable y realizar respaldo/restauración de prueba.
En una base Aiven nueva confirmar que esté vacía antes de autorizar up. Luego
ejecutar status, up y verify de forma controlada antes de iniciar Render.
Separar, cuando sea posible, usuario de migraciones con permisos DDL del usuario
de ejecución con permisos de datos. La cuenta de ejecución debe poder leer
FokusMigrations y enumerar las tablas para la verificación del arranque.

Referencias oficiales:
- [Sequelize v6: migraciones](https://sequelize.org/docs/v6/other-topics/migrations/)
- [Aiven: certificados TLS](https://aiven.io/docs/platform/concepts/tls-ssl-certificates)
- [MySQL: commits implícitos](https://dev.mysql.com/doc/refman/8.0/en/implicit-commit.html)
- [MySQL: mysqldump](https://dev.mysql.com/doc/refman/8.0/en/mysqldump.html)
