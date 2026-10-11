import { PushSubscription } from './PushSubscription.js'
import { sequelize } from '../config/database.js'
import { NotificationPreference } from './NotificationPreference.js'
import { NotificationPhrase } from './NotificationPhrase.js'
import { NotificationRule } from './NotificationRule.js'
import { Exam } from './Exam.js'
import { Profile } from './Profile.js'
import { StudyActivity } from './StudyActivity.js'
import { Subject } from './Subject.js'
import { Task } from './Task.js'
import { TaskNote } from './TaskNote.js'
import { Teacher } from './Teacher.js'
import { User } from './User.js'

User.hasOne(Profile, { foreignKey: 'user_id', as: 'profile', onDelete: 'CASCADE' })
Profile.belongsTo(User, { foreignKey: 'user_id', as: 'user' })

User.hasMany(Teacher, { foreignKey: 'user_id', as: 'teachers', onDelete: 'CASCADE' })
Teacher.belongsTo(User, { foreignKey: 'user_id', as: 'user' })

User.hasMany(Subject, { foreignKey: 'user_id', as: 'subjects', onDelete: 'CASCADE' })
Subject.belongsTo(User, { foreignKey: 'user_id', as: 'user' })
Teacher.hasMany(Subject, { foreignKey: 'teacher_id', as: 'subjects' })
Subject.belongsTo(Teacher, { foreignKey: 'teacher_id', as: 'teacher' })

Subject.hasMany(Task, { foreignKey: 'subject_id', as: 'tasks', onDelete: 'CASCADE' })
Task.belongsTo(Subject, { foreignKey: 'subject_id', as: 'subject' })
Task.hasMany(TaskNote, { foreignKey: 'task_id', as: 'notes', onDelete: 'CASCADE' })
TaskNote.belongsTo(Task, { foreignKey: 'task_id', as: 'task' })

Subject.hasMany(Exam, { foreignKey: 'subject_id', as: 'exams', onDelete: 'CASCADE' })
Exam.belongsTo(Subject, { foreignKey: 'subject_id', as: 'subject' })
Subject.hasMany(StudyActivity, { foreignKey: 'subject_id', as: 'study_activities', onDelete: 'CASCADE' })
StudyActivity.belongsTo(Subject, { foreignKey: 'subject_id', as: 'subject' })

User.hasOne(NotificationPreference, { foreignKey: 'user_id', as: 'notification_preferences', onDelete: 'CASCADE' })
NotificationPreference.belongsTo(User, { foreignKey: 'user_id', as: 'user' })
User.hasMany(NotificationRule, { foreignKey: 'user_id', as: 'notification_rules', onDelete: 'CASCADE' })
NotificationRule.belongsTo(User, { foreignKey: 'user_id', as: 'user' })

User.hasMany(NotificationPhrase, { foreignKey: 'user_id', as: 'notification_phrases', onDelete: 'CASCADE' })
NotificationPhrase.belongsTo(User, { foreignKey: 'user_id', as: 'user' })

User.hasMany(PushSubscription, { foreignKey: 'user_id', as: 'push_subscriptions', onDelete: 'CASCADE' })
PushSubscription.belongsTo(User, { foreignKey: 'user_id', as: 'user' })

export { PushSubscription, NotificationPhrase, NotificationPreference, NotificationRule, Exam, Profile, sequelize, StudyActivity, Subject, Task, TaskNote, Teacher, User }
