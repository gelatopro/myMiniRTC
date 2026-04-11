import { useRef, useState, useCallback, useEffect } from 'react';
import type { ClientMessage, ServerMessage } from '../types';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export type CallStatus =
  | 'idle'
  | 'requesting-media'
  | 'connecting'
  | 'connected'
  | 'failed';

export interface UseWebRTCOptions {
  send: (message: ClientMessage) => void;
}

export function useWebRTC({ send }: UseWebRTCOptions) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const createPeerConnection = useCallback(() => {
    // Close existing connection if any
    if (pcRef.current) {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    console.log('[WebRTC] PeerConnection created');

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] Sending ICE candidate');
        send({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote track received');
      setRemoteStream(event.streams[0]);
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      switch (pc.connectionState) {
        case 'connected':
          setCallStatus('connected');
          break;
        case 'failed':
          setCallStatus('failed');
          break;
        case 'disconnected':
        case 'closed':
          setCallStatus('idle');
          setRemoteStream(null);
          break;
      }
    };

    pcRef.current = pc;
    return pc;
  }, [send]);

  const getMedia = useCallback(async () => {
    setCallStatus('requesting-media');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      // Fallback: try audio only
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        setLocalStream(stream);
        return stream;
      } catch {
        setCallStatus('failed');
        throw err;
      }
    }
  }, []);

  // Caller: create offer and send it
  const startCall = useCallback(async () => {
    try {
      console.log('[WebRTC] startCall: requesting media...');
      const stream = await getMedia();
      console.log('[WebRTC] startCall: got media, tracks:', stream.getTracks().map(t => t.kind));
      const pc = createPeerConnection();
      setCallStatus('connecting');

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      console.log('[WebRTC] startCall: tracks added, creating offer...');

      const offer = await pc.createOffer();
      // Use explicit offer — parameterless setLocalDescription waits
      // for ICE gathering which can stall on localhost
      pc.setLocalDescription(offer);
      console.log('[WebRTC] Sending offer');
      send({ type: 'offer', sdp: { type: 'offer', sdp: offer.sdp } });
    } catch (err) {
      console.error('[WebRTC] startCall failed:', err);
      setCallStatus('failed');
    }
  }, [getMedia, createPeerConnection, send]);

  // Callee: handle incoming offer
  const handleOffer = useCallback(
    async (sdp: RTCSessionDescriptionInit) => {
      try {
        console.log('[WebRTC] Received offer, requesting media...');
        const stream = await getMedia();
        console.log('[WebRTC] handleOffer: got media');
        const pc = createPeerConnection();
        setCallStatus('connecting');

        console.log('[WebRTC] handleOffer: setting remote description...');
        await pc.setRemoteDescription(sdp);
        console.log('[WebRTC] handleOffer: remote description set, signalingState:', pc.signalingState);

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        console.log('[WebRTC] handleOffer: tracks added, creating answer...');

        const answer = await pc.createAnswer();
        console.log('[WebRTC] handleOffer: answer created');
        pc.setLocalDescription(answer);

        // Apply any ICE candidates that arrived before we had a PC
        for (const candidate of pendingCandidates.current) {
          pc.addIceCandidate(candidate).catch(() => {});
        }
        pendingCandidates.current = [];

        console.log('[WebRTC] Sending answer');
        send({ type: 'answer', sdp: { type: 'answer', sdp: answer.sdp } });
      } catch (err) {
        console.error('[WebRTC] handleOffer failed:', err);
        setCallStatus('failed');
      }
    },
    [getMedia, createPeerConnection, send],
  );

  // Caller: handle answer to our offer
  const handleAnswer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    try {
      const pc = pcRef.current;
      if (!pc) {
        console.warn('[WebRTC] Received answer but no PeerConnection');
        return;
      }
      console.log('[WebRTC] Received answer');
      await pc.setRemoteDescription(sdp);

      // Apply any ICE candidates that arrived before the answer
      for (const candidate of pendingCandidates.current) {
        pc.addIceCandidate(candidate).catch(() => {});
      }
      pendingCandidates.current = [];
    } catch (err) {
      console.error('[WebRTC] handleAnswer failed:', err);
    }
  }, []);

  // Both: handle incoming ICE candidate
  const handleIceCandidate = useCallback(
    async (candidate: RTCIceCandidateInit) => {
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) {
        console.log('[WebRTC] Queuing early ICE candidate');
        pendingCandidates.current.push(candidate);
        return;
      }
      pc.addIceCandidate(candidate).catch((err) => {
        console.error('[WebRTC] addIceCandidate failed:', err);
      });
    },
    [],
  );

  // Handle all signaling messages related to WebRTC
  const handleSignalingMessage = useCallback(
    (message: ServerMessage) => {
      switch (message.type) {
        case 'offer':
          handleOffer(message.sdp);
          break;
        case 'answer':
          handleAnswer(message.sdp);
          break;
        case 'ice-candidate':
          handleIceCandidate(message.candidate);
          break;
      }
    },
    [handleOffer, handleAnswer, handleIceCandidate],
  );

  const toggleMute = useCallback(() => {
    if (!localStream) return;
    const audioTracks = localStream.getAudioTracks();
    audioTracks.forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsMuted((prev) => !prev);
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (!localStream) return;
    const videoTracks = localStream.getVideoTracks();
    videoTracks.forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsVideoOff((prev) => !prev);
  }, [localStream]);

  const hangUp = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    pendingCandidates.current = [];
    localStream?.getTracks().forEach((track) => track.stop());
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus('idle');
    setIsMuted(false);
    setIsVideoOff(false);
  }, [localStream]);

  // Cleanup on unmount only — don't re-run on localStream changes,
  // as that would close an active PeerConnection mid-negotiation.
  // hangUp() handles explicit cleanup.
  useEffect(() => {
    return () => {
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, []);

  return {
    localStream,
    remoteStream,
    callStatus,
    isMuted,
    isVideoOff,
    startCall,
    hangUp,
    toggleMute,
    toggleVideo,
    handleSignalingMessage,
  };
}
