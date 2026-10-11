// Texto plano compartido por la API y la vista previa; nunca interpreta HTML.
export const notificationTemplates = {
  exam: {
    formal: ['Le recordamos su próximo examen.', 'Tiene un examen próximo. Prepare el material.', 'Consulte los datos de su próxima evaluación.'],
    friendly: ['¡Se acerca tu examen! Vamos paso a paso.', 'Un repasito hoy te puede ayudar mañana.', 'Te acompañamos: tu próximo examen está cerca.'],
    motivating: ['¡Vos podés! Cada repaso suma.', 'Un esfuerzo más: estás avanzando hacia tu objetivo.', 'Confiá en lo que aprendiste y seguí preparándote.'],
    sarcastic: ['El examen no se va a rendir solo. Qué sorpresa.', 'Tu yo del futuro agradecería que abras los apuntes.', 'La materia sigue ahí, aunque cierres esta notificación.'],
    unfiltered: ['Dejá de boludear y abrí los apuntes.', 'Ponete las pilas: ese examen no espera.', 'La puta madre, que no te agarre sin repasar.'],
  },
  task: {
    formal: ['Le recordamos su próxima entrega.', 'Revise el trabajo antes de su vencimiento.', 'Tiene una entrega próxima. Consulte sus datos.'],
    friendly: ['¡Tu entrega está cerca! Revisemos esos últimos detalles.', 'Un paso más y ese trabajo queda listo.', 'Te avisamos a tiempo para que llegues tranquilo.'],
    motivating: ['¡Ya estás más cerca de terminar! Seguí así.', 'Cada avance cuenta. Dale el último empujón.', 'Tu esfuerzo merece llegar a tiempo. ¡Vos podés!'],
    sarcastic: ['La fecha de entrega no acepta excusas creativas.', 'Ese trabajo no se adjunta con el poder de la mente.', 'Cerrar la pestaña no entrega el trabajo. Lo comprobamos.'],
    unfiltered: ['Dejá de boludear y terminá el trabajo.', 'Ponete las pilas: la entrega no espera.', 'Que no se vaya todo al carajo por entregarlo tarde.'],
  },
}
export const buildNotificationMessage = ({ eventType, style = 'formal', phrases = [], event, previousText, selectedText, random = Math.random, unfilteredEnabled = false, test = false }) => {
  if (!['exam', 'task'].includes(eventType)) throw new Error('Elegí examen o entrega.')
  if (style === 'unfiltered' && !unfilteredEnabled) throw new Error('Aceptá explícitamente los mensajes sin filtro antes de probarlos.')
  const candidates = style === 'custom' ? phrases.filter(phrase => phrase.event_type === eventType).map(phrase => phrase.content)
    : notificationTemplates[eventType][style]
  if (!candidates?.length) throw new Error('Agregá al menos una frase propia para este tipo de evento.')
  if (selectedText !== undefined && !candidates.includes(selectedText)) throw Object.assign(new Error('La frase de la vista previa ya no está disponible para este estilo.'), { status: 400 })
  const alternatives = candidates.filter(text => text !== previousText)
  const pool = alternatives.length ? alternatives : candidates
  const phrase = selectedText ?? pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
  // La fecha DATEONLY se formatea sin convertirla a la zona del dispositivo.
  const [year, month, day] = event.date.split('-')
  const details = `${eventType === 'exam' ? 'Examen' : 'Entrega'}: ${event.title}. Materia: ${event.subject}. Fecha: ${day}/${month}/${year}. Hora: ${event.time.slice(0, 5)} (${event.timezone}).`
  return { title: test ? 'Fokus · Notificación de prueba' : 'Fokus · ' + (eventType === 'exam' ? 'Próximo examen' : 'Próxima entrega'), body: (test ? '[PRUEBA] ' : '') + phrase + '\n' + details, phrase }
}
