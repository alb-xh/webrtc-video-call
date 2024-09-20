class Popups {
  static async custom (args) {
    return Swal.fire({
      icon: args.icon ?? '',
      title: args.title ?? '',
      text: args.message ?? '',
      timer: args.timer ?? null,
      showCloseButton: args.closeBtn ?? false,
      allowOutsideClick: args.outsideClick ?? false,
      allowEscapeKey: args.escape ?? false,
      showConfirmButton: args.confirm ?? false,
      showCancelButton: args.cancel ?? false,
      confirmButtonText: args.confirmText ?? 'Confirm',
      cancelButtonText: args.cancelText ?? 'Cancel',
    });
  }

  static async error (args) {
    return Popups.custom({
      icon: 'error',
      closeBtn: true,
      title: args.title ?? 'Oops',
      message: args.message,
      timer: args.timer ?? 10000,
    });
  }

  static async unrecoverable () {
    return Popups.custom({
      icon: 'error',
      title: 'Really bad error :(',
      message: `Please refresh or contact me`,
    });
  }

  static async cancelable (args) {
    return Popups.custom({
      cancel: true,
      title: args.title ?? 'Cancel',
      message: args.message,
      timer: args.timer,
    });
  }

  static async questionable (args) {
    return Popups.custom({
      icon: 'question',
      cancel: true,
      confirm: true,
      confirmText: 'Accept',
      cancelText: 'Reject',
      title: args.title,
      message: args.message,
      timer: args.timer,
    })
  }

  static async close () {
    return Swal.close();
  }
}

class WindowEnhancer {
  static enhance () {
    window.addEventListener('error', async () => {
      console.error(err);
      await Popups.unrecoverable();
    });

    window.document.getDocumentByIdOrThrow = function (id) {
      const element = this.getElementById(id);
      if (!element) {
        throw new Error(`Element "${name}" wasn't found`);
      }

      return element;
    }

    window.appendClassName = function (el, className) {
      el.className = el.className.split(' ')
        .concat(className)
        .join(' ');

      return el;
    }


    window.document.removeClassName = function (el, className) {
      el.className = el.className.split(' ')
        .filter((name) => name !== className)
        .join(' ');

      return element
    }

    return window;
  }
}


class Camera {
  constructor () {
    this.stream = null;
  }

  async getStream () {
    this.stream = this.stream ?? await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

    if (!this.stream) {
      throw new Error(`Web camera can't be found`);
    }

    return this.stream;
  }
}

class RingAudio extends Audio {
  constructor (path) {
    super(path);
    this.loop = true;
    this.onpause = () => { this.currentTime = 0; };
  }
}

class VideoCall {
  constructor (socket, rpConnection, ringAudio, camera) {
    this.socket = socket;
    this.rpConnection = rpConnection
    this.ringAudio = ringAudio;
    this.camera = camera;

    // internal
    this.activeCallId = null;
    this._onStream = null;
  }


  _onConnect () {
    const el = document.getElementByIdOrThrow('callee_id')
    el.textContent = `Your call id: ${this.socket.id}`;
  }

  _onConnectionError (err) {
    if (!this.socket.active) {
      throw err;
    }
  }

  async _onReceiverNotFound () {
    await Popups.error({ title: 'User offline', text: 'Please try again later' });
  }

  _rejectCall (callerId) {
    this.socket.emit('message', callerId, { type: 'call_response', payload: { accepted: false } });
  }

  async _acceptCall (callerId, sdp) {
    await this.rp.setRemoteDescription(message.payload.description);
    await this.rp.setLocalDescription(await this.rp.createAnswer());

    this.socket.emit('message', callerId, { type: 'call_response', payload: { accepted: true, description: this.rp.localDescription } });
  }

  async _onCall (callerId, payload) {
    if (this.activeCallId) {
      this._rejectCall(callerId);
      return;
    }

    try {
      this.activeCallId = callerId;
      this.ring.play();

      const { isConfirmed } = await Popups.questionable({ title: 'Call', message: `From: ${callerId}`, timer: 30000 });
      if (!isConfirmed) {
        this._rejectCall(callerId)
        return;
      }

      await this._acceptCall();


    } finally {
      this.ring.pause();
      this.activeCallId = null;
    }
  }

