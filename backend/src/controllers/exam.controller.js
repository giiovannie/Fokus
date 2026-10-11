import { Exam, Subject } from '../models/index.js'
import { createHttpError } from '../utils/httpError.js'
import { pick } from '../utils/pick.js'

const examAttributes = ['id', 'title', 'exam_date', 'exam_time', 'topics', 'grade', 'subject_id']

const findOwnedSubject = async (subjectId, userId) => {
  const subject = await Subject.findOne({ where: { id: subjectId, user_id: userId } })
  if (!subject) throw createHttpError(400, 'La materia indicada no es válida')
  return subject
}

const findOwnedExam = async (examId, userId) => {
  const exam = await Exam.findOne({
    where: { id: examId },
    include: [{ model: Subject, as: 'subject', where: { user_id: userId }, attributes: [] }],
  })
  if (!exam) throw createHttpError(404, 'El examen no fue encontrado')
  return exam
}

export const getExams = async (req, res, next) => {
  try {
    const exams = await Exam.findAll({
      attributes: examAttributes,
      include: [{ model: Subject, as: 'subject', where: { user_id: req.user.id }, attributes: [] }],
      order: [['exam_date', 'ASC']],
    })
    return res.json(exams)
  } catch (error) { return next(error) }
}

export const getSubjectExams = async (req, res, next) => {
  try {
    const subject = await findOwnedSubject(req.params.subjectId, req.user.id)
    return res.json(await Exam.findAll({ where: { subject_id: subject.id }, attributes: examAttributes }))
  } catch (error) { return next(error) }
}

export const getExam = async (req, res, next) => {
  try { return res.json(await findOwnedExam(req.params.id, req.user.id)) }
  catch (error) { return next(error) }
}

export const createExam = async (req, res, next) => {
  try {
    await findOwnedSubject(req.body.subject_id, req.user.id)
    const exam = await Exam.create(pick(req.body, ['title', 'exam_date', 'exam_time', 'topics', 'subject_id']))
    return res.status(201).json(examAttributes.reduce((data, key) => ({ ...data, [key]: exam[key] }), {}))
  } catch (error) { return next(error) }
}

export const updateExam = async (req, res, next) => {
  try {
    const exam = await findOwnedExam(req.params.id, req.user.id)
    if (req.body.subject_id) await findOwnedSubject(req.body.subject_id, req.user.id)
    await exam.update(pick(req.body, ['title', 'exam_date', 'exam_time', 'topics', 'subject_id']))
    return res.json(examAttributes.reduce((data, key) => ({ ...data, [key]: exam[key] }), {}))
  } catch (error) { return next(error) }
}

export const updateExamGrade = async (req, res, next) => {
  try {
    const exam = await findOwnedExam(req.params.id, req.user.id)
    await exam.update({ grade: req.body.grade })
    return res.json({ id: exam.id, grade: Number(exam.grade) })
  } catch (error) { return next(error) }
}

export const deleteExam = async (req, res, next) => {
  try {
    const exam = await findOwnedExam(req.params.id, req.user.id)
    await exam.destroy()
    return res.json({ message: 'El examen fue eliminado correctamente' })
  } catch (error) { return next(error) }
}
