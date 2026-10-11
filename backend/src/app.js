import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js'
import { apiRouter } from './routes/index.js'
import { getCorsOrigins } from './config/environment.js'

const app = express()

app.disable('x-powered-by')
// Solo un salto explícito: nunca confiar en toda la cadena X-Forwarded-For.
app.set('trust proxy', process.env.TRUST_PROXY_HOPS === '1' ? 1 : false)
const allowedOrigins = getCorsOrigins()
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) return callback(null, Boolean(origin))
    return callback(Object.assign(new Error('Origen no permitido'), { status: 403 }))
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json())
app.use(cookieParser())
app.use('/api', apiRouter)
app.use(notFoundHandler)
app.use(errorHandler)

export { app }
