# Integración de calendario, retirada temporal del tutorial y mascota

Rama `features/integracion-calendario-sin-tutorial`, desde `origin/develop`
`58ddd09`, integra el calendario `f098ced`. No se publica en develop ni Render.

## Tutorial conservado

Se retiraron del frontend el montaje del recorrido, sus overlays, estilos,
servicio, utilidades y entrada «Ver tutorial». También se retiraron las rutas
anidadas de creación de materia/profesor desde examen/tarea. Los formularios
normales y sus validaciones persisten: profesores se agregan desde Materias y
las tareas/exámenes seleccionan una materia ya registrada. Formularios conservan
su borrador si falla la API. No se borran datos ni preferencias del estudiante.

El desarrollo original sigue intacto en `features/onboarding-guiado`, commit
`28d64f3`, local y remoto, y en la historia de Git. Al actualizar referencias no
se encontraron ramas adicionales de corrección del tutorial. Backend conserva
el progreso en `Profile.preferences.onboarding` y sus endpoints; la interfaz
retirada no los consulta ni modifica automáticamente. Restaurar el tutorial en
otra versión requiere revisión específica, sin revertir calendario ni Push.

## Calendario

El merge conserva vistas mensual/semanal, coincidencias, CRUD propio, fechas
civiles, materias y enlaces a tareas/exámenes existentes, resumen de agenda en
Dashboard y worker compartido con permisos, silencio, tolerancia y deduplicación.
Ver `CALENDAR-AGENDA.md` para contrato, arquitectura y limitaciones de capacidad.

## Ilustraciones

Se encontraron los cuatro JPG adjuntos en Downloads, no estaban en el proyecto.
Todos se incorporaron a `frontend/public/mascotas/originales/`, sin sobrescribirlos;
no falta ninguna ilustración. Los recursos anteriores de `public/icons/` siguen
presentes, incluidos los usados por notificaciones remotas.

| Variante | Contexto real |
| --- | --- |
| Graduado | Felicitación después de que actualizar una tarea a completed responde correctamente; nunca por guardar fallido ni girar la ruleta |
| Lentes y alas abiertas | Estado vacío de Materias y orientación para comenzar |
| Saludando | Bienvenida del Dashboard y resultado final de la Ruleta |
| Mirada fija | Brand, login mediante AuthLayout, carga inicial/React, favicon y nuevos iconos PWA |

`OwlMark` selecciona variantes y comparte tamaños responsivos, proporciones,
decodificación y marcado decorativo; texto asociado sigue siendo accesible.
El búho de éxito puede cerrarse y no aparece por tareas completadas históricas.
No hay mascotitas flotantes ni imágenes repetidas en todos los estados vacíos.

Se usó la herramienta incorporada image_gen para editar únicamente los fondos
exteriores blancos/grises y sombra de piso de los cuatro originales, con la
instrucción de conservar pose, accesorios, colores, símbolos y estilo. Los
resultados transparentes se revisaron visualmente como variantes de los originales;
los JPG fuente intactos permiten revisión. El objetivo fue quitar el fondo, no
crear una mascota genérica. PNG revisados y versiones WebP se guardan en
`frontend/public/mascotas/`. No se afirma equivalencia pixel por pixel entre una
edición generativa y el JPG fuente.

`frontend/scripts/prepare-mascot-assets.mjs` optimiza con sharp ya instalado en
backend, sin nuevas dependencias ni generación durante build. Crea WebP de
160/320px (5–24 KB) con transparencia y PNG PWA192/512, con fondo verde y margen
del 30% para máscara. El manifiesto usa archivos nuevos v2; los originales siguen
disponibles. Service Worker shell v5 precarga la marca y los iconos nuevos; la
lógica de recepción/click de Push no se cambió. CSS usa contain, tema existente
y movimiento reducido. Cambios de ilustración no representan entrega Push.

## Validación y publicación

Pruebas locales con mocks comprueban calendario, permisos, CRUD, recordatorios,
ausencia del tutorial, formularios normales y felicitaciones solo tras guardar.
Se comprueba que WebP/PNG decodifican, tienen tamaños declarados, alpha en las
ilustraciones y fondo correcto al componer sobre blanco/oscuro; no hay pérdida
de relación de aspecto al crear lienzos cuadrados. Esto no acredita prueba en
un Android real ni posición visual de cada pantalla en un navegador real.

Las migraciones24–27 no se ejecutaron. No hay cliente MySQL ni Docker disponibles
para una base aislada. Se validan SQL generado y correspondencia ORM/migración;
revisión documental MySQL8.4 y procedimiento en `MIGRACIONES-CALENDARIO-24-27.md`.

El preview local del build respondió HTTP200 para `/calendar`, manifiesto, ocho
WebP y dos PNG PWA, con los Content-Type esperados. El preview se cerró después
de la comprobación; no se conectó con producción.

Resultado final:442 pruebas backend y276 frontend aprobadas, lint y build
correctos. Al retomar la interrupción se completó la validación frontend pendiente;
backend no cambió respecto de f098ced y conserva su validación anterior. La prueba
de carga inicial se actualizó para esperar la ilustración principal nueva.
Los cuatro JPG copiados se verificaron idénticos a los originales con SHA256.

Antes de publicar: revisar esta rama y los recursos gráficos; validar migraciones
en MySQL8.4 aislado; obtener autorización para respaldo/ausencia de escritores y
aplicar el esquema con TLS verificado. Después verificar historial y aprobar
merge a develop y despliegue. No desplegar este backend con migraciones pendientes.
