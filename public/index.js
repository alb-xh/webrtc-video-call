const MessageType = {
  Call: 'call',
  CallStop: 'call_stop',
  CallResponse: 'call_response',
};

class Popups {
  static async error ({ title, message, timer }) {
    return Swal.fire({
      icon: "error",
      title: title ?? "Oops...",
      text: message ?? '',
      timer: timer ?? 10000,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showCloseButton: true,
      showConfirmButton: false,
      showCancelButton: false,
    });
  }

  static async cancelable ({ title, message, timer }) {
    return Swal.fire({
      title: title ?? 'Cancel',
      text: message ?? '',
      timer: timer ?? undefined,
      showConfirmButton: false,
      showCancelButton: true,
      allowOutsideClick: false,
      allowEscapeKey: false,
    });
  }

  static async questionable ({ title, message, timer }) {
    return Swal.fire({
      title: title ?? "Are you sure?",
      text: message ?? '',
      timer: timer ?? undefined,
      icon: "question",
      showCancelButton: true,
      allowOutsideClick: false,
      confirmButtonText: "Accept"
    });
  }

  static unexpected () {
    return Popups.error({ message: `Something went wrong sorry :(` });
  }
}

class Camera {
  async getStream () {
    this.mediaStream = this.mediaStream ?? await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    return this.mediaStream;
  }

  async bind (document) {
    const el = document.getElementById('my_camera')
    if (!el) {
      await Popups.unexpected();
      return;
    }

    try {
      const stream = await this.getStream();
      el.srcObject = stream;
    } catch (err) {
      console.error(err);
      await Popups.error({ message: `Camera can't be found` });
    }
  }
}

class Ring extends Audio {
  constructor (path) {
    super(path);
    this.loop = true;
    this.onpause = () => { this.currentTime = 0; };
  }
}

class Call {
  constructor (socket, camera, ring) {
    this.socket = socket;
    this.camera = camera;
    this.ring = ring;
    this.rp = new RTCPeerConnection();

    // state
    this.callerId = null;
    this.calleeId = null;
  }

  static isValidId (calleeId) {
    return typeof calleeId === 'string' && calleeId.length === 20;
  }

  async make (calleeId) {
    if (this.calleeId) {
      throw new Error('Already calling');
    }

    try {
      this.calleeId = calleeId;

      this.ring.play();

      const calling = Popups.cancelable({ title: 'Calling...' });

      const offer = await this.rp.createOffer();
      await this.rp.setLocalDescription(offer);

      this.socket.emit('message', calleeId, { type: MessageType.Call, payload: { offer } });

      await calling;

      this.socket.emit('message', calleeId, { type: MessageType.CallStop } )

      this.ring.pause();
      this.calleeId = null;
    } catch (err) {
      console.error(err);

      this.ring.pause();
      await Popups.unexpected();
      this.calleeId = null;
    }
  }

  async bind (document) {
    this.socket.on('connect', async () => {
      const el = document.getElementById("callee_id");

      if (!el) {
        await Popups.unexpected();
        return;
      }

      el.textContent = `Your call id: ${this.socket.id}`;
    });

    this.socket.on('connect_err', async (err) => {
      if (socket.active) {
        return;
      }

      console.error(err);
      await Popups.unexpected();
    });

    this.socket.on('disconnect', async (err) => {
      console.error(err);
      await Popups.unexpected();
    });

    this.socket.on('message', async (callerId, message) => {
      const reject = () => {
        this.socket.emit('message', callerId, { type: MessageType.CallResponse, payload: { accepted: false } });
      };

      switch (message.type) {
        case MessageType.Call: {
          if (this.calleeId || this.callerId) {
            reject();
            return;
          }

          this.callerId = callerId;
          this.ring.play();

          try {
            const { isConfirmed } = await Popups.questionable({ title: 'Call', message: `From: ${callerId}`, timer: 30000 });

            if (!isConfirmed) {
              reject();
              return;
            }

            this.rp.setRemoteDescription(message.payload.offer);
            const answer = await this.rp.createAnswer();

            this.socket.emit('message', callerId, { type: MessageType.CallResponse, payload: { accepted: true, answer } });
            this.ring.pause();
            this.callerId = null;
          } catch (err) {
            console.log(message);

            this.ring.pause();
            await Popups.unexpected();
            this.callerId = null;
          }

          return;
        }

        case MessageType.CallStop: {
          if (this.calleeId || this.callerId !== callerId) {
            return;
          }

          await Swal.close();
        }

        case MessageType.CallResponse: {
          if (this.callerId || this.calleeId !== callerId) {
            return;
          }

          if (!message.payload.accepted) {
            await Swal.close();
          }

          this.rp.setRemoteDescription(message.payload.answer);
          // connect call;

          return;
        }
      }
    });

    this.socket.on('receiver_not_found', async () => {
      await Popups.error({ title: 'User offline', text: 'Please try again later' });
    });

    this.socket.connect();

    const input = document.getElementById('call_input');
    const button = document.getElementById('call_button');

    if (!input || !button) {
      await Popups.unexpected();
      return;
    }

    input.onfocus = () => {
      input.style.borderColor = '';
    };

    button.onclick = async () => {
      const calleeId = input.value;

      if (!calleeId || !Call.isValidId(calleeId)) {
        input.style.borderColor = 'red';
        return;
      }

      await this.make(calleeId);
    };
  }
}

const socket = io('http://localhost:3000', { autoConnect: false });
const camera = new Camera();
const ring = new Ring('./media/ring.mp3');
const call = new Call(socket, camera, ring);

call.bind(window.document);
camera.bind(window.document);