  async _onCallStop (callerId, payload) {
    if (!this.activeCallId || this.activeCallId !== callerId) {
      return;
    }

    await Popups.close();
  }

  async _onCallResponse (calleeId, payload) {
    if (!this.activeCallId || this.activeCallId !== calleeId) {
      return;
    }

    await Popups.close();

    if (!payload.accepted) {
      return;
    }

    await this.rp.setRemoteDescription(payload.description);
    await this.addOtherVideo(document);
  }

  async _onMessageReceived (senderId, message) {
    const handlers = {
      'call': this._onCall,
      'call_stop': this._onCallStop,
      'call_response': this._onCallResponse,
    }

    const handler = handlers[type];
    if (!handler) {
      return;
    }

    await handler.call(this, senderId, message.payload);
  }

  _setupWebsocket () {
    this.socket.on('connect', this._onConnect.bind(this));
    this.socket.on('connect_err', this._onConnectionError.bind(this));
    this.socket.on('receiver_not_found', this._onReceiverNotFound.bind(this));
    this.socket.on('message', this._onMessageReceived.bind(this));
    this.socket.connect();
  }

  _onTrack (e) {
    console.log(e);

    if (this._onStream) {
      this._onStream(e.streams[0]);
    }
  }

  async _setupWebRTC () {
    this.rp.addEventListener('track', this._onTrack.bind(this));

    const stream = await this.camera.getStream();
    const tracks = stream.getTracks();

    for (const track of tracks) {
     this.rp.addTrack(track, stream);
    }
  }

  onStream (cb) {
    this._onStream = cb;
  }

  async setup () {
    this._setupWebsocket();
    await this._setupWebRTC();
  }

  isId (calleeId) {
    return typeof calleeId === 'string' && calleeId.length === 20;
  }

  async call (calleeId) {
    if (this.activeCallId) {
      throw new Error('Ongoing call in progress');
    }

    try {
      this.activeCallId = calleeId;
      this.ring.play();

      await this.rp.setLocalDescription(await this.rp.createOffer());

      this.socket.emit('message', calleeId, { type: MessageType.Call, payload: { description: this.rp.localDescription } });

      const { isDismissed } = await Popups.cancelable({ title: 'Calling...' });

      if (isDismissed) {
        this.socket.emit('message', calleeId, { type: MessageType.CallStop } );
      }
    } finally {
      this.ring.pause();
      this.activeCallId = null;
    }
  }
}

class Main {
  constructor (videoCall) {
    this.videoCall = videoCall;
  }

  _onCalleeIdInputFocus () {
    const input = document.getElementByIdOrThrow('call_input');
    document.removeClassName(input, 'error');
  }

  async _onCallButtonClick () {
    const input = document.getElementByIdOrThrow('call_input');

    if (!this.videoCall.isId(input.value)) {
      document.appendClassName(input, 'error');
      return;
    }

    await this.videoCall.call(calleeId);
  }

  async run () {
    WindowEnhancer.enhance();

    videoCall.onCall((stream) => {
      const video = document.getElementByIdOrThrow('other_video')
      video.srcObject = stream;

      document.removeClassName(video, 'hidden');
    });

    videoCall.onCallStop(() => {
      const video = document.getElementByIdOrThrow('other_video')
      document.appendClassName(video, 'hidden');
    });

    await this.videoCall.setup();

    document
      .getElementByIdOrThrow('call_input')
      .addEventListener('focus', this._onCalleeIdInputFocus.bind(this));

    document
      .getElementByIdOrThrow('call_button')
      .addEventListener('focus', this._onCallButtonClick.bind(this));

  }
}

class Config {
  static socketUrl = 'http://localhost:3000';
  static ringMediaUrl ='./media/ring.mp3';
};

const socket = io(Config.socketUrl, { transports: [ 'websocket' ], autoConnect: false, });
const rpConnection = new RTCPeerConnection();
const ringAudio = new RingAudio(Config.ringMediaUrl);
const camera = new Camera();
const videoCall = new VideoCall(socket, rpConnection, ringAudio, camera);
const main = new Main(videoCall);

main.run();