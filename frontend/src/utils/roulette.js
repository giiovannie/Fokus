const UINT32_RANGE = 2 ** 32
const drawUint32 = () => crypto.getRandomValues(new Uint32Array(1))[0]

// Rechazar el sobrante evita favorecer índices cuando el total no divide 2^32.
export const randomIndex = (length, draw = drawUint32) => {
  if (!Number.isSafeInteger(length) || length < 1 || length > UINT32_RANGE) throw new RangeError('No hay opciones válidas para girar.')
  const limit = UINT32_RANGE - UINT32_RANGE % length
  let value
  do { value = draw() } while (value >= limit)
  return value % length
}

export const buildRouletteOptions = (data, includeCompleted = false) => {
  const subjects = data.subjects || []
  const subjectNames = new Map(subjects.map(subject => [Number(subject.id), subject.name]))
  const unique = new Map()
  const add = (type, rows) => {
    for (const row of rows) {
      const id = Number(row.id), key = type + ':' + id
      if (!Number.isSafeInteger(id) || id < 1 || unique.has(key)) continue
      unique.set(key, { key, id, type, label: type === 'subject' ? row.name : row.title,
        subject: subjectNames.get(Number(row.subject_id)) || row.subject?.name || '', status: row.status,
        href: '/' + { subject: 'subjects', task: 'tasks', exam: 'exams' }[type] + '#' + type + '-' + id })
    }
  }
  add('subject', subjects)
  add('task', [...(data.tasks || []), ...subjects.flatMap(subject => subject.tasks || [])])
  add('exam', [...(data.exams || []), ...subjects.flatMap(subject => subject.exams || [])])
  return [...unique.values()].filter(option => includeCompleted || option.type !== 'task' || option.status !== 'completed')
}

export const winningRotation = (previous, index, count) => {
  const target = (360 - (index + 0.5) * 360 / count) % 360
  const current = (previous % 360 + 360) % 360
  return previous + 6 * 360 + (target - current + 360) % 360
}

export const rouletteComments = Object.freeze({
  before: ['¿Otra vez sin saber qué estudiar? Bueno, yo decido', 'Tantas materias y tan pocas ganas, ¿no?', 'Elegí tus opciones. Las ganas las buscamos después.', 'Un pequeño giro para una gran decisión: abrir los apuntes.'],
  during: ['Girando... como tus excusas para no estudiar', 'El destino decide. Tu procrastinación tiembla', 'Los apuntes están conteniendo la respiración.', 'Se viene una cita romántica con tus pendientes.'],
  after: ['Te tocó {actividad}. Mis condolencias', '{actividad}. No me mires así, vos apretaste el botón', 'Bueno, a estudiar. TikTok puede esperar', '{actividad}: el universo acaba de asignarte tarea.'],
  repeat: ['¿Cuántas veces vas a girar hasta que salga lo que querés?', 'La ruleta gira. Los apuntes siguen esperando.', 'Otro giro. El botón ya está haciendo más ejercicio que tus apuntes.'],
})

export const nextRouletteComment = (phase, previous, activity = '', choose = randomIndex) => {
  const options = rouletteComments[phase].map(text => text.replace('{actividad}', activity)).filter(text => text !== previous)
  return options[choose(options.length)]
}
