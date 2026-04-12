// ── Client → Server messages ──

export interface JoinMessage {
  type: 'join';
  roomId: string;
}

export interface LeaveMessage {
  type: 'leave';
}

export interface OfferMessage {
  type: 'offer';
  sdp: RTCSessionDescriptionInit;
}

export interface AnswerMessage {
  type: 'answer';
  sdp: RTCSessionDescriptionInit;
}

export interface IceCandidateMessage {
  type: 'ice-candidate';
  candidate: RTCIceCandidateInit;
}

export interface CallRequestMessage {
  type: 'call-request';
}

export interface CallAcceptedMessage {
  type: 'call-accepted';
}

export interface CallDeclinedMessage {
  type: 'call-declined';
}

export interface CallEndedMessage {
  type: 'call-ended';
}

export type ClientMessage =
  | JoinMessage
  | LeaveMessage
  | CallRequestMessage
  | CallAcceptedMessage
  | CallDeclinedMessage
  | CallEndedMessage
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage;

// ── Server → Client messages ──

export interface JoinedEvent {
  type: 'joined';
  roomId: string;
  userId: string;
  peers: string[];
}

export interface PeerJoinedEvent {
  type: 'peer-joined';
  userId: string;
}

export interface PeerLeftEvent {
  type: 'peer-left';
  userId: string;
}

export interface OfferEvent {
  type: 'offer';
  sdp: RTCSessionDescriptionInit;
  from: string;
}

export interface AnswerEvent {
  type: 'answer';
  sdp: RTCSessionDescriptionInit;
  from: string;
}

export interface IceCandidateEvent {
  type: 'ice-candidate';
  candidate: RTCIceCandidateInit;
  from: string;
}

export interface CallRequestEvent {
  type: 'call-request';
  from: string;
}

export interface CallAcceptedEvent {
  type: 'call-accepted';
  from: string;
}

export interface CallDeclinedEvent {
  type: 'call-declined';
  from: string;
}

export interface CallEndedEvent {
  type: 'call-ended';
  from: string;
}

export interface ErrorEvent {
  type: 'error';
  code: string;
  message: string;
}

export type ServerMessage =
  | JoinedEvent
  | PeerJoinedEvent
  | PeerLeftEvent
  | CallRequestEvent
  | CallAcceptedEvent
  | CallDeclinedEvent
  | CallEndedEvent
  | OfferEvent
  | AnswerEvent
  | IceCandidateEvent
  | ErrorEvent;

// ── Shared types ──

// Re-declare minimal WebRTC types so we don't need DOM lib
export interface RTCSessionDescriptionInit {
  type: 'offer' | 'answer';
  sdp?: string;
}

export interface RTCIceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}
