import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from './useWebSocket';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  readyState = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
    this.onclose?.();
  });

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  simulateOpen() {
    this.readyState = 1;
    this.onopen?.();
  }

  simulateMessage(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateClose() {
    this.readyState = 3;
    this.onclose?.();
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket);
  (WebSocket as any).OPEN = 1;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useWebSocket', () => {
  it('starts disconnected', () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://test', onMessage }),
    );
    expect(result.current.status).toBe('disconnected');
  });

  it('transitions to connecting then connected', () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://test', onMessage }),
    );

    act(() => result.current.connect());
    expect(result.current.status).toBe('connecting');

    act(() => MockWebSocket.instances[0].simulateOpen());
    expect(result.current.status).toBe('connected');
  });

  it('calls onMessage when receiving data', () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://test', onMessage }),
    );

    act(() => result.current.connect());
    act(() => MockWebSocket.instances[0].simulateOpen());

    const msg = { type: 'joined', roomId: 'r1', userId: 'u1', peers: [] };
    act(() => MockWebSocket.instances[0].simulateMessage(msg));

    expect(onMessage).toHaveBeenCalledWith(msg);
  });

  it('sends messages as JSON', () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://test', onMessage }),
    );

    act(() => result.current.connect());
    act(() => MockWebSocket.instances[0].simulateOpen());

    act(() => result.current.send({ type: 'join', roomId: 'test' }));

    expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'join', roomId: 'test' }),
    );
  });

  it('transitions to disconnected on close', () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://test', onMessage }),
    );

    act(() => result.current.connect());
    act(() => MockWebSocket.instances[0].simulateOpen());
    act(() => MockWebSocket.instances[0].simulateClose());

    expect(result.current.status).toBe('disconnected');
  });
});
