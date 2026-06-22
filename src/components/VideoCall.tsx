import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users } from 'lucide-react';

const SOCKET_SERVER_URL = 'http://localhost:5000';

const ICE_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

interface VideoCallProps {
  roomId: string;
  userId: string;
  onEndCall?: () => void;
}

export default function VideoCall({ roomId, userId, onEndCall }: VideoCallProps) {
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [remoteUsers, setRemoteUsers] = useState<{ socketId: string; userId: string | null }[]>([]);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error'>('connecting');

  const socketRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (err) {
        console.error('Could not access camera/microphone:', err);
        setConnectionState('error');
        return;
      }

      const socket = io(SOCKET_SERVER_URL);
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('join-room', { roomId, userId });
        setConnectionState('connected');
      });

      socket.on('room-users', (users: string[]) => {
        setRemoteUsers(users.map((socketId) => ({ socketId, userId: null })));
      });

      socket.on('user-joined', async ({ socketId, userId: remoteUserId }: any) => {
        setRemoteUsers((prev) => [...prev, { socketId, userId: remoteUserId }]);
        await createOffer(socketId);
      });

      socket.on('offer', async ({ from, offer }: any) => {
        await handleOffer(from, offer);
      });

      socket.on('answer', async ({ answer }: any) => {
        const pc = peerConnectionRef.current;
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
      });

      socket.on('ice-candidate', async ({ candidate }: any) => {
        const pc = peerConnectionRef.current;
        if (pc && candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error('Error adding ICE candidate:', err);
          }
        }
      });

      socket.on('user-left', ({ socketId }: any) => {
        setRemoteUsers((prev) => prev.filter((u) => u.socketId !== socketId));
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        peerConnectionRef.current?.close();
        peerConnectionRef.current = null;
      });
    }

    setup();
    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId]);

  function createPeerConnection(remoteSocketId: string) {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('ice-candidate', { to: remoteSocketId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };

    peerConnectionRef.current = pc;
    return pc;
  }

  async function createOffer(remoteSocketId: string) {
    const pc = createPeerConnection(remoteSocketId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current.emit('offer', { to: remoteSocketId, offer });
  }

  async function handleOffer(remoteSocketId: string, offer: RTCSessionDescriptionInit) {
    const pc = createPeerConnection(remoteSocketId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socketRef.current.emit('answer', { to: remoteSocketId, answer });
  }

  function toggleMic() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  }

  function toggleCamera() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCameraOn(track.enabled);
    }
  }

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    peerConnectionRef.current?.close();
    if (socketRef.current) {
      socketRef.current.emit('end-call', { roomId });
      socketRef.current.disconnect();
    }
  }, [roomId]);

  function handleEndCall() {
    cleanup();
    onEndCall?.();
  }

  return (
    <div className="w-full h-full min-h-[600px] bg-neutral-950 rounded-2xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center gap-2 text-neutral-300 text-sm">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connectionState === 'connected' ? 'bg-emerald-500' : connectionState === 'error' ? 'bg-red-500' : 'bg-amber-500'
            }`}
          />
          <span>
            {connectionState === 'connected' && 'Connected'}
            {connectionState === 'connecting' && 'Connecting…'}
            {connectionState === 'error' && 'Camera/mic access denied'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-neutral-400 text-sm">
          <Users size={14} />
          <span>{remoteUsers.length + 1} in room</span>
        </div>
      </div>

      <div className="relative flex-1 bg-black">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        {remoteUsers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-500 text-sm">
            Waiting for the other participant to join…
          </div>
        )}

        <div className="absolute bottom-4 right-4 w-40 h-28 sm:w-48 sm:h-32 rounded-xl overflow-hidden border-2 border-neutral-800 bg-neutral-900 shadow-lg">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          {!cameraOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 text-neutral-500 text-xs">
              Camera off
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 py-4 bg-neutral-900 border-t border-neutral-800">
        <button
          onClick={toggleMic}
          className={`p-3 rounded-full transition-colors ${
            micOn ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
          }`}
        >
          {micOn ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        <button
          onClick={toggleCamera}
          className={`p-3 rounded-full transition-colors ${
            cameraOn ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
          }`}
        >
          {cameraOn ? <Video size={20} /> : <VideoOff size={20} />}
        </button>

        <button
          onClick={handleEndCall}
          className="p-3 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
}