import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Home } from './Home';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('Home', () => {
  it('renders the landing page', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText('MiniRTC')).toBeInTheDocument();
    expect(screen.getByText('Create Room')).toBeInTheDocument();
  });

  it('navigates to a new room on Create Room click', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByText('Create Room'));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringMatching(/^\/room\/[0-9a-f-]{36}$/),
    );
  });

  it('join button is disabled when input is empty', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText('Join')).toBeDisabled();
  });

  it('navigates to room when joining with an ID', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await userEvent.type(
      screen.getByPlaceholderText('Paste room ID or link'),
      'my-room',
    );
    await userEvent.click(screen.getByText('Join'));

    expect(mockNavigate).toHaveBeenCalledWith('/room/my-room');
  });
});
