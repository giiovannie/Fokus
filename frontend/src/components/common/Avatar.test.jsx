import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Avatar } from './Avatar.jsx'

const profile = { name: 'Ana', last_name: 'Pérez', avatar_url: 'https://example.com/photo.webp' }

describe('Avatar compartido', () => {
  it.each([null, '', 'invalid', 'javascript:alert(1)'])('muestra iniciales para URL %j', (avatar_url) => {
    render(<Avatar profile={{ ...profile, avatar_url }} className="profile-avatar" />)
    expect(screen.getByRole('img')).toHaveTextContent('AP')
    expect(screen.getByRole('img')).toHaveClass('profile-avatar')
  })

  it('muestra iniciales si la imagen falla y vuelve a intentar cuando cambia la URL', () => {
    const { rerender } = render(<Avatar profile={profile} />)
    fireEvent.error(screen.getByAltText('Foto de perfil'))
    expect(screen.getByRole('img')).toHaveTextContent('AP')
    rerender(<Avatar profile={{ ...profile, avatar_url: 'https://example.com/new.webp' }} />)
    expect(screen.getByAltText('Foto de perfil')).toHaveAttribute('src', 'https://example.com/new.webp')
  })

  it('tolera un perfil vacío y actualiza las iniciales desde las props', () => {
    const { rerender } = render(<Avatar />)
    expect(screen.getByRole('img')).toBeEmptyDOMElement()
    rerender(<Avatar profile={{ name: 'Eva', last_name: 'Díaz' }} />)
    expect(screen.getByRole('img')).toHaveTextContent('ED')
  })
})
