import './style.css';

import firebase from 'firebase/app';
import 'firebase/firestore';

import {
  firebaseConfig,
  servers,
} from './constants';

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();

const pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;
let videoEnabled = true;
let audioEnabled = true;

const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const chatInput = document.getElementById('chatInput');
const chatInputButton = document.getElementById('chatInputButton');
const chatList = document.getElementById('chatList');
const videoButton = document.getElementById('videoButton');
const micButton = document.getElementById('micButton');

const startWebcam = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: videoEnabled, audio: audioEnabled });
  remoteStream = new MediaStream();
  
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });
  
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;
  
  callButton.disabled = false;
  answerButton.disabled = false;
}

const getOrCreateCall = (id) => firestore.collection('calls').doc(id);

chatInputButton.onclick = async () => {
  const callDoc = getOrCreateCall(callInput.value);
  callDoc.collection('chat').add({ message: chatInput.value });
  chatInput.value = '';
}

callButton.onclick = async () => {
  const callDoc = getOrCreateCall();

  callInput.value = callDoc.id;

  pc.onicecandidate = (event) => {
    event.candidate && callDoc.collection('offerCandidates').add(event.candidate.toJSON());
  };

  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  await callDoc.set({ offer });

  callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  });

  callDoc.collection('answerCandidates').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      }
    });
  });

  callDoc.collection('chat').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const data = change.doc.data();
        const chatMessage = document.createElement("li");
        chatMessage.appendChild(document.createTextNode(data.message));
        chatList.appendChild(chatMessage);
      }
    });
  });

  chatInputButton.disabled = false;
};

answerButton.onclick = async () => {
  const callDoc = getOrCreateCall(callInput.value);

  pc.onicecandidate = (event) => {
    event.candidate && callDoc.collection('answerCandidates').add(event.candidate.toJSON());
  };

  await pc.setRemoteDescription(new RTCSessionDescription(
    (await callDoc.get()).data().offer,
  ));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };
  await callDoc.update({ answer });

  callDoc.collection('offerCandidates').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      }
    });
  });

  callDoc.collection('chat').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const data = change.doc.data();
        const chatMessage = document.createElement("li");
        chatMessage.appendChild(document.createTextNode(data.message));
        chatList.appendChild(chatMessage);
      }
    });
  });

  chatInputButton.disabled = false;
};

videoButton.onclick = async () => {
  videoEnabled = !videoEnabled;
  const videoStream = localStream.getVideoTracks()[0];
  videoStream.enabled = videoEnabled;
}

micButton.onclick = async () => {
  audioEnabled = !audioEnabled;
  const audioStream = localStream.getAudioTracks()[0];
  audioStream.enabled = false;
}

startWebcam();
