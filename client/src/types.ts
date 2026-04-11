// Signaling protocol types — mirrored from server/src/types.ts

export interface RTCSessionDescriptionInit {
  type: 'offer' | 'answer';
  sdp?: string;
}

export interface RTCIceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

// Client → Server
export type ClientMessage =
  | { type: 'join'; roomId: string }
  | { type: 'leave' }
  | { type: 'call-request' }
  | { type: 'call-accepted' }
  | { type: 'call-declined' }
  | { type: 'offer'; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit };

// Server → Client
export type ServerMessage =
  | { type: 'joined'; roomId: string; userId: string; peers: string[] }
  | { type: 'peer-joined'; userId: string }
  | { type: 'peer-left'; userId: string }
  | { type: 'call-request'; from: string }
  | { type: 'call-accepted'; from: string }
  | { type: 'call-declined'; from: string }
  | { type: 'offer'; sdp: RTCSessionDescriptionInit; from: string }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit; from: string }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit; from: string }
  | { type: 'error'; code: string; message: string };
