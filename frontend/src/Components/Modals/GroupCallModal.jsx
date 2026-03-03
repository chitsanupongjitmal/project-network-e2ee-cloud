
import React from 'react';
import Avatar from '../Common/Avatar';

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

const ParticipantTile = ({ user, stream, isLocal, isMuted }) => {
    const audioRef = React.useRef(null);

    React.useEffect(() => {
        if (!audioRef.current) return;
        if (stream) {
            audioRef.current.srcObject = stream;
        } else {
            audioRef.current.srcObject = null;
        }
    }, [stream]);

    const displayName =
        user?.display_name ||
        user?.nickname ||
        user?.username ||
        user?.name ||
        (isLocal ? 'You' : 'Participant');

    const roleLabel = user?.role && user.role !== 'user'
        ? user.role.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
        : null;

    return (
        <div className="bg-gray-700 rounded-xl px-4 py-3 flex items-center gap-4 shadow-sm">
            <audio ref={audioRef} autoPlay playsInline muted={isLocal} className="hidden" />
            <Avatar user={user} size="w-14 h-14" />
            <div className="flex-1">
                <p className="text-base font-semibold">{displayName}</p>
                <p className="text-xs text-gray-300">{isLocal ? 'You are connected' : 'Connected'}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
                <div className={`flex items-center gap-2 text-sm ${isMuted ? 'text-red-300' : 'text-green-300'}`}>
                    {isMuted ? <MicOffIcon className="h-5 w-5" /> : <MicOnIcon className="h-5 w-5" />}
                    <span>{isMuted ? 'Mic off' : 'Mic on'}</span>
                </div>
                {roleLabel && (
                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-[11px] uppercase tracking-wide">
                        {roleLabel}
                    </span>
                )}
            </div>
        </div>
    );
};

const GroupCallModal = ({
    localStream,
    remoteStreams,
    onLeaveCall,
    groupName,
    currentUser,
    isMuted,
    toggleMute,
    callParticipants,
    participantMuteMap
}) => {
    const localMuteState = !!isMuted;
    const participantsForDisplay = React.useMemo(() => {
        const items = [];
        const added = new Set();
        const remoteMap = remoteStreams || {};

        (callParticipants || []).forEach(participant => {
            const key = String(participant.id);
            const isLocal = key === String(currentUser.id);
            const stream = isLocal ? localStream : remoteMap[key] ?? remoteMap[participant.id] ?? null;
            const participantMuted = participantMuteMap?.[key];

            items.push({
                id: key,
                user: {
                    ...participant,
                    role: participant.role || (isLocal ? currentUser.role || 'user' : 'user'),
                    username: participant.username || participant.display_name || participant.nickname || `Member ${key}`
                },
                stream,
                isLocal,
                isMuted: participantMuted !== undefined ? participantMuted : (isLocal ? localMuteState : false)
            });
            added.add(key);
        });

        Object.entries(remoteMap).forEach(([rawId, stream]) => {
            const key = String(rawId);
            if (added.has(key)) return;
            const isLocal = key === String(currentUser.id);
            const participantMuted = participantMuteMap?.[key];
            items.push({
                id: key,
                user: isLocal
                    ? {
                        id: currentUser.id,
                        username: currentUser.username || 'You',
                        role: currentUser.role || 'user'
                    }
                    : {
                        id: rawId,
                        username: `Member ${rawId}`,
                        role: 'user'
                    },
                stream: isLocal ? localStream : stream,
                isLocal,
                isMuted: participantMuted !== undefined ? participantMuted : (isLocal ? localMuteState : false)
            });
            added.add(key);
        });

        if (!added.has(String(currentUser.id)) && localStream) {
            items.push({
                id: String(currentUser.id),
                user: {
                    id: currentUser.id,
                    username: currentUser.username || 'You',
                    role: currentUser.role || 'user'
                },
                stream: localStream,
                isLocal: true,
                isMuted: participantMuteMap?.[String(currentUser.id)] ?? localMuteState
            });
        }

        return items;
    }, [callParticipants, currentUser, localStream, remoteStreams, participantMuteMap, localMuteState]);

    return (
        <div className="fixed inset-0 bg-gray-900/95 flex flex-col z-50 text-white font-sans">
            <header className="p-5 flex justify-between items-center bg-gray-900/70 flex-shrink-0">
                <div>
                    <h2 className="text-xl font-bold">{groupName}</h2>
                    <p className="text-sm text-gray-300">{participantsForDisplay.length} participant(s)</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center gap-2">
                        <button
                            onClick={toggleMute}
                            className={`p-3 rounded-full transition-colors ${localMuteState ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 hover:bg-white/20'}`}
                            title={localMuteState ? 'Unmute microphone' : 'Mute microphone'}
                        >
                            {localMuteState ? <MicOffIcon /> : <MicOnIcon />}
                        </button>
                        <span className={`text-xs ${localMuteState ? 'text-red-300' : 'text-green-300'}`}>
                            {localMuteState ? 'Mic off' : 'Mic on'}
                        </span>
                    </div>
                    <button
                        onClick={onLeaveCall}
                        className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-5 rounded-full transition-transform hover:scale-105"
                    >
                        End Call
                    </button>
                </div>
            </header>

    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
                {participantsForDisplay.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300">
                        <p className="text-lg font-semibold">Waiting for others to join…</p>
                        <p className="text-sm text-gray-400 mt-2">Stay connected to keep the call active.</p>
                    </div>
                ) : (
                    participantsForDisplay.map(participant => (
                        <ParticipantTile
                            key={participant.id}
                            user={participant.user}
                            stream={participant.stream}
                            isLocal={participant.isLocal}
                            isMuted={participant.isMuted}
                        />
                    ))
                )}
            </main>
        </div>
    );
};

export default GroupCallModal;

