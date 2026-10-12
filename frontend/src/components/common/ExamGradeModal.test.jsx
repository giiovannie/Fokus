import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ExamGradeModal } from './ExamGradeModal.jsx'
const exam = { id: 3, title: 'Parcial de Historia', grade: null }
it.each([0, 7.5, 10])('guarda calificación %s solo al confirmar y conserva el formulario ante errores', async grade => {
  const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true), success = vi.fn()
  render(<ExamGradeModal exam={exam} subject="Historia" onSave={save} onSuccess={success} />)
  await userEvent.click(screen.getByRole('button', { name: 'Calificar Parcial de Historia' }))
  expect(within(screen.getByRole('dialog')).getByRole('heading', { name: exam.title })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Calificación obtenida'), { target: { value: String(grade) } })
  expect(save).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Guardar calificación' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar')
  expect(screen.getByLabelText('Calificación obtenida')).toHaveValue(grade)
  await userEvent.click(screen.getByRole('button', { name: 'Guardar calificación' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(save).toHaveBeenLastCalledWith(grade); expect(success).toHaveBeenCalledOnce()
})
it('cancela sin guardar y rechaza calificaciones fuera de la escala', async () => {
  const save = vi.fn()
  render(<ExamGradeModal exam={{ ...exam, grade: 8 }} subject="Historia" onSave={save} />)
  await userEvent.click(screen.getByRole('button', { name: 'Calificar Parcial de Historia' }))
  fireEvent.change(screen.getByLabelText('Calificación obtenida'), { target: { value: '11' } })
  fireEvent.submit(document.getElementById('grade-form-3'))
  expect(screen.getByRole('alert')).toHaveTextContent('entre 0 y 10')
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(save).not.toHaveBeenCalled()
})
