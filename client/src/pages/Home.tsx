import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useWebSocket } from '../hooks/useWebSocket';
import { WS_URL } from '../config';
import type { ServerMessage } from '../types';

interface RoomInfo {
  roomId: string;
  roomName?: string;
  userCount: number;
}

export function Home() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  const onMessage = useCallback((message: ServerMessage) => {
    if (message.type === 'room-list') {
      setRooms(message.rooms);
    }
  }, []);

  const { status, connect, send } = useWebSocket({ url: WS_URL, onMessage });

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (status === 'connected') {
      send({ type: 'list-rooms' });
    }
  }, [status, send]);

  const openCreateModal = () => {
    setNewRoomName('');
    setShowCreateModal(true);
  };

  const confirmCreateRoom = () => {
    const id = uuidv4();
    const name = newRoomName.trim();
    setShowCreateModal(false);
    if (name) {
      navigate(`/room/${id}?name=${encodeURIComponent(name)}`);
    } else {
      navigate(`/room/${id}`);
    }
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const id = roomId.trim();
    if (id) {
      navigate(`/room/${id}`);
    }
  };

  const joinExistingRoom = (id: string) => {
    navigate(`/room/${id}`);
  };

  return (
    <div className="home">
      <h1>MiniRTC</h1>
      <p>Simple 1:1 video calls</p>

      <div className="home-actions">
        <button className="btn btn-primary" onClick={openCreateModal}>
          Create Room
        </button>

        <div className="divider">or</div>

        <form onSubmit={joinRoom} className="join-form">
          <input
            type="text"
            placeholder="Paste room ID or link"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button className="btn" type="submit" disabled={!roomId.trim()}>
            Join
          </button>
        </form>
      </div>

      <div className="room-list">
        <h2>Active Rooms</h2>
        {rooms.length === 0 ? (
          <p className="room-list-empty">No active rooms</p>
        ) : (
          <ul>
            {rooms.map((room) => (
              <li key={room.roomId} className="room-list-item">
                <span className="room-id" title={room.roomId}>
                  {room.roomName || `${room.roomId.slice(0, 8)}...`}
                </span>
                <span className="room-users">{room.userCount}/2</span>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={room.userCount >= 2}
                  onClick={() => joinExistingRoom(room.roomId)}
                >
                  {room.userCount >= 2 ? 'Full' : 'Join'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showCreateModal && (
        <>
          <div className="modal-backdrop" onClick={() => setShowCreateModal(false)} />
          <div className="modal" role="dialog" aria-label="Create Room">
            <h3>Create Room</h3>
            <input
              type="text"
              placeholder="Room name (optional)"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmCreateRoom()}
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={confirmCreateRoom}>
                Create
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
