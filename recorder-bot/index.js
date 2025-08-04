const JitsiMeetJS = require('lib-jitsi-meet');
const { RTCAudioSink } = require('wrtc').nonstandard;
const fs = require('fs');
const path = require('path');
const wav = require('wav');

// Environment variables
const roomName = process.env.JITSI_ROOM;
const xmppDomain = process.env.JITSI_DOMAIN;
const recorderDomain = process.env.JITSI_RECORDER_DOMAIN || `recorder.${xmppDomain}`;
const xmppUrl = process.env.JITSI_SERVICE_URL || `wss://${xmppDomain}/xmpp-websocket`;
const recorderJid = process.env.XMPP_RECORDER_JID;
const recorderPassword = process.env.XMPP_RECORDER_PASSWORD;

if (!roomName || !xmppDomain || !recorderJid || !recorderPassword) {
  console.error('Missing required environment variables.');
  process.exit(1);
}

// Initialize lib-jitsi-meet
JitsiMeetJS.init();

const options = {
  hosts: {
    domain: xmppDomain,
    muc: `conference.${xmppDomain}`,
    anonymousdomain: recorderDomain
  },
  serviceUrl: xmppUrl,
  clientNode: 'http://jitsi.org/jitsimeet'
};

const connection = new JitsiMeetJS.JitsiConnection(null, null, options);

const remoteTracks = {};
let conference;

function onTrack(track) {
  if (track.isLocal() || track.getType() !== 'audio') {
    return;
  }

  const participant = track.getParticipantId();
  const user = conference.getParticipantById(participant);
  const display = user && user.getDisplayName ? user.getDisplayName() : participant;

  const dir = path.join('recordings', roomName);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${display}.wav`);

  const writer = new wav.FileWriter(filePath, {
    sampleRate: 48000,
    channels: 1
  });

  const [audioTrack] = track.getOriginalStream().getAudioTracks();
  const sink = new RTCAudioSink(audioTrack);
  sink.ondata = data => {
    writer.write(Buffer.from(data.samples.buffer));
  };

  remoteTracks[participant] = { sink, writer };
}

function onTrackRemoved(track) {
  if (track.isLocal() || track.getType() !== 'audio') {
    return;
  }

  const participant = track.getParticipantId();
  const record = remoteTracks[participant];
  if (record) {
    record.sink.stop();
    record.writer.end();
    delete remoteTracks[participant];
  }
}

function onConnectionSuccess() {
  conference = connection.initJitsiConference(roomName, {
    openBridgeChannel: true,
    iAmRecorder: true
  });

  conference.on(JitsiMeetJS.events.conference.TRACK_ADDED, onTrack);
  conference.on(JitsiMeetJS.events.conference.TRACK_REMOVED, onTrackRemoved);
  conference.join();
}

function onConnectionFailed(error) {
  console.error('Connection Failed', error);
}

function disconnect() {
  connection.disconnect();
}

connection.addEventListener(JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED, onConnectionSuccess);
connection.addEventListener(JitsiMeetJS.events.connection.CONNECTION_FAILED, onConnectionFailed);
connection.addEventListener(JitsiMeetJS.events.connection.CONNECTION_DISCONNECTED, disconnect);

connection.connect({ id: recorderJid, password: recorderPassword });

process.on('SIGINT', () => {
  console.log('Shutting down');
  Object.values(remoteTracks).forEach(({ sink, writer }) => {
    sink.stop();
    writer.end();
  });
  if (conference) {
    conference.leave();
  }
  disconnect();
  process.exit(0);
});
