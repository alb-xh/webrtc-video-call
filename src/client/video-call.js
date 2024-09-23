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
      this.ringAudio.play();

      await this.rpConnection.setLocalDescription(await this.rpConnection.createOffer());
      super.call(calleeId, this.rpConnection.localDescription);
    } finally {
      this.ringAudio.pause();
    }
  }

  async accept () {
    try {
      await this.rp.setLocalDescription(this.rp.createAnswer());
      super.accept(this.rp.localDescription);
    } finally {
      this.ringAudio.pause();
    }
  }

  async reject () {
    try {
      await this.rp.setRemoteDescription(null);
      super.reject()
    } finally {
      this.ringAudio.pause();
    }
  }

  async stop () {
    await this.rp.setRemoteDescription(null);
    await this.rp.setLocalDescription(null);
    super.stop();
  }

  async connect () {
    super.connect();

    this.on(VideoCall.Event.Call, async (callerId, payload) => {
      this.ringAudio.play();
      await this.rp.setRemoteDescription(payload);
    });

    this.on(VideoCall.Event.CallAcceptance, async () => {
      this.ringAudio.pause();
    });

    this.on(VideoCall.Event.CallRejection, () => {
      this.ringAudio.pause();
    });

    this.rpConnection.addEventListener('track', async (e) => {
      console.log(e);
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
