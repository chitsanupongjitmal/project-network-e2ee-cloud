
import React from 'react';
import Avatar from '../Common/Avatar';

const CallModal = ({
    call,
    callAccepted,
    remoteStream,
    answerCall,
    endCall,
    callDuration,
    isMuted,
    toggleMute,
    isRemoteMuted
}) => {
    if (!call) return null;

    const remoteAudioRef = React.useRef();
    const remoteDisplayName = call.isReceivingCall
        ? call.remoteUsername || call.callerUsername
        : call.remoteUsername || call.calleeUsername || call.callerUsername;
    const remoteAvatarUrl = call.isReceivingCall
        ? call.remoteAvatarUrl ?? call.callerAvatarUrl ?? null
        : call.remoteAvatarUrl ?? call.calleeAvatarUrl ?? call.callerAvatarUrl ?? null;
    const remoteUser = {
        username: remoteDisplayName || 'Unknown caller',
        avatar_url: remoteAvatarUrl || undefined
    };

    React.useEffect(() => {
        if (!remoteAudioRef.current) return;
        if (remoteStream) {
            if (remoteAudioRef.current.srcObject !== remoteStream) {
                remoteAudioRef.current.srcObject = remoteStream;
            }
            // iOS/Safari may require an explicit play() after srcObject is set.
            const tryPlay = () => {
                remoteAudioRef.current?.play?.().catch(() => {
                    // Keep silent; user gesture during call accept usually unlocks audio.
                });
            };
            tryPlay();
            remoteAudioRef.current.onloadedmetadata = tryPlay;
        } else {
            remoteAudioRef.current.srcObject = null;
        }
        return () => {
            if (remoteAudioRef.current) {
                remoteAudioRef.current.onloadedmetadata = null;
            }
        };
    }, [remoteStream]);

    const formatTime = (timeInSeconds) => {
        const minutes = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
        const seconds = (timeInSeconds % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    };

    const statusLabel = callAccepted
        ? formatTime(callDuration)
        : call.isReceivingCall
            ? 'Incoming audio call...'
            : 'Calling...';

    return (
        <div className="fixed inset-0 bg-black/90 flex justify-center items-center z-50 text-white px-4">
            <audio ref={remoteAudioRef} autoPlay playsInline />
            <div className="w-full max-w-md flex flex-col items-center gap-6 rounded-2xl bg-gray-900/80 border border-gray-700 p-8 shadow-2xl text-center">
                <Avatar user={remoteUser} size="w-32 h-32" />
                <div>
                    <h2 className="text-3xl font-bold">{remoteUser.username}</h2>
                    <p className="text-gray-300 mt-2 text-lg">{statusLabel}</p>
                    {callAccepted && (
                        <div className={`mt-3 flex items-center justify-center gap-2 text-sm ${isRemoteMuted ? 'text-red-300' : 'text-green-300'}`}>
                            {isRemoteMuted ? <MicOffIcon className="h-5 w-5" /> : <MicOnIcon className="h-5 w-5" />}
                            <span>{isRemoteMuted ? 'Their mic is muted' : 'Their mic is live'}</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center justify-center gap-6 w-full">
                    {call.isReceivingCall && !callAccepted ? (
                        <>
                            <button
                                onClick={() => answerCall(call)}
                                className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-8 rounded-full transition-transform hover:scale-105"
                            >
                                Accept
                            </button>
                            <button
                                onClick={endCall}
                                className="bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-8 rounded-full transition-transform hover:scale-105"
                            >
                                Decline
                            </button>
                        </>
                    ) : (
                        <>
                            {callAccepted && (
                                <div className="flex flex-col items-center gap-2">
                                    <button
                                        onClick={toggleMute}
                                        className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30'}`}
                                    >
                                        {isMuted ? <MicOffIcon /> : <MicOnIcon />}
                                    </button>
                                    <span className={`text-xs ${isMuted ? 'text-red-300' : 'text-green-300'}`}>
                                        {isMuted ? 'Mic off' : 'Mic on'}
                                    </span>
                                </div>
                            )}
                            <button
                                onClick={endCall}
                                className="bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-8 rounded-full transition-transform hover:scale-105"
                            >
                                End Call
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const iconClass = "h-6 w-6";
const MicOnIcon = ({ className = iconClass } = {}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
);
const MicOffIcon = ({ className = iconClass } = {}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3zM5 5l14 14" />
    </svg>
);

export default React.memo(CallModal);
