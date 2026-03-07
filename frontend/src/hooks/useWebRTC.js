
import { useState, useEffect, useRef, useCallback } from 'react';

const getIceServers = () => {
    const raw = import.meta.env.VITE_ICE_SERVERS;
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        } catch (error) {
            console.warn('Invalid VITE_ICE_SERVERS, falling back to default STUN servers.');
        }
    }

    return [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ];
};

const useWebRTC = (socket, currentUser) => {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [call, setCall] = useState(null); 
    const [callAccepted, setCallAccepted] = useState(false); 
    
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [hasLocalVideo, setHasLocalVideo] = useState(false);
    const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
    const [isRemoteMuted, setIsRemoteMuted] = useState(false);
    const [canSwitchCamera, setCanSwitchCamera] = useState(false);
    const [currentVideoDeviceId, setCurrentVideoDeviceId] = useState(null);

    const peerConnection = useRef(null);
    const peerIdRef = useRef(null);
    const callTimer = useRef(null);
    const remoteStreamRef = useRef(null);
    const localStreamRef = useRef(null);
    const availableVideoDevicesRef = useRef([]);

    useEffect(() => {
        localStreamRef.current = localStream;
    }, [localStream]);

    const evaluateRemoteVideoStream = useCallback((stream) => {
        remoteStreamRef.current = stream || null;
        if (!stream) {
            setHasRemoteVideo(false);
            return;
        }
        const videoTracks = stream.getVideoTracks();
        if (!videoTracks.length) {
            setHasRemoteVideo(false);
            return;
        }

        if (videoTracks.some(track => track.enabled !== false)) {
            setHasRemoteVideo(true);
        }

        videoTracks.forEach(track => {
            if (track.__handleRemoteEnded) {
                track.removeEventListener('ended', track.__handleRemoteEnded);
            }
            const handleEnded = () => setHasRemoteVideo(false);
            track.__handleRemoteEnded = handleEnded;
            track.addEventListener('ended', handleEnded);
        });
    }, []);


    const cleanup = useCallback(() => {
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        const currentLocalStream = localStreamRef.current;
        if (currentLocalStream) {
            currentLocalStream.getTracks().forEach(track => {
                if (track.__handleLocalEnded) track.removeEventListener('ended', track.__handleLocalEnded);
                if (track.__handleLocalMute) track.removeEventListener('mute', track.__handleLocalMute);
                if (track.__handleLocalUnmute) track.removeEventListener('unmute', track.__handleLocalUnmute);
                delete track.__handleLocalEnded;
                delete track.__handleLocalMute;
                delete track.__handleLocalUnmute;
                delete track.__localHandlersAttached;
                track.stop();
            });
        }
        setLocalStream(null);
        setRemoteStream(null);
        remoteStreamRef.current = null;
        localStreamRef.current = null;
        setHasLocalVideo(false);
        setHasRemoteVideo(false);
        setIsRemoteMuted(false);
        setCanSwitchCamera(false);
        setCurrentVideoDeviceId(null);
        setIsMuted(false);
        peerIdRef.current = null;
        availableVideoDevicesRef.current = [];
        if (callTimer.current) {
            clearInterval(callTimer.current);
            setCallDuration(0);
        }
    }, []);



    const endCall = useCallback(() => {

        const peerId = call?.peerId || call?.callerId;

        if (peerId && socket) {

            socket.emit('end-call', { to: peerId });
        }
        

        cleanup();
        

        setCall(null);
        setCallAccepted(false);
    }, [socket, cleanup, setCall, setCallAccepted, call]);



    useEffect(() => {
        if (!socket) return;
        
        const handleAnswerMade = async ({ answer, hasVideo }) => {
            if (peerConnection.current?.signalingState === 'have-local-offer') {
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
                setCallAccepted(true);
                setHasRemoteVideo(hasVideo);
                setCall(prev => (prev ? { ...prev, remoteHasVideo: hasVideo } : prev));
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
        const handleVideoToggle = ({ hasVideo }) => {
            setHasRemoteVideo(hasVideo);
            setCall(prev => (prev ? { ...prev, remoteHasVideo: hasVideo } : prev));
        };

        const handleAudioToggle = ({ isMuted }) => {
            setIsRemoteMuted(!!isMuted);
        };

        const handleUserBusy = ({ username, userId }) => {
            if (!call || call.isReceivingCall) return;
            const busyMatchesPeer = call.peerId === userId || peerIdRef.current === userId;
            if (!busyMatchesPeer) return;
            cleanup();
            setCall(null);
            setCallAccepted(false);
            alert(`${username || 'The user'} is currently on another call.`);
        };

        const handleCallNotAllowed = ({ message }) => {
            cleanup();
            setCall(null);
            setCallAccepted(false);
            if (message) {
                alert(message);
            } else {
                alert('Unable to start the call. Please try again later.');
            }
        };
        
        const handleGlobalCallEnded = () => {

             cleanup();

             setCall(null);
             setCallAccepted(false);
        };

        socket.on('answer-made', handleAnswerMade);
        socket.on('ice-candidate', handleIceCandidate);
        socket.on('call-ended', handleGlobalCallEnded);
        socket.on('video-toggled', handleVideoToggle);
        socket.on('audio-toggled', handleAudioToggle);
        socket.on('user-busy', handleUserBusy);
        socket.on('call-not-allowed', handleCallNotAllowed);
        
        return () => {
            socket.off('answer-made', handleAnswerMade);
            socket.off('ice-candidate', handleIceCandidate);
            socket.off('call-ended', handleGlobalCallEnded);
            socket.off('video-toggled', handleVideoToggle);
            socket.off('audio-toggled', handleAudioToggle);
            socket.off('user-busy', handleUserBusy);
            socket.off('call-not-allowed', handleCallNotAllowed);
        };
    }, [socket, cleanup, setCall, setCallAccepted, call]);


    useEffect(() => {
        if (callAccepted) {
            callTimer.current = setInterval(() => setCallDuration(prev => prev + 1), 1000);
        }
        return () => clearInterval(callTimer.current);
    }, [callAccepted]);


    const initializeStream = useCallback(async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasMic = devices.some(d => d.kind === 'audioinput');
            if (!hasMic) {
                alert("Microphone not found. A microphone is required to start a call.");
                return null;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            setLocalStream(stream);
            localStreamRef.current = stream;
            availableVideoDevicesRef.current = [];
            setCanSwitchCamera(false);
            setCurrentVideoDeviceId(null);

            const audioTrack = stream.getAudioTracks()[0];
            setIsMuted(!audioTrack?.enabled);
            setHasLocalVideo(false);

            return {
                stream,
                callMode: 'audio',
                hasVideoTrack: false
            };
        } catch (error) {
            alert(`Could not access your microphone: ${error.message}`);
            return null;
        }
    }, []);


    const createPeerConnection = useCallback((stream, currentPeerId) => {
        const iceServers = getIceServers();

        if (peerConnection.current) peerConnection.current.close();
        
        const pc = new RTCPeerConnection({ iceServers });
        if (stream) {
             stream.getTracks().forEach(track => pc.addTrack(track, stream));
        }
       
        pc.onicecandidate = (event) => {
            if (event.candidate && currentPeerId && socket) {
                socket.emit('ice-candidate', { to: currentPeerId, candidate: event.candidate });
            }
        };
        pc.ontrack = (event) => {
            const streamFromEvent = event.streams && event.streams[0];
            let incomingStream = streamFromEvent;

            // Safari can deliver audio tracks with empty event.streams.
            if (!incomingStream && event.track) {
                const existing = remoteStreamRef.current;
                if (existing) {
                    const alreadyHasTrack = existing.getTracks().some(track => track.id === event.track.id);
                    if (!alreadyHasTrack) {
                        existing.addTrack(event.track);
                    }
                    incomingStream = existing;
                } else {
                    incomingStream = new MediaStream([event.track]);
                }
            }

            if (!incomingStream) return;
            setRemoteStream(incomingStream);
            evaluateRemoteVideoStream(incomingStream);
        };
        peerConnection.current = pc;
        return pc;
    }, [socket, evaluateRemoteVideoStream]);


    const callUser = async (toPeerId, _unusedCallType = 'audio', peerMeta = {}) => {
        if (!socket || !currentUser) {
            alert("Cannot start a call right now. Connection is not ready.");
            return;
        }
        const streamData = await initializeStream();
        if (!streamData) return;

        const { stream, callMode } = streamData;
        peerIdRef.current = toPeerId;
        setRemoteStream(null);
        setHasRemoteVideo(false);
        setIsRemoteMuted(false);
        setCallAccepted(false);
        setCall({
            peerId: toPeerId,
            callType: callMode,
            callerId: currentUser.id,
            callerUsername: currentUser.username,
            callerAvatarUrl: currentUser.avatar_url || null,
            remoteUsername: peerMeta.displayName || peerMeta.username || null,
            remoteAvatarUrl: peerMeta.avatarUrl || null,
            isReceivingCall: false,
            localHasVideo: false,
            callerHasVideo: false
        });
        
        const pc = createPeerConnection(stream, toPeerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call-user', { to: toPeerId, offer, callType: callMode, callerHasVideo: false });
    };


    const answerCall = async (incomingCallData) => {
        const callData = incomingCallData || call; 
        
        if (!callData || !callData.offer) { 
            console.error("No offer found in call data.");
            return;
        }
        
        const streamData = await initializeStream();
        if (!streamData) return;

        const { stream } = streamData;
        
        peerIdRef.current = callData.callerId;
        setCall(prev => prev ? { ...prev, callType: 'audio', localHasVideo: false } : prev);
        setHasRemoteVideo(false);
        setIsRemoteMuted(false);
        
        const pc = createPeerConnection(stream, callData.callerId);
        
        await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('make-answer', { to: callData.callerId, answer, hasVideo: false });
        setCallAccepted(true);
    };


    const toggleMute = () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                const nextMuted = !audioTrack.enabled;
                setIsMuted(nextMuted);
                if (socket && peerIdRef.current) {
                    socket.emit('toggle-audio', { to: peerIdRef.current, isMuted: nextMuted });
                }
            }
        }
    };

    const toggleVideo = () => {
        if (!localStream) return;
        const videoTrack = localStream.getVideoTracks()[0];
        if (!videoTrack) return;

        videoTrack.enabled = !videoTrack.enabled;
        const isEnabled = videoTrack.enabled;
        setHasLocalVideo(isEnabled);
        setCall(prev => (prev ? { ...prev, localHasVideo: isEnabled } : prev));

        if (socket && peerIdRef.current) {
            socket.emit('toggle-video', { to: peerIdRef.current, hasVideo: isEnabled });
        }
    };

    const switchCamera = useCallback(async () => {
        let devices = availableVideoDevicesRef.current;
        if (!devices || devices.length < 2) {
            const enumerated = await navigator.mediaDevices.enumerateDevices();
            devices = enumerated.filter(device => device.kind === 'videoinput');
            availableVideoDevicesRef.current = devices;
            setCanSwitchCamera(devices.length > 1);
        }
        if (!devices || devices.length < 2) return;

        const currentId = currentVideoDeviceId;
        const currentIndex = devices.findIndex(device => device.deviceId === currentId);
        const nextDevice = devices[(currentIndex + 1) % devices.length];
        if (!nextDevice || nextDevice.deviceId === currentId) return;

        try {
            const cameraStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    deviceId: { exact: nextDevice.deviceId },
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 24, max: 30 }
                }
            });

            const newVideoTrack = cameraStream.getVideoTracks()[0];
            if (!newVideoTrack) return;

            const existingStream = localStreamRef.current;
            const previousTrack = existingStream?.getVideoTracks()[0];
            const previousEnabled = previousTrack ? previousTrack.enabled : true;

            newVideoTrack.enabled = previousEnabled;
            const audioTracks = existingStream?.getAudioTracks() || [];

            if (peerConnection.current) {
                const sender = peerConnection.current.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(newVideoTrack);
                }
            }

            if (existingStream) {
                existingStream.getVideoTracks().forEach(track => {
                    if (track.__handleLocalEnded) track.removeEventListener('ended', track.__handleLocalEnded);
                    if (track.__handleLocalMute) track.removeEventListener('mute', track.__handleLocalMute);
                    if (track.__handleLocalUnmute) track.removeEventListener('unmute', track.__handleLocalUnmute);
                    delete track.__handleLocalEnded;
                    delete track.__handleLocalMute;
                    delete track.__handleLocalUnmute;
                    delete track.__localHandlersAttached;
                    track.stop();
                });
            }

            const mergedStream = new MediaStream();
            audioTracks.forEach(track => mergedStream.addTrack(track));
            mergedStream.addTrack(newVideoTrack);

            localStreamRef.current = mergedStream;
            setLocalStream(mergedStream);

            const isEnabled = newVideoTrack.enabled;
            setHasLocalVideo(isEnabled);
            setCall(prev => (prev ? { ...prev, localHasVideo: isEnabled } : prev));
            setCurrentVideoDeviceId(nextDevice.deviceId);

            if (!newVideoTrack.__localHandlersAttached) {
                const handleEnded = () => setHasLocalVideo(false);
                const handleMute = () => {
                    if (!newVideoTrack.enabled) setHasLocalVideo(false);
                };
                const handleUnmute = () => {
                    if (newVideoTrack.enabled) setHasLocalVideo(true);
                };
                newVideoTrack.addEventListener('ended', handleEnded);
                newVideoTrack.addEventListener('mute', handleMute);
                newVideoTrack.addEventListener('unmute', handleUnmute);
                newVideoTrack.__localHandlersAttached = true;
                newVideoTrack.__handleLocalEnded = handleEnded;
                newVideoTrack.__handleLocalMute = handleMute;
                newVideoTrack.__handleLocalUnmute = handleUnmute;
            }
        } catch (error) {
            console.error('Failed to switch camera:', error);
        }
    }, [currentVideoDeviceId]);

    useEffect(() => {
        if (call?.isReceivingCall && !callAccepted) {
            if (typeof call.callerHasVideo === 'boolean') {
                setHasRemoteVideo(call.callerHasVideo);
            } else if (call?.callType) {
                setHasRemoteVideo(call.callType === 'video');
            }
        }
    }, [call, callAccepted]);

    useEffect(() => {
        return () => {
            if (peerIdRef.current && socket) {
                socket.emit('end-call', { to: peerIdRef.current });
            }
            cleanup();
        };
    }, [socket, cleanup]);

    return {
        localStream, remoteStream, 
        call, setCall, 
        callAccepted, setCallAccepted, 
        callDuration, 
        hasLocalVideo, hasRemoteVideo, isMuted, isRemoteMuted, toggleMute,
        callUser, answerCall, endCall 
    };
};

export default useWebRTC;
