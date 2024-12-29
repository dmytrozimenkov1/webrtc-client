// src/App.js
import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const SOCKET_SERVER_URL = 'http://80.108.95.253:8084'; // Замените на ваш URL сервера

const App = () => {
  const [roomID, setRoomID] = useState('');
  const [isRoomCreated, setIsRoomCreated] = useState(false);
  const [isRoomJoined, setIsRoomJoined] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef();
  const peerConnectionRef = useRef();
  const localStreamRef = useRef();

  const ICE_SERVERS = {
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302'
      },
      // Вы можете добавить TURN серверы здесь
    ]
  };

  const createRoom = () => {
    const newRoomID = Math.random().toString(36).substring(2, 10);
    setRoomID(newRoomID);
    setIsRoomCreated(true);
  };

  const joinRoom = () => {
    if (roomID.trim() === '') return;
    setIsRoomJoined(true);
  };

  useEffect(() => {
    socketRef.current = io(SOCKET_SERVER_URL);

    // Получение локального медиа-потока
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localVideoRef.current.srcObject = stream;
        localStreamRef.current = stream;
      })
      .catch((error) => {
        console.error('Error accessing media devices.', error);
      });

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    if (isRoomCreated) {
      socketRef.current.emit('join-room', roomID);

      socketRef.current.on('user-connected', (userID) => {
        console.log('User connected:', userID);
        initiateCall(userID);
      });

      socketRef.current.on('offer', handleReceiveOffer);
      socketRef.current.on('answer', handleReceiveAnswer);
      socketRef.current.on('ice-candidate', handleNewICECandidateMsg);
      socketRef.current.on('user-disconnected', handleUserDisconnected);
    }

    if (isRoomJoined) {
      socketRef.current.emit('join-room', roomID);

      socketRef.current.on('offer', handleReceiveOffer);
      socketRef.current.on('answer', handleReceiveAnswer);
      socketRef.current.on('ice-candidate', handleNewICECandidateMsg);
      socketRef.current.on('user-connected', initiateCall);
      socketRef.current.on('user-disconnected', handleUserDisconnected);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRoomCreated, isRoomJoined]);

  const initiateCall = (userID) => {
    peerConnectionRef.current = new RTCPeerConnection(ICE_SERVERS);
    localStreamRef.current.getTracks().forEach((track) => {
      peerConnectionRef.current.addTrack(track, localStreamRef.current);
    });

    peerConnectionRef.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('ice-candidate', event.candidate);
      }
    };

    // Создание offer
    peerConnectionRef.current
      .createOffer()
      .then((offer) => {
        peerConnectionRef.current.setLocalDescription(offer);
        socketRef.current.emit('offer', offer);
      })
      .catch((error) => {
        console.error('Error creating offer:', error);
      });
  };

  const handleReceiveOffer = (offer) => {
    peerConnectionRef.current = new RTCPeerConnection(ICE_SERVERS);
    localStreamRef.current.getTracks().forEach((track) => {
      peerConnectionRef.current.addTrack(track, localStreamRef.current);
    });

    peerConnectionRef.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('ice-candidate', event.candidate);
      }
    };

    peerConnectionRef.current
      .setRemoteDescription(new RTCSessionDescription(offer))
      .then(() => {
        return peerConnectionRef.current.createAnswer();
      })
      .then((answer) => {
        peerConnectionRef.current.setLocalDescription(answer);
        socketRef.current.emit('answer', answer);
      })
      .catch((error) => {
        console.error('Error handling offer:', error);
      });
  };

  const handleReceiveAnswer = (answer) => {
    peerConnectionRef.current
      .setRemoteDescription(new RTCSessionDescription(answer))
      .catch((error) => {
        console.error('Error setting remote description:', error);
      });
  };

  const handleNewICECandidateMsg = (candidate) => {
    const newCandidate = new RTCIceCandidate(candidate);
    peerConnectionRef.current
      .addIceCandidate(newCandidate)
      .catch((error) => {
        console.error('Error adding received ice candidate', error);
      });
  };

  const handleUserDisconnected = (userID) => {
    console.log('User disconnected:', userID);
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    remoteVideoRef.current.srcObject = null;
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>WebRTC React App</h1>
      {!isRoomCreated && !isRoomJoined && (
        <div>
          <button onClick={createRoom}>Создать Комнату</button>
          <div style={{ marginTop: '20px' }}>
            <input
              type="text"
              placeholder="Введите ID комнаты"
              value={roomID}
              onChange={(e) => setRoomID(e.target.value)}
            />
            <button onClick={joinRoom}>Присоединиться к Комнате</button>
          </div>
        </div>
      )}

      {(isRoomCreated || isRoomJoined) && (
        <div style={{ marginTop: '20px' }}>
          <p>Комната ID: {roomID}</p>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <div>
              <h3>Локальное Видео</h3>
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '300px', border: '1px solid black' }}
              />
            </div>
            <div>
              <h3>Удаленное Видео</h3>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{ width: '300px', border: '1px solid black' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
