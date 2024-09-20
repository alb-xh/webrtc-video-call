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
      title: 'Really bad error',
      message: `Please refresh or contact me :(`,
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
    window.addEventListener('error', async (err) => {
      console.error(err);
      await Popups.unrecoverable();
    });

    window.document.getElementByIdOrThrow = function (id) {
      const element = this.getElementById(id);
      if (!element) {
        throw new Error(`Element "${id}" wasn't found`);
      }

      return element;
    }

    window.document.appendClassName = function (element, className) {
      element.className = (element.className ?? '').split(' ')
        .filter(Boolean)
        .concat(className)
        .join(' ');

      return element;
    }

    window.document.removeClassName = function (element, className) {
      element.className = (element.className ?? '').split(' ')
        .filter((name) => name !== className)
        .join(' ');

      return element;
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
    this.rpConnection = rpConnection;
    this.ringAudio = ringAudio;
    this.camera = camera;

    // internal
    this.activeCallId = null;
    this.eventHandlers = {};
  }

  async _invokeEventHandler (event, ...args) {
    const cb = this.eventHandlers[event];
    if (cb) {
      const res = await cb(...args);
      return res;
    }
  }

  async _safeCall (callerId, cb) {
    if (this.activeCallId) {
      throw new Error('Ongoing call in progress');
    }

    try {
      this.activeCallId = callerId;
      this.ringAudio.play();

      await cb();
    } finally {
      this.ringAudio.pause();
      this.activeCallId = null;
    }
  }

  _getMessageHandler (type) {
    const onCall = async (callerId, payload) => {
      const reject = () => {
        this.socket.emit('message', callerId, { type: 'call_response', payload: { accepted: false } });
      }

      if (this.activeCallId) {
        reject();
        return;
      }

      await this._safeCall(callerId, async () => {
        const accepted = await this._invokeEventHandler('call_received', callerId);
        if (!accepted) {
          reject();
          return;
        }

        await this.rpConnection.setRemoteDescription(payload.description);
        await this.rpConnection.setLocalDescription(await this.rpConnection.createAnswer());

        this.socket.emit('message', callerId, { type: 'call_response', payload: { accepted: true, description: this.rpConnection.localDescription } });
      });
    }

    const onCallStop = async (calleeId, payload) => {
      if (!this.activeCallId || this.activeCallId !== calleeId) {
        return;
      }

      await this._invokeEventHandler('call_stopped', calleeId, payload);
    }

    const onCallResponse = async (calleeId, payload) => {
      if (!this.activeCallId || this.activeCallId !== calleeId) {
        return;
      }

      if (!payload.accepted) {
        await this._invokeEventHandler('call_rejected', calleeId, payload);
        return;
      }

      await this.rpConnection.setRemoteDescription(payload.description);

      await this._invokeEventHandler('call_accepted', calleeId, payload);
    }

    switch (type) {
      case 'call': return onCall;
      case 'call_stop': return onCallStop;
      case 'call_response': return onCallResponse;
    }
  }

  _setupWebsocket () {
    this.socket.on('connect', async () => {
      await this._invokeEventHandler('caller_id', this.socket.id);
    });

    this.socket.on('connect_err', (err) => {
      if (!this.socket.active) {
        throw err;
      }
    });

    this.socket.on('receiver_not_found', async () => {
      await this._invokeEventHandler('receiver_not_found');
    });

    this.socket.on('message', async (senderId, message) => {
      const handler = this._getMessageHandler(message.type);
      if (handler) {
        await handler(senderId, message.payload);
      }
    });

    this.socket.connect();
  }

  async _setupWebRTC () {
    this.rpConnection.addEventListener('track', async (e) => {
      console.log(e);
      const stream = e.streams[0];

      if (stream) {
        await this._invokeEventHandler('incoming_video_stream', stream);
      }
    });

    const stream = await this.camera.getStream();
    const tracks = stream.getTracks();

    for (const track of tracks) {
     this.rpConnection.addTrack(track, stream);
    }

    await this._invokeEventHandler('outgoing_video_stream', stream);
  }

  async setup () {
    this._setupWebsocket();
    await this._setupWebRTC();
  }

  on (event, cb) {
    this.eventHandlers[event] = cb
  }

  isId (calleeId) {
    return typeof calleeId === 'string' && calleeId.length === 20;
  }

  async call (calleeId) {
    return this._safeCall(calleeId, async () => {
      await this.rpConnection.setLocalDescription(await this.rpConnection.createOffer());

      this.socket.emit('message', calleeId, { type: 'call', payload: { description: this.rpConnection.localDescription } });

      const canceled = await this._invokeEventHandler('calling', calleeId);
      if (canceled) {
        this.socket.emit('message', calleeId, { type: 'call_stop' } );
      }
    });
  }
}

class Main {
  constructor (videoCall) {
    this.videoCall = videoCall;
  }

  async _setupVideoCall () {
    videoCall.on('caller_id', (callerId) => {
      const el = document.getElementByIdOrThrow('callee_id')
      el.textContent = `Your call id: ${callerId}`;
    });

    videoCall.on('receiver_not_found', async () => {
      await Popups.error({ title: 'User offline', text: 'Please try again later' });
    });

    videoCall.on('incoming_video_stream', (stream) => {
      const video = document.getElementByIdOrThrow('other_video')
      video.srcObject = stream;

      document.removeClassName(video, 'hidden');
    });

    videoCall.on('outgoing_video_stream', (stream) => {
      const video = document.getElementByIdOrThrow('own_video')
      video.srcObject = stream;
    });

    videoCall.on('call_accepted', async () => {
      await Popups.close()
    });

    videoCall.on('call_rejected', async () => {
      await Popups.close()
    });

    videoCall.on('call_stopped', async () => {
      await Popups.close()
    });


    videoCall.on('call_received', async (callerId, accept, reject) => {
      const { isConfirmed } = await Popups.questionable({ title: 'Call', message: `From: ${callerId}`, timer: 30000 });
      return isConfirmed;
    });

    videoCall.on('calling', async () => {
      const { isDismissed } = await Popups.cancelable({ title: 'Calling...' });
      return isDismissed
    });

    await videoCall.setup();
  }

  setupHandlers () {
    const input = document.getElementByIdOrThrow('call_input');
    const button = document.getElementByIdOrThrow('call_button')

    input.addEventListener('focus', () => {
      const input = document.getElementByIdOrThrow('call_input');
      document.removeClassName(input, 'error');
    });

    button.addEventListener('click', async () => {
      const calleeId = input.value;

      if (!this.videoCall.isId(calleeId)) {
        document.appendClassName(input, 'error');
        return;
      }

      await this.videoCall.call(calleeId);
    });
  }


  async run () {
    WindowEnhancer.enhance();
    await this._setupVideoCall();
    this.setupHandlers();
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