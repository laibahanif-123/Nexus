import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import VideoCall from '../components/VideoCall';

export default function VideoCallPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth(); // agar AuthContext mein hook/field naam alag hai to yahan adjust karna

  const userId = (user as any)?._id || (user as any)?.id || 'guest-' + Date.now();

  function handleEndCall() {
    navigate('/dashboard/entrepreneur'); // call khatam hone ke baad jahan le jana chahte hain
  }

  if (!roomId) {
    return <div className="p-6 text-center text-neutral-500">Invalid call link.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <VideoCall roomId={roomId} userId={userId} onEndCall={handleEndCall} />
    </div>
  );
}