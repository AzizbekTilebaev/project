import { io } from 'socket.io-client';
import { getAnonymousId } from './anonymousId';

let socket = null;

export function getGameSocket() {
  if (socket?.connected) return socket;
  if (socket) return socket;

  socket = io({
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 12,
    reconnectionDelay: 800,
    auth: { anonymousId: getAnonymousId() },
  });

  return socket;
}

export function disconnectGameSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/** Keep viewer identity when a broadcast omits youMemberId. */
export function mergeRoomState(prev, next) {
  if (!next) return next;
  if (!prev) return next;
  return {
    ...next,
    youMemberId: next.youMemberId ?? prev.youMemberId ?? null,
  };
}

export function subscribeRoom(code, onState) {
  const s = getGameSocket();
  const upper = String(code).toUpperCase();
  const handler = (room) => {
    if (room?.code && String(room.code).toUpperCase() !== upper) return;
    onState?.(room);
  };
  s.on('room:state', handler);
  s.on('room:closed', handler);

  const doSub = () => {
    s.emit('room:subscribe', { code: upper }, (ack) => {
      if (ack?.ok && ack.room) onState?.(ack.room);
    });
  };

  if (s.connected) doSub();
  else s.once('connect', doSub);

  return () => {
    s.off('room:state', handler);
    s.off('room:closed', handler);
    s.emit('room:unsubscribe', { code: upper });
  };
}
