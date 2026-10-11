# Web Push manual por dispositivo

Estado: Web Push manual implementado y recepción confirmada por el usuario en Chrome
con Fokus abierta y con su pestaña cerrada. Quince migraciones aplicadas exclusivamente
en la base local. VAPID configurado solo para desarrollo; sin desplegar a producción.
El motor automático se desarrollará en una etapa independiente.

## Persistencia y protección

Migración `202610110003-create-push-subscriptions.js` (número 15): crea solamente
`push_subscriptions`. Las 14 anteriores no se modifican. Tiene ID, FK `user_id`
a usuarios con cascada, UUID `device_id`, nombre `device_label`, endpoint HTTPS,
hash SHA-256 único del endpoint, claves `p256dh`/`auth` y timestamps. Unicidad
compuesta usuario/dispositivo. El índice compuesto sirve para listar por usuario.
Hasta 10 dispositivos por estudiante; transacción y bloqueo de usuario en altas/bajas.
No altera exámenes, tareas, preferencias, reglas ni frases existentes.

Las claves de suscripción y endpoint son datos sensibles de entrega: solo backend/DB,
no se devuelven en listados ni se registran en logs. El hash global impide reasignar
un endpoint de otro estudiante. Solo proveedores HTTPS conocidos (FCM, Mozilla,
Apple y WNS), sin credenciales en URL, fragmentos ni puertos alternativos. Claves
P256 de curva válida y secreto auth de 16 bytes. No aceptar user_id del cliente.

## Configuración del backend

Dependencia nueva: `web-push` 3.6.7. Sin dependencias nuevas en frontend.

Variables documentadas en `backend/.env.example`:

- `VAPID_PUBLIC_KEY`: clave pública del par P256.
- `VAPID_PRIVATE_KEY`: clave privada, exclusivamente backend; nunca VITE_, Git, logs o Engram.
- `VAPID_SUBJECT`: contacto real `mailto:...` o URL HTTPS; preferir correo y evitar https://localhost (Safari).

Generar una única vez el par con `web-push.generateVAPIDKeys()` en un entorno privado
y guardarlo mediante el mecanismo de secretos local, fuera del repositorio. Configurarlo
manualmente en el backend. No generar otro par en cada arranque: cambiar la clave
requiere renovar suscripciones. Este trabajo no generó claves reales ni modificó `.env`.
Sin las tres variables, Push aparece no configurado y el resto de la API sigue disponible;
una configuración parcial/incorrecta se rechaza sin exponer sus valores. El frontend
obtiene solo la clave pública mediante el endpoint autenticado de configuración.

## Contrato JWT

Prefijo `/api/notifications/push`; todas las rutas requieren Bearer JWT.

| Método/ruta | Contrato |
| --- | --- |
| GET `/config` | `{ enabled, public_key }`, nunca clave privada |
| GET `/subscriptions` | Array propio `{ id, device_id, device_label, created_at, updated_at }` |
| POST `/subscriptions` | `{ device_id: UUIDv4, device_label?: string de 1–100, subscription: { endpoint, keys: { p256dh, auth }, expirationTime?: number o null } }` |
| DELETE `/subscriptions/:id` | Baja propia, 204; ajena/inexistente 404 |
| POST `/test/:id` | Prueba a suscripción propia, 202 si el proveedor la aceptó |

Alta/renovación idempotente devuelve 200 y metadata segura. Solo campos listados;
max 10 dispositivos; conflictos/límite 409, validación 400, JWT 401, ajeno 404,
VAPID pendiente o proveedor no disponible 503. El envío de prueba limita 30 solicitudes
por minuto por estudiante, 429 al superar el límite.

El cuerpo de prueba reutiliza `/notifications/preview`:
`{ event_type: "exam"|"task", style, unfiltered_consent: boolean,
selected_phrase?: string, previous_phrase?: string }`. Los cinco estilos y custom
se conservan; sin filtro requiere consentimiento explícito en esa prueba. Custom
consulta solo frases del usuario JWT y tipo. `selected_phrase` debe seguir siendo una
plantilla del estilo o una frase propia actual; permite enviar exactamente la vista previa.
No acepta título/cuerpo arbitrario. Fokus genera materia, fecha, hora y zona del ejemplo.
No cambia preferencias, no crea eventos ni registros de entrega. Es una prueba explícita,
por lo que no depende de los interruptores de recordatorios ni silencio guardados.

Payload remoto: `{ title, body, id: UUID, data: { source: "fokus", test: true } }`.
TTL 60 segundos, timeout de proveedor 10 segundos. Respuesta 202 acredita aceptación
por el proveedor, no recepción/visualización. Respuestas 404/410 eliminan solamente
esa suscripción vencida (si no fue renovada concurrentemente) y devuelven 410 para reactivarla. Otros errores no eliminan
la suscripción ni revelan mensajes/URL/claves del proveedor. No hay reintentos automáticos.

## Navegador y privacidad

En `/notifications/preferences`: activar voluntariamente y nombrar el dispositivo.
El permiso se pide solo por el botón, nunca al cargar la página. Se requiere contexto
seguro, Notification, PushManager y un worker activo; se registra `/sw.js` si falta.
La suscripción usa `userVisibleOnly: true` y la clave pública VAPID. Una baja revoca
la suscripción del navegador y elimina el registro propio. El cierre de sesión intenta
ambas bajas y cierra avisos visibles de Fokus para proteger equipos compartidos;
si no puede revocar ni borrar, no completa el logout. Antes de iniciar otra sesión
se realiza la misma limpieza para no reutilizar avisos de una cuenta anterior. Con navegador revocado y API
caída puede quedar un registro vencido que se limpiará cuando el proveedor responda410.

