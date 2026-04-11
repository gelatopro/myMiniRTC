import { useEffect, useCallback, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { VideoPlayer } from '../components/VideoPlayer';
import type { ServerMessage } from '../types';

const WS_URL = `ws://${window.location.hostname}:8080`;
const CALL_TIMEOUT_MS = 30_000;

type CallState =
  | 'idle'           // No call in progress
  | 'outgoing'       // We sent a call request, waiting for response
  | 'incoming'       // We received a call request
  | 'in-call';       // Call accepted, WebRTC active

export function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [peerId, setPeerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [callState, setCallState] = useState<CallState>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const webrtcRef = useRef<ReturnType<typeof useWebRTC>>(null);

  const clearCallTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const { send, status: wsStatus, connect, disconnect } = useWebSocket({
    url: WS_URL,
    onMessage: useCallback((message: ServerMessage) => {
      console.log('[Room] Received:', message.type);
      switch (message.type) {
        case 'joined':
          setError(null);
          if (message.peers.length > 0) {
            setPeerId(message.peers[0]);
          }
          break;
        case 'peer-joined':
          setPeerId(message.userId);
          break;
        case 'peer-left':
          setPeerId(null);
          setCallState('idle');
          clearCallTimeout();
          webrtcRef.current?.hangUp();
          break;

        // Call signaling
        case 'call-request':
          setCallState('incoming');
          // Auto-decline after 30s
          timeoutRef.current = setTimeout(() => {
            setCallState('idle');
          }, CALL_TIMEOUT_MS);
          break;
        case 'call-accepted':
          clearCallTimeout();
          setCallState('in-call');
          console.log('[Room] Call accepted, starting WebRTC...');
          webrtcRef.current?.startCall();
          break;
        case 'call-declined':
          clearCallTimeout();
          setCallState('idle');
          setError('Call was declined');
          setTimeout(() => setError(null), 3000);
          break;

        // WebRTC signaling
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          console.log('[Room] Forwarding to WebRTC:', message.type);
          webrtcRef.current?.handleSignalingMessage(message);
          break;
        case 'error':
          setError(message.message);
          break;
      }
    }, [clearCallTimeout]),
  });

  const webrtc = useWebRTC({ send });
  webrtcRef.current = webrtc;

  const {
    localStream,
    remoteStream,
    callStatus,
    isMuted,
    isVideoOff,
    toggleMute,
    toggleVideo,
    hangUp,
  } = webrtc;

  // Connect WebSocket — delay slightly to avoid StrictMode's
  // immediate mount/unmount creating a wasted connection
  useEffect(() => {
    const timer = setTimeout(() => connect(), 0);
    return () => {
      clearTimeout(timer);
      disconnect();
    };
  }, [connect, disconnect]);

  // Join room once WebSocket is connected
  useEffect(() => {
    if (wsStatus === 'connected' && roomId) {
      send({ type: 'join', roomId });
    }
  }, [wsStatus, roomId, send]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => clearCallTimeout();
  }, [clearCallTimeout]);

  const requestCall = () => {
    send({ type: 'call-request' });
    setCallState('outgoing');
    // Timeout after 30s
    timeoutRef.current = setTimeout(() => {
      setCallState('idle');
      setError('Call timed out');
      setTimeout(() => setError(null), 3000);
    }, CALL_TIMEOUT_MS);
  };

  const acceptCall = () => {
    clearCallTimeout();
    send({ type: 'call-accepted' });
    setCallState('in-call');
    // Callee waits for the offer from the caller
  };

  const declineCall = () => {
    clearCallTimeout();
    send({ type: 'call-declined' });
    setCallState('idle');
  };

  const cancelCall = () => {
    clearCallTimeout();
    send({ type: 'call-declined' });
    setCallState('idle');
  };

  const leaveRoom = () => {
    clearCallTimeout();
    hangUp();
    send({ type: 'leave' });
    disconnect();
    navigate('/');
  };

  const endCall = () => {
    hangUp();
    setCallState('idle');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  return (
    <div className="room">
      <header className="room-header">
        <h2>Room: {roomId?.slice(0, 8)}...</h2>
        <div className="status-badges">
          <span className={`badge ws-${wsStatus}`}>
            WS: {wsStatus}
          </span>
          <span className={`badge call-${callStatus}`}>
            Call: {callStatus}
          </span>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {/* Incoming call banner */}
      {callState === 'incoming' && (
        <div className="call-banner incoming">
          <span>Incoming call from peer...</span>
          <div className="call-banner-actions">
            <button className="btn btn-primary" onClick={acceptCall}>
              Accept
            </button>
            <button className="btn btn-danger" onClick={declineCall}>
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Outgoing call banner */}
      {callState === 'outgoing' && (
        <div className="call-banner outgoing">
          <span>Calling peer...</span>
          <button className="btn btn-danger" onClick={cancelCall}>
            Cancel
          </button>
        </div>
      )}

      <div className="videos">
        <VideoPlayer stream={localStream} muted={true} label="You" />
        <VideoPlayer
          stream={remoteStream}
          label={peerId ? `Peer ${peerId.slice(0, 8)}...` : 'Waiting for peer...'}
        />
      </div>

      <div className="controls">
        {/* Call button — only show when peer is present and no call active */}
        {peerId && callState === 'idle' && (
          <button className="btn btn-primary" onClick={requestCall}>
            Call
          </button>
        )}

        {/* In-call controls */}
        {callState === 'in-call' && (
          <>
            <button className="btn" onClick={toggleMute} disabled={!localStream}>
              {isMuted ? '🔇 Unmute' : '🔊 Mute'}
            </button>
            <button className="btn" onClick={toggleVideo} disabled={!localStream}>
              {isVideoOff ? '📷 Video On' : '📹 Video Off'}
            </button>
            <button className="btn btn-danger" onClick={endCall}>
              End Call
            </button>
          </>
        )}

        <button className="btn" onClick={copyLink}>
          📋 Copy Link
        </button>
        <button className="btn btn-danger" onClick={leaveRoom}>
          Leave Room
        </button>
      </div>

      {!peerId && wsStatus === 'connected' && (
        <div className="waiting">
          <p>Share this link with someone to start a call:</p>
          <code>{window.location.href}</code>
        </div>
      )}
    </div>
  );
}
