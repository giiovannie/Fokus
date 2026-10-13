export const table = 'exams'
export const kind = 'add_indexes'
export const columns = () => ({})
export const indexes = [{ name: 'exam_subject_date', fields: ['subject_id', 'exam_date', 'id'] }]
