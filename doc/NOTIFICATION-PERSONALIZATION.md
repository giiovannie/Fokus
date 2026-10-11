# Personalización y prueba local de notificaciones

Estado: implementado en feature/web-push-base; sin commit, despliegue ni ejecución
de las dos migraciones nuevas. No se instala ninguna dependencia.

## Persistencia mínima

- `202610110001-create-notification-phrases.js`: tabla `notification_phrases`, id,
  user_id (FK users, CASCADE), event_type ENUM exam/task, content VARCHAR(240),
  created_at/updated_at. UNIQUE notification_phrase_content(user_id,event_type,content)
  cubre consultas por dueño/tipo y duplicados. Diez frases **total**, no diez por tipo.
- `202610110002-extend-notification-styles.js`: agrega custom al final de los ENUM
  exam_style y task_style, conservando valores anteriores, NOT NULL y default formal.
- Runner admite extensión de ENUM con MODIFY COLUMN y comprueba estados previo/final
  exactos. Rechaza modificaciones parciales sin adoptar un esquema incompleto.
- Las doce migraciones anteriores y schema.js son inmutables. Total previsto:14.
- Límite y permisos se verifican en la API dentro de transacciones bloqueadas por usuario.
  No se amplían permisos de la cuenta de aplicación. No hay rollback destructivo.

El backend verifica migraciones al iniciar. Con la base local todavía en12, el
arranque se detendrá por pendientes. **Se requiere autorización antes de aplicar
las dos nuevas exclusivamente en fokus_web_push_local** usando el mecanismo versionado
y conexión administrativa local. No ejecutar en Aiven ni apuntar al remoto.

## Mensajes y prueba

Las plantillas y generación viven exclusivamente en backend/src/utils/notificationMessages.js.
Tres variantes por personalidad original y tipo; las propias se separan por tipo.
La vista previa usa POST /api/notifications/preview, autenticado y sin escrituras.
Así frontend y backend permanecen independientes para despliegue (sin imports
fuera de sus respectivas carpetas). Contrato completo: API-CONTRACT.md.

La información verificable del evento siempre la agrega Fokus. Las frases son
texto libre y pueden contener referencias propias, pero no sustituyen fecha/hora/materia.
El botón Ver otra frase evita repetir la última si hay alternativas. La selección
de prueba y su consentimiento sin filtro no modifican las preferencias guardadas.
Las fechas de ejemplo se generan en la zona guardada, usando su horario predeterminado.

## Comprobación visual después de autorizar las migraciones locales

1. Iniciar backend local y frontend con la API local; ingresar con usuario propio.
2. Abrir /notifications/preferences desde Configurar recordatorios.
3. Crear frases para Exámenes o Entregas en Mis propias frases. Cada operación confirma
   persistencia en la API antes de actualizar la lista. Guardar el estilo si se desea.
4. Ir a Probar notificación: elegir evento/persona, leer vista previa, cambiar variante.
5. Pulsar Enviar notificación de prueba y aceptar el permiso de Chrome.
6. Si está bloqueado, abrir controles junto a la dirección > Configuración del sitio >
   Notificaciones > Permitir. Revisar también Windows > Sistema > Notificaciones,
   habilitación de Chrome y No molestar.
7. Verificar visualmente el aviso en Windows. El agente no observó ni confirmó un
   aviso real en el escritorio; los tests usan navegador/worker simulados.

Permiso solicitado solo por interacción. HTTPS o localhost son necesarios.
Con worker activo se usa showNotification. En npm run dev el worker no se registra;
el constructor Notification sirve como alternativa desktop y confirma onshow/onerror.
Si no hay soporte, permiso o aviso, conservar vista previa y mostrar error claro.
En móvil se recomienda probar el build mediante npm run preview: la PWA registra
su worker en el build de producción. La disposición del aviso depende del dispositivo.
El clic en una prueba del worker abre preferencias. No se agrega sonido personalizado.

## Pendiente para Fokus cerrada

Implementar suscripciones Push por dispositivo, claves VAPID, envío remoto,
planificador fiable, silencio/zona/recálculo, deduplicación persistente y tratamiento
de suscripciones vencidas. Esta prueba local no verifica ni sustituye Web Push.

## Archivos de esta tarea

Creados:
- backend/migrations/202610110001-create-notification-phrases.js
- backend/migrations/202610110002-extend-notification-styles.js
- backend/src/models/NotificationPhrase.js
- backend/src/controllers/notificationPhrases.controller.js
- backend/src/utils/notificationMessages.js
- backend/tests/notificationPhrases.test.js
- backend/tests/notificationMessages.test.js
- frontend/src/components/common/NotificationPhrasesEditor.jsx
- frontend/src/components/common/NotificationTester.jsx
- frontend/src/components/common/NotificationPersonalization.test.jsx
- frontend/src/services/localNotifications.js
- frontend/src/services/localNotifications.test.js
- frontend/src/serviceWorkerNotifications.test.js
- doc/NOTIFICATION-PERSONALIZATION.md

Modificados (algunos ya tenían cambios locales que se conservaron):
- backend/src/models/NotificationPreference.js
- backend/src/models/index.js
- backend/src/config/notificationPreferences.js
- backend/src/controllers/notificationPreferences.controller.js
- backend/src/controllers/notification.controller.js
- backend/src/validators/notification.validator.js
- backend/src/routes/notification.routes.js
- backend/src/migrations/runner.js
- backend/tests/migrations.test.js
- backend/tests/notifications.test.js
- frontend/src/utils/notificationPreferences.js
- frontend/src/services/notifications.service.js
- frontend/src/pages/NotificationPreferencesPage.jsx
- frontend/src/pages/NotificationPreferencesPage.test.jsx
- frontend/src/context/AppContext.jsx
- frontend/src/pages/NotificationsPage.jsx
- frontend/public/sw.js
- doc/API-CONTRACT.md
- doc/WEB-PUSH-PREFERENCES.md

Los cambios anteriores en initializeDatabase, database.test, DATABASE-DEPLOY,
AppContext.test, rutas y editor de reglas se conservan. No se leen/modifican .env.


## Referencias verificadas

- Chrome, permisos del sitio: https://support.google.com/chrome/answer/3220216?hl=es
- showNotification y worker activo: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification
- Restricción del constructor en móvil: https://developer.mozilla.org/en-US/docs/Web/API/Notification/Notification
- Carpetas independientes en Render: https://render.com/docs/monorepo-support


## Evolución: Web Push manual

La etapa posterior agrega suscripciones y envío manual desde Express, sin cambiar
la personalización. La limitación de Fokus abierta aplica al botón de prueba local;
la nueva prueba desde Express usa el worker y puede recibirse sin ventanas de Fokus.
No equivale aún al sistema automático de recordatorios. Detalles y archivos de la
etapa nueva en WEB-PUSH-TRANSPORT.md; migración15 preparada y sin ejecutar.
