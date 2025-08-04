# Recorder Bot

This service connects to a Jitsi conference as an invisible recorder and writes
an audio file for every participant. A folder named after the conference room is
created under `recordings/` and each speaker's audio is stored there separately.

The bot authenticates using the `recorder` XMPP domain in the same fashion as
[Jibri](https://github.com/jitsi/jibri), advertising the
`http://jitsi.org/jitmeet/features/recorder` feature so that regular participants
do not see it in the list of attendees or on the main stage.

## Usage

```
JITSI_DOMAIN=meet.example.com \
JITSI_ROOM=test \
XMPP_RECORDER_JID=recorder@recorder.meet.example.com \
XMPP_RECORDER_PASSWORD=pass \
node index.js
```

All recordings will appear in `recordings/<room>/`. The bot only listens and
never publishes its own audio/video tracks.
