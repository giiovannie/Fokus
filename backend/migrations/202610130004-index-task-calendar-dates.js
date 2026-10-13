export const table = 'tasks'
export const kind = 'add_indexes'
export const columns = () => ({})
export const indexes = [{ name: 'task_subject_date', fields: ['subject_id', 'due_date', 'id'] }]
