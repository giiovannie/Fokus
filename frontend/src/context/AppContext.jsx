import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { ApiError } from '../services/api.js'
import { createExam, deleteExam, getExams, updateExam, updateExamGrade } from '../services/exams.service.js'
import { getNotifications } from '../services/notifications.service.js'
import { createProfile, getProfile, updateProfile as updateProfileRequest, uploadProfileAvatar } from '../services/profiles.service.js'
import { createStudyActivity, getStudyActivities, updateStudyActivityStatus } from '../services/study-activities.service.js'
import { createSubject, deleteSubject, getSubjects, updateSubject } from '../services/subjects.service.js'
import { createTaskNote, deleteTaskNote, getTaskNotes, updateTaskNote } from '../services/task-notes.service.js'
import { createTask, deleteTask, getTasks, updateTask, updateTaskStatus } from '../services/tasks.service.js'
import { createTeacher, getTeachers } from '../services/teachers.service.js'
import { applyNotificationReadState, persistNotificationReadState } from '../utils/notificationReadState.js'
import { AppContext } from './app-context.js'

const emptyProfile = { name: '', last_name: '', nickname: '', avatar_url: '' }
const emptyData = {
  profile: emptyProfile,
  teachers: [],
  subjects: [],
  tasks: [],
  notes: [],
  exams: [],
  activities: [],
  notifications: [],
}

const normalizeSubject = (subject) => ({
  ...subject,
  teacher_id: subject.teacher_id ?? subject.teacher?.id ?? null,
})

const replaceItem = (items, id, replacement) => items.map((item) => (
  item.id === id ? { ...item, ...replacement } : item
))

export const AppProvider = ({ children }) => {
  const { user } = useAuth()
  const [data, setData] = useState(emptyData)
  const [toast, setToast] = useState(null)
  const [isLoading, setIsLoading] = useState(Boolean(user))
  const [error, setError] = useState(null)
  const loadId = useRef(0)

  const notify = useCallback((message, variant = 'success') => {
    setToast({ message, variant })
    window.setTimeout(() => setToast(null), 2800)
  }, [])

  const loadData = useCallback(async () => {
    const currentLoadId = ++loadId.current

    if (!user) {
      setData(emptyData)
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const profileRequest = getProfile(user.id).catch((requestError) => {
        if (requestError instanceof ApiError && requestError.status === 404) return null
        throw requestError
      })
      const [profile, teachers, subjects, tasks, exams, activities, notifications] = await Promise.all([
        profileRequest,
        getTeachers(),
        getSubjects(),
        getTasks(),
        getExams(),
        getStudyActivities(),
        getNotifications(),
      ])
      const notes = (await Promise.all(tasks.map(({ id }) => getTaskNotes(id)))).flat()

      if (currentLoadId !== loadId.current) return
      setData({
        profile: profile ?? emptyProfile,
        teachers,
        subjects: subjects.map(normalizeSubject),
        tasks,
        notes,
        exams,
        activities,
        notifications: applyNotificationReadState(notifications, user.id),
      })
    } catch (requestError) {
      if (currentLoadId === loadId.current) setError(requestError.message)
    } finally {
      if (currentLoadId === loadId.current) setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  const runMutation = useCallback(async (request, applyResult) => {
    try {
      const result = await request()
      setData((current) => applyResult(current, result))
      return true
    } catch (requestError) {
      notify(requestError.message, 'danger')
      return false
    }
  }, [notify])

  const addItem = useCallback((collection, item) => {
    const requests = {
      teachers: () => createTeacher(item),
      subjects: () => createSubject(item),
      tasks: () => createTask(item),
      notes: () => createTaskNote(item.task_id, { content: item.content }),
      exams: () => createExam(item),
      activities: () => createStudyActivity(item),
    }
    const request = requests[collection]
    if (!request) return Promise.resolve(false)

    return runMutation(request, (current, created) => ({
      ...current,
      [collection]: [...current[collection], collection === 'subjects' ? normalizeSubject(created) : created],
    }))
  }, [runMutation])

  const updateItem = useCallback((collection, id, changes) => {
    if (collection === 'notifications') {
      setData((current) => {
        const notifications = replaceItem(current.notifications, id, changes)
        persistNotificationReadState(notifications, user?.id)
        return { ...current, notifications }
      })
      return Promise.resolve(true)
    }

    const requests = {
      subjects: () => updateSubject(id, changes),
      tasks: () => Object.hasOwn(changes, 'status')
        ? updateTaskStatus(id, changes.status)
        : updateTask(id, changes),
      notes: () => updateTaskNote(id, changes),
      exams: () => Object.hasOwn(changes, 'grade')
        ? updateExamGrade(id, changes.grade)
        : updateExam(id, changes),
      activities: () => updateStudyActivityStatus(id, changes.status),
    }
    const request = requests[collection]
    if (!request) return Promise.resolve(false)

    return runMutation(request, (current, updated) => ({
      ...current,
      [collection]: replaceItem(current[collection], id, collection === 'subjects' ? normalizeSubject(updated) : updated),
    }))
  }, [runMutation, user?.id])

  const removeItem = useCallback((collection, id) => {
    const requests = {
      subjects: () => deleteSubject(id),
      tasks: () => deleteTask(id),
      notes: () => deleteTaskNote(id),
      exams: () => deleteExam(id),
    }
    const request = requests[collection]
    if (!request) return Promise.resolve(false)

    return runMutation(request, (current) => {
      const nextData = {
        ...current,
        [collection]: current[collection].filter((item) => item.id !== id),
      }

      if (collection === 'tasks') {
        nextData.notes = current.notes.filter(({ task_id: taskId }) => taskId !== id)
      }
      if (collection === 'subjects') {
        const taskIds = new Set(current.tasks.filter(({ subject_id: subjectId }) => subjectId === id).map(({ id: taskId }) => taskId))
        nextData.tasks = current.tasks.filter(({ subject_id: subjectId }) => subjectId !== id)
        nextData.notes = current.notes.filter(({ task_id: taskId }) => !taskIds.has(taskId))
        nextData.exams = current.exams.filter(({ subject_id: subjectId }) => subjectId !== id)
        nextData.activities = current.activities.filter(({ subject_id: subjectId }) => subjectId !== id)
      }

      return nextData
    })
  }, [runMutation])

  const updateProfile = useCallback((profile) => {
    const request = data.profile.id
      ? () => updateProfileRequest(data.profile.id, profile)
      : () => createProfile({ ...profile, user_id: user.id })

    return runMutation(request, (current, updated) => ({ ...current, profile: updated }))
  }, [data.profile.id, runMutation, user])

  const uploadProfileImage = useCallback(async (file, profile) => {
    try {
      const saved = data.profile.id
        ? await updateProfileRequest(data.profile.id, profile)
        : await createProfile({ ...profile, user_id: user.id })
      // Keep a successfully created profile even if the following upload fails.
      setData((current) => ({ ...current, profile: saved }))
      const uploaded = await uploadProfileAvatar(saved.id, file)
      setData((current) => ({ ...current, profile: uploaded }))
      return uploaded
    } catch (requestError) {
      notify(requestError.message, 'danger')
      return false
    }
  }, [data.profile.id, notify, user])

  const value = useMemo(() => ({
    data,
    toast,
    isLoading,
    error,
    setError,
    retry: loadData,
    notify,
    addItem,
    updateItem,
    removeItem,
    updateProfile,
    uploadProfileImage,
  }), [data, toast, isLoading, error, loadData, notify, addItem, updateItem, removeItem, updateProfile, uploadProfileImage])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
