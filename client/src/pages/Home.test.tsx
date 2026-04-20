import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Home } from './Home';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Capture the onMessage callback so tests can push server messages
let capturedOnMessage: ((msg: object) => void) | null = null;
const mockConnect = vi.fn();
const mockSend = vi.fn();

vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: ({ onMessage }: { onMessage: (msg: object) => void }) => {
    capturedOnMessage = onMessage;
    return {
      status: 'connected',
      connect: mockConnect,
      disconnect: vi.fn(),
      send: mockSend,
    };
  },
}));

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedOnMessage = null;
});

describe('Home', () => {
  it('renders the landing page', () => {
    renderHome();
    expect(screen.getByText('MiniRTC')).toBeInTheDocument();
    expect(screen.getByText('Create Room')).toBeInTheDocument();
  });

  it('opens create modal on Create Room click', async () => {
    renderHome();
    await userEvent.click(screen.getByText('Create Room'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Room name (optional)')).toBeInTheDocument();
  });

  it('closes modal on Cancel click without navigating', async () => {
    renderHome();
    await userEvent.click(screen.getByText('Create Room'));
    await userEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates to room with name query param on Create', async () => {
    renderHome();
    await userEvent.click(screen.getByText('Create Room'));
    await userEvent.type(
      screen.getByPlaceholderText('Room name (optional)'),
      'Standup',
    );
    // Click the Create button inside the modal
    const createButtons = screen.getAllByText('Create');
    await userEvent.click(createButtons[createButtons.length - 1]);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringMatching(/^\/room\/[0-9a-f-]{36}\?name=Standup$/),
    );
  });

  it('navigates to room without name param when name is empty', async () => {
    renderHome();
    await userEvent.click(screen.getByText('Create Room'));
    const createButtons = screen.getAllByText('Create');
    await userEvent.click(createButtons[createButtons.length - 1]);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringMatching(/^\/room\/[0-9a-f-]{36}$/),
    );
  });

  it('join button is disabled when input is empty', () => {
    renderHome();
    expect(screen.getByText('Join')).toBeDisabled();
  });

  it('navigates to room when joining with an ID', async () => {
    renderHome();
    await userEvent.type(
      screen.getByPlaceholderText('Paste room ID or link'),
      'my-room',
    );
    await userEvent.click(screen.getByText('Join'));
    expect(mockNavigate).toHaveBeenCalledWith('/room/my-room');
  });

  it('sends list-rooms on connect', () => {
    renderHome();
    expect(mockSend).toHaveBeenCalledWith({ type: 'list-rooms' });
  });

  it('shows empty state when no rooms exist', () => {
    renderHome();
    act(() => {
      capturedOnMessage?.({ type: 'room-list', rooms: [] });
    });
    expect(screen.getByText('No active rooms')).toBeInTheDocument();
  });

  it('renders room name when available', () => {
    renderHome();
    act(() => {
      capturedOnMessage?.({
        type: 'room-list',
        rooms: [
          { roomId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', roomName: 'Standup', userCount: 1 },
        ],
      });
    });
    expect(screen.getByText('Standup')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('falls back to truncated ID when no room name', () => {
    renderHome();
    act(() => {
      capturedOnMessage?.({
        type: 'room-list',
        rooms: [
          { roomId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', userCount: 1 },
        ],
      });
    });
    expect(screen.getByText('aaaaaaaa...')).toBeInTheDocument();
  });

  it('join button in room list navigates to the room', async () => {
    renderHome();
    act(() => {
      capturedOnMessage?.({
        type: 'room-list',
        rooms: [
          { roomId: 'room-123', userCount: 1 },
        ],
      });
    });
    const joinButtons = screen.getAllByText('Join');
    const roomJoinButton = joinButtons.find(
      (btn) => btn.closest('.room-list-item') !== null,
    )!;
    await userEvent.click(roomJoinButton);
    expect(mockNavigate).toHaveBeenCalledWith('/room/room-123');
  });

  it('disables join button when room is full', () => {
    renderHome();
    act(() => {
      capturedOnMessage?.({
        type: 'room-list',
        rooms: [
          { roomId: 'full-room', userCount: 2 },
        ],
      });
    });
    expect(screen.getByText('Full')).toBeDisabled();
  });

  it('updates room list when new room-list event arrives', () => {
    renderHome();
    act(() => {
      capturedOnMessage?.({
        type: 'room-list',
        rooms: [{ roomId: 'room-1', userCount: 1 }],
      });
    });
    expect(screen.getByText('1/2')).toBeInTheDocument();

    act(() => {
      capturedOnMessage?.({
        type: 'room-list',
        rooms: [{ roomId: 'room-1', userCount: 2 }],
      });
    });
    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(screen.getByText('Full')).toBeDisabled();
  });
});
