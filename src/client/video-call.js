import { EventEmitter } from "./event-emitter";
import { Media } from "./media";

export class VideoCall extends EventEmitter {
  Forbidden = class extends Error {
    constructor () {
      super('Action is forbidden');
    }
  }

  static Status = {
    Idle: 'idle',
    Calling: 'calling',
    Receiving: 'receiving_call',
    Active: 'active_call',
  }

  static Event = {
    IdObtained: 'id_obtained',
    InterlocutorNotFound: 'interlocutor_not_found',
    InterlocutorDisconnected: 'interlocutor_disconnected',
    Call: 'call',
    CallRejection: 'call_rejection',
    CallAcceptance: 'call_acceptance',
    CallTermination: 'call_termination',
    CallUnavailable: 'call_unavailable',
    CallDisconnected: 'call_disconnected',
    IncomingVideo: 'incoming_video',
    OutgoingVideo: 'outgoing_video',
    Offer: 'offer',
    Answer: 'answer',
    IceCandidate: 'ice_candidate',
  }

  constructor (ws, ringAudio) {
    super();

    this.ws = ws;
    this.ringAudio = ringAudio;
    this.status = VideoCall.Status.Idle;
    this.rpConnection = null;
    this.callerId = null;
    this.calleeId = null;
  }

  getInterlocutorId () {
    return this.callerId === this.ws.id ? this.calleeId : this.callerId;
  }

  async createWebRTCConnection () {
    const rpConnection = new RTCPeerConnection();

    rpConnection.addEventListener('icecandidate', (ev) => {
      if (ev.candidate) {
        this.emit(VideoCall.Event.IceCandidate, ev.candidate);
      }
    });

    rpConnection.addEventListener('track', (ev) => {
      const stream = ev?.streams[0];

      if (stream) {
        this.emit(VideoCall.Event.IncomingVideo, stream);
      }
    });

    const stream = await Media.getVideoAudio();

    for (const track of stream.getTracks()) {
      rpConnection.addTrack(track, stream);
    }

    return rpConnection;
  }

  async call (calleeId) {
    if (this.status !== VideoCall.Status.Idle) {
      throw new VideoCall.Forbidden();
    }

    try {
      this.status = VideoCall.Status.Calling;
      this.callerId = this.ws.id;
      this.calleeId = calleeId;

      await this.ringAudio.play();

      this.rpConnection = await this.createWebRTCConnection();
      const offer = await this.rpConnection.createOffer();
      await this.rpConnection.setLocalDescription(offer);

      this.ws.emit('message', calleeId, { event: VideoCall.Event.Offer, payload: offer });
    } catch (err) {
      this.ringAudio.pause();
      throw err;
    }
  }

  async accept () {
    if (this.status !== VideoCall.Status.Receiving) {
      throw new VideoCall.Forbidden();
    }

    try {
      this.status = VideoCall.Status.Active;

      const answer = await this.rpConnection.createAnswer();
      await this.rpConnection.setLocalDescription(answer);

      this.ws.emit('message', this.callerId, { event: VideoCall.Event.Answer, payload: answer });
    } finally {
      this.ringAudio.pause();
    }
  }

  async reject () {
    if (this.status !== VideoCall.Status.Receiving) {
      throw new VideoCall.Forbidden();
    }

    try {
      this.ws.emit('message', this.callerId, { event: VideoCall.Event.CallRejection });

      this.status = VideoCall.Status.Idle;
      this.callerId = null;
      this.calleeId = null;
    } finally {
      this.ringAudio.pause();
    }
  }

  terminate () {
    if (this.status == VideoCall.Status.Idle) {
      throw new VideoCall.Forbidden();
    }

    this.ringAudio.pause();

    this.ws.emit('message', this.getInterlocutorId(), { event: VideoCall.Event.CallTermination });

    this.status = VideoCall.Status.Idle;
    this.callerId = null;
    this.calleeId = null;
  }

  disconnect () {
    if (this.status === VideoCall.Status.Idle) {
      return;
    }

    this.ringAudio.pause();

    this.ws.emit('message', this.getInterlocutorId(), { event: VideoCall.Event.InterlocutorDisconnected });

    this.status = VideoCall.Status.Idle;
    this.callerId = null;
    this.calleeId = null;
  }

