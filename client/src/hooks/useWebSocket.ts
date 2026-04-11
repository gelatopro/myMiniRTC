import { useRef, useCallback, useEffect, useState } from 'react';
import type { ClientMessage, ServerMessage } from '../types';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface UseWebSocketOptions {
  url: string;
  onMessage: (message: ServerMessage) => void;
}

export function useWebSocket({ url, onMessage }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  // Keep callback ref fresh without re-triggering effect
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const existing = wsRef.current;
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setStatus('connecting');
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;
        onMessageRef.current(message);
      } catch {
        console.error('Failed to parse server message');
      }
    };

    ws.onclose = () => {
      // Only update state if this is still the active WebSocket.
      // Prevents a stale close from an old socket (e.g. React StrictMode
      // double-mount) from nulling out a newer connection.
      if (wsRef.current === ws) {
        setStatus('disconnected');
        wsRef.current = null;
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [url]);

  const disconnect = useCallback(() => {
    const ws = wsRef.current;
    if (ws) {
      wsRef.current = null;
      ws.close();
    }
  }, []);

  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WS] Cannot send, WebSocket not open. Message:', message.type);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const ws = wsRef.current;
      if (ws) {
        wsRef.current = null;
        ws.close();
      }
    };
  }, []);

  return { status, connect, disconnect, send };
}
