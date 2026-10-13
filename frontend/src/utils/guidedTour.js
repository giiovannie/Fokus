export const tourSteps = Object.freeze([
  { path: '/', target: '[data-tour="dashboard-stats"]', title: 'Tus indicadores', text: 'Estos números resumen materias, tareas pendientes, exámenes próximos y avisos sin leer.' },
  { path: '/', target: '[data-tour="dashboard-upcoming"]', title: 'Lo que viene', text: 'Acá ves tus próximas entregas y evaluaciones. Los enlaces te llevan a los listados reales.' },
  { path: '/subjects', open: '[data-tour="subject-create"]', target: '#subject-name', title: 'Tus materias', text: 'Completá el nombre y elegí un profesor. Después podés editar o eliminar la materia desde su tarjeta. Este formulario está vacío: el recorrido no guarda nada.' },
  { path: '/subjects', open: '[data-tour="teacher-create"]', target: '#teacher-name', title: 'Profesores', text: 'Agregá un profesor con su nombre y asocialo al crear una materia. Actualmente esa asociación es obligatoria. Si empezás a escribir, el recorrido se pausa para que puedas trabajar.' },
  { path: '/tasks', open: '[data-tour="task-create"]', target: '#task-title', title: 'Organizá tus tareas', text: 'Escribí el trabajo, elegí la materia y su fecha, o marcá Sin fecha de entrega. Si falta una materia, Crear materia aquí conserva lo que escribiste. Podés avanzar el estado y agregar notas desde el listado.' },
  { path: '/exams', open: '[data-tour="exam-create"]', target: '#exam-title', title: 'Agendá exámenes', text: 'Elegí título, materia, fecha y temas. Crear materia aquí también te permite agregar su profesor sin perder el borrador del examen. Solo Guardar confirma tus datos.' },
  { path: '/notifications', target: '[data-tour="notification-tools"]', title: 'Tus recordatorios', text: 'Acá consultás los avisos dentro de Fokus. Abrí las preferencias para elegir qué recordatorios querés recibir.' },
  { path: '/notifications/preferences', target: '#notifications-enabled', title: 'Avisos a tu medida', text: 'Los recordatorios respetan tus reglas y horarios de silencio. Para recibirlos fuera de Fokus, autorizá las notificaciones de este dispositivo. El recorrido no cambia tus preferencias ni pide permisos.' },
])

export const placeTourCard = (rect, width, height, cardHeight = 260, offset = { left: 0, top: 0 }) => {
  const cardWidth = Math.min(360, Math.max(0, width - 24))
  const visibleHeight = Math.max(0, height - 24)
  cardHeight = Math.min(cardHeight, visibleHeight)
  let left = rect.right + 16, top = rect.top
  if (left + cardWidth > offset.left + width - 12) {
    if (rect.left - cardWidth - 16 >= offset.left + 12) left = rect.left - cardWidth - 16
    else { left = rect.left; top = rect.bottom + 16 }
  }
  if (top + cardHeight > offset.top + height - 12) top = rect.top - cardHeight - 16
  return { left: Math.max(offset.left + 12, Math.min(left, offset.left + width - cardWidth - 12)), top: Math.max(offset.top + 12, Math.min(top, offset.top + height - cardHeight - 12)), width: cardWidth, maxHeight: visibleHeight }
}
