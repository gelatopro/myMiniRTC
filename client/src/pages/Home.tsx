import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

export function Home() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');

  const createRoom = () => {
    navigate(`/room/${uuidv4()}`);
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const id = roomId.trim();
    if (id) {
      navigate(`/room/${id}`);
    }
  };

  return (
    <div className="home">
      <h1>MiniRTC</h1>
      <p>Simple 1:1 video calls</p>

      <div className="home-actions">
        <button className="btn btn-primary" onClick={createRoom}>
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
    </div>
  );
}
