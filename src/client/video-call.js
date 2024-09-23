import { Call } from "./call";

export class VideoCall extends Call {
  static Event = {
    ...Call.Event,
    IncomingVideo: 'incoming_video',
    OutgoingVideo: 'outgoing_video',
  }

  constructor (ws, rpConnection, ringAudio, camera) {
    super(ws);

    this.rpConnection = rpConnection;
    this.ringAudio = ringAudio;
    this.camera = camera;
  }

  async call (calleeId) {
    try {
      await this.ringAudio.play();

      await this.rpConnection.setLocalDescription(await this.rpConnection.createOffer());
      super.call(calleeId, this.rpConnection.localDescription);
    } finally {
      await this.ringAudio.pause();
    }
  }

  async accept () {
    try {
      await this.rpConnection.setLocalDescription(await this.rpConnection.createAnswer());
      super.accept(this.rpConnection.localDescription);
    } finally {
      await this.ringAudio.pause();
    }
  }

  async reject () {
    try {
      super.reject()
    } finally {
      await this.ringAudio.pause();
    }
  }


  async connect () {
    super.connect();

    this.on(VideoCall.Event.Call, async (callerId, payload) => {
      await this.ringAudio.play();
      await this.rpConnection.setRemoteDescription(payload);
    });

    this.on(VideoCall.Event.CallAcceptance, async (calleeId, payload) => {
      await this.rpConnection.setRemoteDescription(payload);
      await this.ringAudio.pause();
    });

    this.on(VideoCall.Event.CallRejection, async () => {
      await this.ringAudio.pause();
    });

    this.rpConnection.addEventListener('track', async (e) => {
      const stream = e.streams[0];

      if (stream) {
        this.emit(VideoCall.Event.IncomingVideo, stream);
      }
    });

    const stream = await this.camera.getStream();
    const tracks = stream.getTracks();

    for (const track of tracks) {
     this.rpConnection.addTrack(track, stream);
    }

    this.emit(VideoCall.Event.OutgoingVideo, stream);
  }
}
