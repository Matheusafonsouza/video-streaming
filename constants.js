export const firebaseConfig = {
  apiKey: "AIzaSyBRthMkNLV_w5l2gnSCJduZSZC3Nzy76RU",
  authDomain: "frc-meet.firebaseapp.com",
  projectId: "frc-meet",
  storageBucket: "frc-meet.appspot.com",
  messagingSenderId: "72532417337",
  appId: "1:72532417337:web:e2636c11993418ea64a6e8",
  measurementId: "G-4SP64TZVWD"
};

export const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};
