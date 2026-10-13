# Ruleta exclusivamente de materias

Corrección en `features/fix-ruleta-solo-materias`, desde la integración `e5b3ba0`.
No modifica el backend, calendario, búhos, notificaciones ni retiro del tutorial.

La ruleta reutiliza todas las materias cargadas por AppContext con la API actual
autenticada. No realiza nuevas consultas, no incluye tareas/exámenes ni sus
referencias anidadas y deduplica por ID (dos materias distintas con igual nombre
siguen siendo dos registros). Todas participan excepto las excluidas.

Solo se guarda un array de IDs excluidos en localStorage, clave
`fokus:roulette-excluded:<ID usuario>`. Nunca se persisten participantes, resultados
ni copias de materias. Nuevas materias entran automáticamente, incluso después
de «Quitar todas». Al confirmar una carga correcta se eliminan exclusiones de IDs
que ya no existen; una carga incompleta o con error no limpia preferencias.
Cambiar de cuenta reinicia la instancia y cancela un giro anterior. Si el navegador
impide guardar, el usuario ve un aviso y puede continuar con selección temporal.

Persistencia entre sesiones en el mismo navegador/dispositivo; borrar datos del
navegador la elimina. No hay sincronización entre dispositivos ni migración nueva.

Animación 4600ms y respaldo de finalización 4700ms, generador aleatorio sin sesgo,
rotación, flecha, comentarios, movimiento reducido, temas y diseño se conservan.
Se congelan sectores durante el giro; si la ganadora desaparece, no se enlaza a
un registro eliminado. El enlace ganador apunta a `/subjects#subject-ID`.
Sin materias o con todas excluidas se explica el estado y se deshabilita el giro.
Seleccionar o girar no escribe en materias ni otros registros.

Archivos: RoulettePage.jsx, utils/roulette.js, utils/rouletteExclusions.js y sus
pruebas; esta documentación. Las regresiones incluyen carga, nuevas/eliminadas,
cuentas, almacenamiento, selección uniforme, flecha, duración y navegación real.

Validación:287 pruebas frontend y442 backend aprobadas; lint sin advertencias y
build correctos. Pruebas locales con mocks, sin notificaciones ni producción.

Para integrar esta rama no hace falta otra migración de ruleta. Hereda el calendario
y por eso la publicación completa mantiene el requisito previo de validar/aplicar
con autorización las migraciones24–27 antes del backend. No se ejecutaron aquí.
