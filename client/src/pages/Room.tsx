import { useEffect, useCallback, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { VideoPlayer } from '../components/VideoPlayer';
import type { ServerMessage } from '../types';

function MicIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
      {muted && <line x1="1" y1="1" x2="23" y2="23" stroke="#e54545" strokeWidth="2.5" />}
    </svg>
  );
}

function CamIcon({ off }: { off: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      {off && <line x1="1" y1="1" x2="23" y2="23" stroke="#e54545" strokeWidth="2.5" />}
    </svg>
  );
}

// Use the same host as the page — works with Vite proxy in dev
// and with any reverse proxy (ngrok, nginx, etc.) in production
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${wsProtocol}//${window.location.host}/ws`;
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
  const [showLeaveMenu, setShowLeaveMenu] = useState(false);
  const [copied, setCopied] = useState(false);
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
        case 'call-ended':
          clearCallTimeout();
          webrtcRef.current?.hangUp();
          setCallState('idle');
          break;

        // WebRTC signaling
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          console.log('[Room] Forwarding to WebRTC:', message.type);
          webrtcRef.current?.handleSignalingMessage(message);
          break;
        case 'error':
          if (message.code === 'ROOM_FULL') {
            setError('Room is full. Redirecting...');
            setTimeout(() => navigate('/'), 2000);
          } else {
            setError(message.message);
          }
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
    send({ type: 'call-ended' });
    setCallState('idle');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="room">
      <header className="room-header">
        <div className="room-header-left">
          <h2>Room: {roomId?.slice(0, 8)}...</h2>
          <button className="btn btn-copy-link" onClick={copyLink}>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
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
        {/* Left side: media controls (during call) */}
        <div className="controls-left">
          {callState === 'in-call' && (
            <>
              <button
                className={`btn btn-icon ${isMuted ? 'btn-icon-off' : ''}`}
                onClick={toggleMute}
                disabled={!localStream}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                <MicIcon muted={isMuted} />
              </button>
              <button
                className={`btn btn-icon ${isVideoOff ? 'btn-icon-off' : ''}`}
                onClick={toggleVideo}
                disabled={!localStream}
                title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
              >
                <CamIcon off={isVideoOff} />
              </button>
            </>
          )}
        </div>

        {/* Right side: call/leave actions */}
        <div className="controls-right">
          {peerId && callState === 'idle' && (
            <button className="btn btn-primary" onClick={requestCall}>
              Call
            </button>
          )}

          {callState === 'in-call' ? (
            <div className="leave-menu-wrapper">
              <button
                className="btn btn-danger"
                onClick={() => setShowLeaveMenu(!showLeaveMenu)}
              >
                Leave
              </button>
              {showLeaveMenu && (
                <>
                  <div className="leave-menu-backdrop" onClick={() => setShowLeaveMenu(false)} />
                  <div className="leave-menu">
                    <button className="leave-menu-item" onClick={() => { setShowLeaveMenu(false); endCall(); }}>
                      End call
                    </button>
                    <button className="leave-menu-item leave-menu-danger" onClick={() => { setShowLeaveMenu(false); endCall(); leaveRoom(); }}>
                      End call &amp; leave room
                    </button>
                    <button className="leave-menu-cancel" onClick={() => setShowLeaveMenu(false)}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button className="btn btn-danger" onClick={leaveRoom}>
              Leave
            </button>
          )}
        </div>
      </div>

      {!peerId && wsStatus === 'connected' && (
        <div className="waiting">
          <p>Waiting for a peer to join...</p>
        </div>
      )}
    </div>
  );
}