  async connect () {
    this.ws.on('connect_err', (err) => {
      if (!this.ws.active) {
        throw err;
      }
    });

    this.ws.on('connect', () => {
      this.emit(VideoCall.Event.IdObtained, this.ws.id);
    });

    this.ws.on('receiver_not_found', () => {
      this.status = VideoCall.Status.Idle;
      this.callerId = null;
      this.calleeId = null;

      this.ringAudio.pause();

      this.emit(VideoCall.Event.InterlocutorNotFound);
    });

    const onOffer = async (callerId, offer) => {
      if (this.status !== VideoCall.Status.Idle) {
        this.ws.emit('message', callerId, { event: VideoCall.Event.CallUnavailable });
        return;
      }

      this.status = VideoCall.Status.Receiving;
      this.callerId = callerId;
      this.calleeId = this.ws.id;

      await this.ringAudio.play();

      this.rpConnection = await this.createWebRTCConnection();
      await this.rpConnection.setRemoteDescription(offer);

      this.emit(VideoCall.Event.Call, callerId);
    }

    const onAnswer = async (calleeId, answer) => {
      if (
        this.status !== VideoCall.Status.Calling ||
        this.calleeId !== calleeId
      ) {
        return;
      }

      this.ringAudio.pause();
      this.status = VideoCall.Status.Active;

      await this.rpConnection.setRemoteDescription(answer);

      this.emit(VideoCall.Event.CallAcceptance, calleeId, answer);
    }

    const onIceCandidate = async (senderId, candidate) => {
      if (
        this.status === VideoCall.Status.Idle ||
        this.getInterlocutorId() !== senderId
      ) {
        return;
      }

      this.rpConnection?.addIceCandidate(candidate);
    }

    const onReject = async (calleeId) => {
      if (
        this.status !== VideoCall.Status.Calling ||
        this.calleeId !== calleeId
      ) {
        return;
      }

      this.ringAudio.pause();

      this.status = VideoCall.Status.Idle;
      this.callerId = null;
      this.calleeId = null,
      this.rpConnection = null;

      this.emit(VideoCall.Event.CallRejection, calleeId);
    }

    const onTerminate = (senderId) => {
      if (
        this.status === VideoCall.Status.Idle ||
        this.getInterlocutorId() !== senderId
      ) {
        return;
      }

      this.ringAudio.pause();

      this.status = VideoCall.Status.Idle;
      this.callerId = null;
      this.calleeId = null,

      this.emit(VideoCall.Event.CallTermination, senderId);
    };

    const onUnavailable = (calleeId) => {
      if (
        this.status !== VideoCall.Status.Calling ||
        this.calleeId !== calleeId
      ) {
        return;
      }

      this.ringAudio.pause();

      this.status = VideoCall.Status.Idle;
      this.callerId = null;
      this.calleeId = null,

      this.emit(VideoCall.Event.CallUnavailable, calleeId);
    };

    const onDisconnect = async (senderId) => {
      if (
        this.status === VideoCall.Status.Idle ||
        this.getInterlocutorId() !== senderId
      ) {
        return;
      }

      this.ringAudio.pause();

      this.status = VideoCall.Status.Idle;
      this.callerId = null;
      this.calleeId = null;

      this.emit(VideoCall.Event.InterlocutorDisconnected, senderId);
    }

    const onMessage = {
      [VideoCall.Event.Offer]: onOffer,
      [VideoCall.Event.Answer]: onAnswer,
      [VideoCall.Event.IceCandidate]: onIceCandidate,
      [VideoCall.Event.CallRejection]: onReject,
      [VideoCall.Event.CallTermination]: onTerminate,
      [VideoCall.Event.CallUnavailable]: onUnavailable,
      [VideoCall.Event.InterlocutorDisconnected]: onDisconnect,
    }

    this.ws.on('message', async (senderId, { event, payload }) => {
      const handler = onMessage[event];
      if (handler) {
        handler.call(this, senderId, payload)
      }
    });

    this.ws.connect();

    this.emit(VideoCall.Event.OutgoingVideo, await Media.getVideo());
  }
}