Service worker: `push` muestra la notificación aunque no haya ventanas abiertas;
JSON vacío/inválido usa texto seguro visible. `notificationclick` enfoca una ventana
de Fokus o abre preferencias. No abre URLs del payload ni usa sonidos personalizados.
Tag por UUID permite agrupar una eventual repetición del mismo payload; pruebas nuevas
usan UUID nuevo. No implementa deduplicación de futuros recordatorios programados.
Manifest e íconos existentes se conservan. Worker omite módulos de Vite en desarrollo.

## Prueba real local (confirmada por el usuario)

1. Obtener autorización para aplicar únicamente la migración 15 en
   `127.0.0.1:3306/fokus_web_push_local` con las 14 anteriores verificadas. El arranque
   seguro detectará esa migración pendiente y no ejecutará cambios automáticamente.
2. Configurar manualmente VAPID en el backend local, sin reutilizar secretos de producción.
3. Iniciar Express después de verificar migraciones. Preparar frontend con
   `VITE_API_URL=http://localhost:3000/api`. Para un worker de build limpio, ejecutar
   `npm run build` y `npm run preview -- --host localhost --port 5173 --strictPort`
   (detener Vite dev antes para liberar 5173). Mantener origen `http://localhost:5173`
   compatible con FRONTEND_URL local; no mezclar localhost y 127.0.0.1 en frontend.
4. En Chrome normal, iniciar sesión en `/notifications/preferences`, nombrar el
   dispositivo como “Chrome PC”, pulsar **Activar notificaciones Push** y permitir.
   En controles del sitio junto a la URL, Notificaciones → Permitir; en Windows
   permitir avisos de Chrome y desactivar No molestar. Se necesita Internet para FCM.
5. Ver vista previa y pulsar **Enviar prueba desde Express**. Es diferente del botón
   **Enviar notificación de prueba**, que sigue siendo la prueba local del navegador.
6. Para comprobar con Fokus cerrada: cerrar TODAS sus pestañas y ventana PWA en
   Chrome, sin cerrar sesión (logout desactiva ese dispositivo). Mantener Chrome
   disponible para recibir avisos, por ejemplo con una pestaña ajena abierta. Desde
   Edge u otro perfil normal, abrir Fokus local con la MISMA cuenta. Seleccionar
   “Chrome PC” en **Dispositivo para la prueba desde Express** y enviar. No hace
   falta suscribir Edge para enviar a la suscripción propia de Chrome. Repetir con
   otros estilos y comprobar el aviso y su click en Chrome.
7. Solo esa observación confirma entrega real Windows/Chrome. Tests con mocks prueban
   contratos, no sustituyen recepción real por FCM. Navegador completamente terminado,
   dispositivo apagado, permisos del sistema y mecanismos de ahorro pueden impedirla.

## Verificación automatizada y archivos

Backend: JWT, propiedad, idempotencia/límite, destinos/keys inválidos, prevención de
reasignación, VAPID opcional/par correcto, personalidades/consentimiento/frases, expiración,
fallos transitorios; estructura de migración/modelo sin BD real. Frontend: activación
por gesto, bloqueo/compatibilidad, rollback de alta fallida, logout seguro, selección
de destino propio, vista previa exacta y errores. Worker probado sin ventanas abiertas.
Lint/build de frontend y suites existentes conservadas. Sin migraciones ejecutadas aquí.

Archivos nuevos:
- backend/migrations/202610110003-create-push-subscriptions.js
- backend/src/config/webPush.js
- backend/src/controllers/push.controller.js
- backend/src/models/PushSubscription.js
- backend/src/validators/push.validator.js
- backend/tests/webPush.test.js
- frontend/src/services/pushNotifications.js y pushNotifications.test.js
- frontend/src/components/common/WebPushControls.jsx y WebPushControls.test.jsx
- doc/WEB-PUSH-TRANSPORT.md

Archivos ampliados en esta etapa:
- backend/.env.example, package.json, package-lock.json
- backend/src/config/environment.js
- backend/src/models/index.js, routes/notification.routes.js
- backend/src/controllers/notification.controller.js
- backend/src/utils/notificationMessages.js, validators/notification.validator.js
- backend/tests/migrations.test.js
- frontend/public/sw.js
- frontend/src/services/notifications.service.js
- frontend/src/context/AuthContext.jsx, pages/ProfilePage.jsx (baja Push al cerrar sesión)
- frontend/src/pages/NotificationPreferencesPage.jsx y sus pruebas
- frontend/src/components/common/NotificationTester.jsx y NotificationPersonalization.test.jsx
- frontend/src/serviceWorkerNotifications.test.js
- doc/API-CONTRACT.md, WEB-PUSH-PREFERENCES.md, NOTIFICATION-PERSONALIZATION.md

Cambios pendientes anteriores se conservan. No commits/push ni producción.
Falta el motor de fechas/zonas/silencio, cola con cancelación/deduplicación, planificador
compatible con Render y validación remota de producción en una etapa futura.

## Referencias

- https://github.com/web-push-libs/web-push/blob/master/README.md
- https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe
