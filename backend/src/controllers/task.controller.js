import { Subject, Task } from '../models/index.js'
import { createHttpError } from '../utils/httpError.js'
import { pick } from '../utils/pick.js'

const taskAttributes = ['id', 'title', 'description', 'due_date', 'due_time', 'status', 'subject_id']

const findOwnedSubject = async (subjectId, userId) => {
  const subject = await Subject.findOne({ where: { id: subjectId, user_id: userId } })
  if (!subject) throw createHttpError(400, 'La materia indicada no es válida')
  return subject
}

const findOwnedTask = async (taskId, userId) => {
  const task = await Task.findOne({
    where: { id: taskId },
    include: [{ model: Subject, as: 'subject', where: { user_id: userId }, attributes: [] }],
  })
  if (!task) throw createHttpError(404, 'La tarea no fue encontrada')
  return task
}

export const getTasks = async (req, res, next) => {
  try {
    const tasks = await Task.findAll({
      attributes: taskAttributes,
      include: [{ model: Subject, as: 'subject', where: { user_id: req.user.id }, attributes: [] }],
      order: [['due_date', 'ASC']],
    })
    return res.json(tasks)
  } catch (error) {
    return next(error)
  }
}

export const getSubjectTasks = async (req, res, next) => {
  try {
    const subject = await findOwnedSubject(req.params.subjectId, req.user.id)
    const tasks = await Task.findAll({ where: { subject_id: subject.id }, attributes: taskAttributes })
    return res.json(tasks)
  } catch (error) {
    return next(error)
  }
}

export const getTask = async (req, res, next) => {
  try {
    return res.json(await findOwnedTask(req.params.id, req.user.id))
  } catch (error) {
    return next(error)
  }
}

export const createTask = async (req, res, next) => {
  try {
    await findOwnedSubject(req.body.subject_id, req.user.id)
    const task = await Task.create(pick(req.body, ['title', 'description', 'due_date', 'due_time', 'subject_id']))
    return res.status(201).json(taskAttributes.reduce((data, key) => ({ ...data, [key]: task[key] }), {}))
  } catch (error) {
    return next(error)
  }
}

export const updateTask = async (req, res, next) => {
  try {
    const task = await findOwnedTask(req.params.id, req.user.id)
    if (req.body.subject_id) await findOwnedSubject(req.body.subject_id, req.user.id)
    await task.update(pick(req.body, ['title', 'description', 'due_date', 'due_time', 'subject_id']))
    return res.json(taskAttributes.reduce((data, key) => ({ ...data, [key]: task[key] }), {}))
  } catch (error) {
    return next(error)
  }
}

export const updateTaskStatus = async (req, res, next) => {
  try {
    const task = await findOwnedTask(req.params.id, req.user.id)
    await task.update({ status: req.body.status })
    return res.json({ id: task.id, status: task.status })
  } catch (error) {
    return next(error)
  }
}

export const deleteTask = async (req, res, next) => {
  try {
    const task = await findOwnedTask(req.params.id, req.user.id)
    await task.destroy()
    return res.json({ message: 'La tarea fue eliminada correctamente' })
  } catch (error) {
    return next(error)
  }
}

export { findOwnedTask }
