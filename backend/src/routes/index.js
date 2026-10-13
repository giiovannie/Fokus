import { adminRouter } from './admin.routes.js'
import { calendarRouter } from './calendar.routes.js'
import { notificationWorkerRouter } from './notificationWorker.routes.js'
import { Router } from 'express'
import { getHealth } from '../controllers/health.controller.js'
import { authRouter } from './auth.routes.js'
import { dashboardRouter } from './dashboard.routes.js'
import { examRouter } from './exam.routes.js'
import { profileRouter } from './profile.routes.js'
import { subjectRouter } from './subject.routes.js'
import { studyActivityRouter } from './studyActivity.routes.js'
import { teacherRouter } from './teacher.routes.js'
import { taskRouter } from './task.routes.js'
import { noteRouter } from './note.routes.js'
import { notificationRouter } from './notification.routes.js'
import { userRouter } from './user.routes.js'

const router = Router()
router.get('/health', getHealth)
router.use('/internal', notificationWorkerRouter)

router.use('/auth', authRouter)
router.use('/dashboard', dashboardRouter)
router.use('/exams', examRouter)
router.use('/profiles', profileRouter)
router.use('/subjects', subjectRouter)
router.use('/study-activities', studyActivityRouter)
router.use('/teachers', teacherRouter)
router.use('/tasks', taskRouter)
router.use('/notes', noteRouter)
router.use('/notifications', notificationRouter)
router.use('/users', userRouter)
router.use('/admin', adminRouter)
router.use('/calendar', calendarRouter)

export { router as apiRouter }
