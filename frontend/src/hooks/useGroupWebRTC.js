
import { useState, useEffect, useRef, useCallback } from 'react';

const AUDIO_ONLY_CONSTRAINTS = { audio: true, video: false };
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const useGroupWebRTC = (socket, currentUser, groupId) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isCallActive, setIsCallActive] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [callParticipants, setCallParticipants] = useState([]);
  const [participantMuteMap, setParticipantMuteMap] = useState({});

  const peerConnections = useRef({});
  const localStreamRef = useRef(null);
  const isCallActiveRef = useRef(false);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);

  const cleanupConnections = useCallback(() => {
    Object.values(peerConnections.current).forEach((pc) => pc.close());
    peerConnections.current = {};

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    setLocalStream(null);
    localStreamRef.current = null;
    setRemoteStreams({});
    setIsCallActive(false);
    setIsMuted(false);
    setIsCallInProgress(false);
    setIncomingCall(null);
    setCallParticipants([]);
    setParticipantMuteMap({});
  }, []);

  const initializeStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(AUDIO_ONLY_CONSTRAINTS);
      setLocalStream(stream);
      localStreamRef.current = stream;
      const audioTrack = stream.getAudioTracks()[0];
      setIsMuted(!audioTrack?.enabled);
      return stream;
    } catch (error) {
      console.error('Could not access microphone for group call.', error);
      alert('Microphone access is required for group calls.');
      return null;
    }
  }, []);

  const createPeerConnection = useCallback(
    (peerId, streamToAttach) => {
      if (!socket || !currentUser?.id) return null;

      if (peerConnections.current[peerId]) {
        peerConnections.current[peerId].close();
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      if (streamToAttach) {
        streamToAttach.getAudioTracks().forEach((track) => pc.addTrack(track, streamToAttach));
      }

      pc.ontrack = (event) => {
        const incomingStream = event.streams[0];
        if (!incomingStream) return;
        setRemoteStreams((prev) => ({ ...prev, [peerId]: incomingStream }));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('relay-group-signal', {
            to: peerId,
            from: currentUser.id,
            signal: { candidate: event.candidate },
          });
        }
      };

      peerConnections.current[peerId] = pc;
      return pc;
    },
    [socket, currentUser?.id]
  );

  const startCall = useCallback(async () => {
    const stream = await initializeStream();
    const userId = currentUser?.id;
    let initialMuted = true;
    if (stream && stream.getAudioTracks) {
      const audioTrack = stream.getAudioTracks()[0];
      initialMuted = audioTrack ? !audioTrack.enabled : true;
    }

    if (userId) {
      setParticipantMuteMap((prev) => ({
        ...prev,
        [String(userId)]: initialMuted,
      }));
      socket?.emit('toggle-group-audio', {
        groupId,
        isMuted: initialMuted,
      });
    }

    setIsCallActive(true);
    setIsCallInProgress(true);
    setIncomingCall(null);

    socket?.emit('start-group-call', {
      groupId,
      callType: 'audio',
      listenOnly: !stream,
    });
  }, [initializeStream, socket, groupId, currentUser?.id]);

  const joinCall = useCallback(async () => {
    const stream = await initializeStream();
    const userId = currentUser?.id;
    let initialMuted = true;
    if (stream && stream.getAudioTracks) {
      const audioTrack = stream.getAudioTracks()[0];
      initialMuted = audioTrack ? !audioTrack.enabled : true;
    }

    if (userId) {
      setParticipantMuteMap((prev) => ({
        ...prev,
        [String(userId)]: initialMuted,
      }));
      socket?.emit('toggle-group-audio', {
        groupId,
        isMuted: initialMuted,
      });
    }

    setIsCallActive(true);
    setIncomingCall(null);

    socket?.emit('join-group-call', {
      groupId,
      listenOnly: !stream,
    });
  }, [initializeStream, socket, groupId, currentUser?.id]);

  const leaveCall = useCallback(() => {
    socket?.emit('leave-group-call', { groupId });
    cleanupConnections();
  }, [socket, groupId, cleanupConnections, currentUser?.id, isMuted]);

  const toggleMute = useCallback(() => {
    if (!currentUser?.id) return;

    const stream = localStreamRef.current;
    if (!stream) return;

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;
    const nextMuted = !audioTrack.enabled;
    setIsMuted(nextMuted);
    setParticipantMuteMap((prev) => ({
      ...prev,
      [String(currentUser.id)]: nextMuted,
    }));
    socket?.emit('toggle-group-audio', {
      groupId,
      isMuted: nextMuted,
    });
  }, [socket, groupId, currentUser?.id]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleIncomingCall = (callData) => {
      if (String(callData.groupId) !== String(groupId)) return;
      setIsCallInProgress(true);
      if (!isCallActiveRef.current) {
        setIncomingCall(callData);
      }
    };

    const handleOngoingCall = (callData) => {
      if (String(callData.groupId) !== String(groupId)) return;
      setIsCallInProgress(true);
    };

    const handleGroupCallEnded = ({ groupId: endedGroupId }) => {
      if (String(endedGroupId) !== String(groupId)) return;
      setIsCallInProgress(false);
      setCallParticipants([]);
      setParticipantMuteMap({});
      cleanupConnections();
    };

    const handleParticipantsUpdate = ({ participants }) => {
      setCallParticipants(participants);
      if (participants?.length > 0) {
        setIsCallInProgress(true);
      } else if (!isCallActiveRef.current) {
        setIsCallInProgress(false);
      }
      setParticipantMuteMap((prev) => {
        const next = {};
        const activeIds = new Set((participants || []).map((participant) => String(participant.id)));
        activeIds.forEach((id) => {
          if (Object.prototype.hasOwnProperty.call(prev, id)) {
            next[id] = prev[id];
          }
        });
        if (currentUser?.id) {
          const localKey = String(currentUser.id);
          if (!Object.prototype.hasOwnProperty.call(next, localKey)) {
            next[localKey] = Object.prototype.hasOwnProperty.call(prev, localKey) ? prev[localKey] : isMuted;
          }
        }
        return next;
      });
    };

    socket.on('incoming-group-call', handleIncomingCall);
    socket.on('ongoing-call-in-group', handleOngoingCall);
    socket.on('group-call-ended', handleGroupCallEnded);
    socket.on('group-call-participants', handleParticipantsUpdate);

    return () => {
      socket.off('incoming-group-call', handleIncomingCall);
      socket.off('ongoing-call-in-group', handleOngoingCall);
      socket.off('group-call-ended', handleGroupCallEnded);
      socket.off('group-call-participants', handleParticipantsUpdate);
    };
  }, [socket, groupId, cleanupConnections]);

  useEffect(() => {
    if (!socket || !isCallActive) return undefined;

    const handleMemberJoined = async ({ newMember }) => {
      if (newMember.id === currentUser.id) return;

      const pc = createPeerConnection(newMember.id, localStreamRef.current);
      if (!pc) return;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('relay-group-signal', {
        to: newMember.id,
        from: currentUser.id,
        signal: { offer },
      });
    };

    const handleSignalRelayed = async ({ from, signal }) => {
      let pc = peerConnections.current[from];
      if (!pc) {
        pc = createPeerConnection(from, localStreamRef.current);
        if (!pc) return;
      }

      if (signal.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('relay-group-signal', {
          to: from,
          from: currentUser.id,
          signal: { answer },
        });
      } else if (signal.answer) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
      } else if (signal.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (error) {
          console.error('Failed to add ICE candidate in group call.', error);
        }
      }
    };

    const handleMemberLeft = ({ userId }) => {
      const pc = peerConnections.current[userId];
      if (pc) {
        pc.close();
        delete peerConnections.current[userId];
      }
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setParticipantMuteMap((prev) => {
        const next = { ...prev };
        delete next[String(userId)];
        return next;
      });
    };

    const handleMemberAudioToggled = ({ userId, isMuted }) => {
      if (userId === undefined || userId === null) return;
      const key = String(userId);
      setParticipantMuteMap((prev) => ({
        ...prev,
        [key]: !!isMuted,
      }));
      if (currentUser?.id && String(currentUser.id) === key) {
        setIsMuted(!!isMuted);
      }
    };

    socket.on('member-joined-call', handleMemberJoined);
    socket.on('group-signal-relayed', handleSignalRelayed);
    socket.on('member-left-call', handleMemberLeft);
    socket.on('member-audio-toggled', handleMemberAudioToggled);

    return () => {
      socket.off('member-joined-call', handleMemberJoined);
      socket.off('group-signal-relayed', handleSignalRelayed);
      socket.off('member-left-call', handleMemberLeft);
      socket.off('member-audio-toggled', handleMemberAudioToggled);
    };
  }, [socket, isCallActive, currentUser?.id, createPeerConnection]);

  useEffect(() => () => {
    if (socket && isCallActiveRef.current) {
      socket.emit('leave-group-call', { groupId });
    }
    cleanupConnections();
  }, [socket, groupId, cleanupConnections]);

  return {
    localStream,
    remoteStreams,
    isCallActive,
    incomingCall,
    isMuted,
    startCall,
    joinCall,
    leaveCall,
    setIncomingCall,
    toggleMute,
    isCallInProgress,
    callParticipants,
    participantMuteMap,
  };
};

export default useGroupWebRTC;
