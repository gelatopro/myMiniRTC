import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Room } from './Room';

const mockSend = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
let capturedOnMessage: ((msg: object) => void) | null = null;
let wsStatus = 'connected';

vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: ({ onMessage }: { onMessage: (msg: object) => void }) => {
    capturedOnMessage = onMessage;
    return {
      status: wsStatus,
      connect: mockConnect,
      disconnect: mockDisconnect,
      send: mockSend,
    };
  },
}));

vi.mock('../hooks/useWebRTC', () => ({
  useWebRTC: () => ({
    localStream: null,
    remoteStream: null,
    callStatus: 'idle',
    isMuted: false,
    isVideoOff: false,
    toggleMute: vi.fn(),
    toggleVideo: vi.fn(),
    startCall: vi.fn(),
    handleOffer: vi.fn(),
    handleAnswer: vi.fn(),
    handleIceCandidate: vi.fn(),
    hangUp: vi.fn(),
  }),
}));

function renderRoom(path = '/room/test-room-id') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/room/:roomId" element={<Room />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedOnMessage = null;
  wsStatus = 'connected';
});

describe('Room - room name', () => {
  it('shows room name from joined event', () => {
    renderRoom();
    act(() => {
      capturedOnMessage?.({
        type: 'joined',
        roomId: 'test-room-id',
        roomName: 'Standup',
        userId: 'u1',
        peers: [],
      });
    });
    expect(screen.getByText('Standup')).toBeInTheDocument();
  });

  it('falls back to truncated room ID when no name', () => {
    renderRoom();
    act(() => {
      capturedOnMessage?.({
        type: 'joined',
        roomId: 'test-room-id',
        userId: 'u1',
        peers: [],
      });
    });
    expect(screen.getByText('Room: test-roo...')).toBeInTheDocument();
  });

  it('sends roomName from query param in join message', () => {
    renderRoom('/room/test-room-id?name=MyRoom');
    // The join is sent when wsStatus becomes connected
    expect(mockSend).toHaveBeenCalledWith({
      type: 'join',
      roomId: 'test-room-id',
      roomName: 'MyRoom',
    });
  });

  it('shows inline edit on name click', async () => {
    renderRoom();
    act(() => {
      capturedOnMessage?.({
        type: 'joined',
        roomId: 'test-room-id',
        roomName: 'Old Name',
        userId: 'u1',
        peers: [],
      });
    });
    await userEvent.click(screen.getByText('Old Name'));
    expect(screen.getByDisplayValue('Old Name')).toBeInTheDocument();
  });

  it('sends update-room-name on Enter', async () => {
    renderRoom();
    act(() => {
      capturedOnMessage?.({
        type: 'joined',
        roomId: 'test-room-id',
        roomName: 'Old',
        userId: 'u1',
        peers: [],
      });
    });
    await userEvent.click(screen.getByText('Old'));
    const input = screen.getByDisplayValue('Old');
    await userEvent.clear(input);
    await userEvent.type(input, 'New Name{Enter}');
    expect(mockSend).toHaveBeenCalledWith({
      type: 'update-room-name',
      name: 'New Name',
    });
  });

  it('updates name when room-name-updated event received', () => {
    renderRoom();
    act(() => {
      capturedOnMessage?.({
        type: 'joined',
        roomId: 'test-room-id',
        userId: 'u1',
        peers: [],
      });
    });
    act(() => {
      capturedOnMessage?.({
        type: 'room-name-updated',
        name: 'Peer Renamed',
      });
    });
    expect(screen.getByText('Peer Renamed')).toBeInTheDocument();
  });
});
