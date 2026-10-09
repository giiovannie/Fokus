# Backend de testing en Render

Preparación de Express para Render Web Service. No desplegar hasta revisar y
publicar la rama autorizada; no se ejecutaron migraciones ni conexiones a Aiven
durante este bloque.

## Configuración del servicio

- Root Directory: `backend`.
- Build Command: `npm ci --omit=dev`.
- Start Command: `npm start`.
- Health Check Path: `/api/health`.
- Configurar manualmente una versión Node compatible con las dependencias y
  ensayada en CI antes del despliegue.
- NODE_ENV=production. Render proporciona PORT (predeterminado 10000); el
  servidor escucha ese puerto en 0.0.0.0.
- FRONTEND_URL: origen HTTPS exacto del Static Site, sin ruta ni comodines.
  CORS acepta únicamente ese origen; rechaza otros con 403. Solicitudes sin
  Origin, como healthchecks y clientes no navegador, siguen funcionando.
  CORS no sustituye autenticación ni limita clientes fuera de navegadores.
- Configurar DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT y JWT_SECRET mediante
  variables del Dashboard; JWT_SECRET de al menos 32 caracteres.
- DB_SSL=true. Montar CA de Aiven como Secret File `ca.pem` y establecer
  DB_SSL_CA_PATH=/etc/secrets/ca.pem. No incluir claves privadas, credenciales ni
  rutas Windows en el repositorio. La lectura es desde la variable, con
  verificación del certificado y hostname obligatoria.
- Configurar Cloudinary en el backend y CLOUDINARY_REQUIRED=true si se exige
  disponibilidad de carga de imágenes al validar el arranque.

## Proxy y límites

TRUST_PROXY_HOPS=0 en desarrollo (predeterminado). El único otro valor permitido
es 1: confía en el salto inmediato y nunca en toda la cadena. Para Render usarlo
solo con acceso al servicio exclusivamente a través del proxy de la plataforma.
Las fuentes oficiales consultadas describen el proxy, pero no garantizan una
cantidad universal de saltos X-Forwarded-For para todas las topologías.
Verificar en staging con clientes controlados que req.ip identifica al cliente
y que prefijar un X-Forwarded-For falso no cambia la identidad elegida. No registrar
tokens ni publicar un endpoint de diagnóstico. Si se identifica otro proxy
intermedio, revisar rangos confiables con Render antes de habilitar tráfico;
no resolverlo con trust proxy=true ni confiando automáticamente en el primer IP.

express-rate-limit protege:
- POST /api/auth/login: 20 solicitudes / 15 minutos / IP.
- POST /api/users: 10 solicitudes / hora / IP.
- POST /api/profiles/:id/avatar: 30 solicitudes / 15 minutos / IP, después de
  autenticar y antes de consultar el perfil o procesar el archivo.

Cuenta intentos correctos e incorrectos, responde 429 con mensaje en español,
RateLimit y Retry-After, y agrupa IPv6 con el soporte de la biblioteca.
Los contadores viven en memoria por instancia y se reinician al reiniciar el
proceso. Antes de escalar a múltiples instancias, incorporar un almacén compartido
revisado; estos límites no reemplazan protección frente a ataques distribuidos.

## Healthcheck y cierre

GET /api/health no requiere autenticación: 200 {"status":"ok"}, sin caché.
Indica disponibilidad HTTP; no consulta MySQL ni Cloudinary. El servidor solo
empieza a escuchar después de autenticar MySQL y verificar migraciones, pero este
healthcheck no detecta una caída posterior de esas dependencias. Durante cierre
responde 503 {"status":"unavailable"} en solicitudes que aún puedan llegar.

SIGTERM y SIGINT inician un único cierre: deja de aceptar conexiones, cierra las
inactivas, espera solicitudes activas y luego cierra Sequelize. Plazo máximo de
25 segundos, menor al límite predeterminado de Render de 30 segundos. Si expira,
cierra conexiones y termina con código 1; si una operación sigue activa puede
interrumpirse, por lo que deben respetarse los controles de limpieza existentes.
Sequelize también se intenta cerrar si falla el drenaje HTTP. No se ejecuta
sync() ni migraciones automáticamente en producción.

## Verificaciones pendientes de staging

Confirmar PORT, montaje de CA y TLS, origen exacto del frontend, identidad del
cliente detrás del proxy, respuestas 429 y señales de cierre durante una petición.
El healthcheck y las pruebas locales no equivalen a un despliegue validado.

Referencias oficiales:
- [Render Web Services](https://render.com/docs/web-services)
- [Render healthchecks](https://render.com/docs/health-checks)
- [Render shutdown](https://render.com/docs/deploys)
- [Render Secret Files](https://render.com/docs/configure-environment-variables)
- [Express detrás de proxies](https://expressjs.com/en/guide/behind-proxies/)
- [express-rate-limit](https://express-rate-limit.mintlify.app/reference/configuration)
