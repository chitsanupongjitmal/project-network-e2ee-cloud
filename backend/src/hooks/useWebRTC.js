
import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const useWebRTC = (socket, currentUser) => {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [call, setCall] = useState(null);
    const [callAccepted, setCallAccepted] = useState(false);
    const peerConnection = useRef(null);

    const initializePeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        pc.onicecandidate = (event) => {
            if (event.candidate && call?.peerId) {
                socket.emit('ice-candidate', { to: call.peerId, candidate: event.candidate });
            }
        };

        pc.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
        };

        peerConnection.current = pc;
    }, [socket, call?.peerId]);

    useEffect(() => {
        if (!socket) return;

        const handleCallMade = async ({ offer, callerId, callerUsername, callType }) => {
            setCall({ isReceivingCall: true, peerId: callerId, callerUsername, offer, callType });
        };

        const handleAnswerMade = async ({ answer }) => {
            if (peerConnection.current) {
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
            }
        };

        const handleIceCandidate = async ({ candidate }) => {
            if (peerConnection.current && candidate) {
                try {
                    await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                    console.error('Error adding received ice candidate', e);
                }
            }
        };
        
        const handleCallEnded = () => {
            endCall();
        };

        socket.on('call-made', handleCallMade);
        socket.on('answer-made', handleAnswerMade);
        socket.on('ice-candidate', handleIceCandidate);
        socket.on('call-ended', handleCallEnded);

        return () => {
            socket.off('call-made', handleCallMade);
            socket.off('answer-made', handleAnswerMade);
            socket.off('ice-candidate', handleIceCandidate);
            socket.off('call-ended', handleCallEnded);
        };
    }, [socket]);

    const getUserMedia = async (constraints) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setLocalStream(stream);
            return stream;
        } catch (error) {
            console.error('[useWebRTC] Error accessing media devices:', error);
            alert(`Could not access camera/microphone: ${error.message}`);
            return null;
        }
    };

    const callUser = async (peerId, callType) => {



        console.log(`[useWebRTC] Attempting to call user ${peerId} with type: ${callType}`);
        const stream = await getUserMedia({ video: callType === 'video', audio: true });
        if (!stream) {
            console.error("[useWebRTC] Could not start call because stream is not available.");
            return;
        }

        initializePeerConnection();
        stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));
        
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);

        setCall({ peerId, callType, callerUsername: currentUser.username });
        socket.emit('call-user', { to: peerId, offer, callType });
    };

    const answerCall = async () => {
        console.log("[useWebRTC] Answering call...");
        const stream = await getUserMedia({ video: call.callType === 'video', audio: true });
        if (!stream) {
            console.error("[useWebRTC] Could not answer call because stream is not available.");
            return;
        }

        initializePeerConnection();
        stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(call.offer));
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);

        setCallAccepted(true);
        socket.emit('make-answer', { to: call.peerId, answer });
    };

    const endCall = () => {
        console.log("[useWebRTC] Ending call.");
        if (peerConnection.current) {
            peerConnection.current.close();
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (remoteStream) {
            remoteStream.getTracks().forEach(track => track.stop());
        }
        if(call?.peerId) {
             socket.emit('end-call', { to: call.peerId });
        }
        setCall(null);
        setCallAccepted(false);
        setLocalStream(null);
        setRemoteStream(null);
    };

    return {
        localStream,
        remoteStream,
        call,
        callAccepted,
        callUser,
        answerCall,
        endCall,
    };
};

export default useWebRTC;