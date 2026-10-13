# Recorrido guiado y creación asistida

Rama independiente de `develop`; no depende de Ruleta, calendario ni persistencia
automática Push. Sin biblioteca nueva: ocho pasos usan rutas, botones y formularios
existentes, `MutationObserver`, geometría del viewport y portales React.

## Recorrido real

Una cuenta con perfil real, datos cargados, sin progreso previo y sin materias,
tareas o exámenes recibe una bienvenida con Comenzar recorrido/Omitir. Cuentas
que ya tienen actividades no son interrumpidas: usan Ver tutorial en Perfil → Ayuda.
El perfil se completa por el flujo existente; el recorrido no crea perfiles ficticios.

Los pasos incluyen indicadores y próximas actividades del Dashboard, formulario
de materias, profesores, tareas, exámenes, bandeja y preferencias de notificaciones.
Abre formularios reales vacíos y resalta el elemento mediante atributos `data-tour`.
No ejecuta submit, crea actividades, modifica preferencias ni solicita permisos.
Avanzar/retroceder cambia de ruta después de confirmar el progreso. Un formulario
de demostración vacío se cierra al cambiar de paso, pausar o finalizar. Al empezar
a escribir o interactuar con un formulario se pausa conservándolo para trabajar.

Escape pausa; los botones son accesibles por teclado y tienen tamaño táctil.
La tarjeta entra en el viewport, incluido el teclado móvil, puede desplazarse y
se monta dentro del diálogo nativo cuando existe para evitar quedar detrás/inert.
El resaltado oscurece visualmente el entorno sin interceptar eventos de la aplicación.
Se actualiza en scroll, resize y cambios del DOM; limpia observadores y atributos
al cerrar. Movimiento reducido elimina la animación y el desplazamiento suave.
Si falta el objetivo, se informa que está cargando y se puede pausar o finalizar.

## Persistencia por cuenta

`profiles.preferences.onboarding` utiliza JSON ya existente: no requiere migración.
GET `/api/profiles/onboarding` lee sin escribir; PUT guarda decisiones del estudiante.
Se exige JWT y `requireStudent`, obtiene el usuario del servidor, bloquea usuario
y perfil y conserva otras claves JSON. Una revisión evita sobreescribir cambios de
otro dispositivo. La API no expone otras preferencias ni acepta `user_id` del cliente.
Omitido/completado no reinicia automáticamente; interrumpido/pausado ofrece Retomar.
Ver tutorial permite comenzar voluntariamente desde el inicio. El progreso se carga
una vez cuando la cuenta y la interfaz están listas; un fallo no bloquea la aplicación.
No se guarda progreso en almacenamiento del dispositivo. Al cambiar de usuario
se descarta la interfaz y las respuestas tardías de la cuenta anterior.

## Creación asistida

ExamForm y TaskForm ofrecen Crear materia aquí, incluso si no hay materias. El
formulario original se oculta durante la asistencia y su borrador permanece en la
página. Se reutilizan SubjectForm y TeacherForm también utilizados por Materias.
Si falta profesor, se ofrece crear uno y volver con la selección confirmada. Las
reglas actuales exigen profesor: no se permite guardar la materia sin esa asociación.
Los guardados requieren clic explícito y utilizan `addItem`/API normales. Un callback
opcional entrega el registro confirmado sin repetir consultas; la respuesta booleana
existente de `addItem` se conserva. No se realizan callbacks dentro de setters React.
Tras guardar la materia vuelve al examen/tarea, la selecciona y conserva título,
fecha, descripción/temas. Cancelación y errores mantienen el contexto; no guardan
el examen o tarea automáticamente. Editar una materia y agregar profesor vuelve a
la edición original sin duplicar formularios.

Validación automatizada con mocks; revisión visual de overlays y teclado en Android
pendiente antes de integración. Frontend y backend deben publicarse juntos cuando
se autorice; esta rama no ejecuta migraciones ni despliegues.
