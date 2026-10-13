# Ruleta de actividades

Sección del estudiante en `/roulette`, enlazada desde el menú principal.
Usa exclusivamente `useAppData`: materias, tareas y exámenes propios ya cargados.
No llama a APIs ni cambia estados de actividades; no necesita backend o migraciones.

Cada opción se identifica por tipo e ID, incluyendo referencias anidadas sin
duplicarlas. Las tareas completadas están excluidas inicialmente y pueden incluirse
voluntariamente. Selección individual, todas o ninguna; no se gira una lista vacía.
Una materia y sus tareas son opciones diferentes: estudiar la materia no duplica
la identidad de una tarea. Los exámenes registrados no se filtran por fecha o nota.

El ganador se sortea uniformemente antes del giro con `crypto.getRandomValues`
y rechazo del sobrante de 32 bits, evitando sesgo de módulo. Todos los sectores
tienen igual tamaño. El giro de seis vueltas termina con el centro del sector
elegido bajo la flecha fija; los giros posteriores conservan el ángulo acumulado.
La animación CSS dura 4,6 segundos, con aceleración y frenado gradual. El resultado
se publica al terminar la transición o con un respaldo de 4,7 segundos. Se bloquean
giros y cambios del conjunto durante ese tiempo y se limpia el temporizador al salir.
La lista del giro se congela aunque se actualicen los datos de la cuenta.

`prefers-reduced-motion` elimina el giro y la animación del resultado. Los controles
son nativos de teclado, el resultado usa `aria-live` y la lista identifica los sectores
sin depender del color. Para muchas opciones se priorizan números y la lista; con más
de 36 se omiten etiquetas dentro del círculo para conservar legibilidad.

Los comentarios son frases locales, editables en `utils/roulette.js`, sin servicios
externos. Se evitan repeticiones consecutivas por etapa, se comenta el giro reiterado
y el estudiante puede silenciarlos durante la visita. No se escriben preferencias
de notificaciones. El resultado enlaza a la tarjeta concreta en materias/tareas/exámenes
mediante un fragmento y mueve el foco; si desapareció del conjunto no ofrece un enlace.

Rama independiente desde `develop`, sin integrar otras funcionalidades. Sin cambios
de calendario, tutorial, notificaciones ni infraestructura de producción.
