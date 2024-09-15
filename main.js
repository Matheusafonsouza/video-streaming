import './style.css';

import firebase from 'firebase/app';
import 'firebase/firestore';

import {
  firebaseConfig,
  servers,
} from './constants';

// instância do firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();

// instância da comunicação RTC e variáveis globais
const pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;
let videoEnabled = true;
let audioEnabled = true;

// todos os compontentes utilizados do HTML
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

// responsável por iniciar a camera junto com o audio e video (que é configurado pelos botões)
// além disso, também já instancia o envio dos tracks para a comunicação RTC
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

// responsável por recuperar uma chamada dado um id
const getOrCreateCall = (id) => firestore.collection('calls').doc(id);

// responsável por adicionar uma mensagem ao firebase e limpar o input de chat
chatInputButton.onclick = async () => {
  const callDoc = getOrCreateCall(callInput.value);
  callDoc.collection('chat').add({ message: chatInput.value });
  chatInput.value = '';
}

callButton.onclick = async () => {
  const callDoc = getOrCreateCall();

  callInput.value = callDoc.id;

  // essa parte do código instancia o callback necessário para registrar os candidatos offer
  // dentro do firebase
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

  // essa parte do código instancia a remote description para a sessão RTC
  callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  });

  // essa parte do código recupera os answerCandidates para uma chamada
  callDoc.collection('answerCandidates').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      }
    });
  });

  // essa parte do código recupera as mensagens do chat para uma chamada específica
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

  // essa parte do código instancia o callback necessário para registrar os candidatos answer
  // dentro do firebase
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

  // essa parte do código recupera os offerCandidates para uma chamada
  callDoc.collection('offerCandidates').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      }
    });
  });

  // essa parte do código recupera as mensagens do chat para uma chamada específica
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

// responsável pelo botão de desligar o vídeo
videoButton.onclick = async () => {
  videoEnabled = !videoEnabled;
  const videoStream = localStream.getVideoTracks()[0];
  videoStream.enabled = videoEnabled;
}

// responsável pelo botão de desligar o audio
micButton.onclick = async () => {
  audioEnabled = !audioEnabled;
  const audioStream = localStream.getAudioTracks()[0];
  audioStream.enabled = audioEnabled;
}

startWebcam();
