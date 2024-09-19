class Popups {
  static async error ({ title, message }) {
    return Swal.fire({
      icon: "error",
      title: title ?? "Oops...",
      text: message ?? '',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showCloseButton: true,
      showConfirmButton: false,
      showCancelButton: false,
    });
  }

  static async cancelable ({ title, message, timer }) {
    await Swal.fire({
      title: title ?? 'Cancel',
      message: message ?? '',
      showConfirmButton: false,
      showCancelButton: true,
      allowOutsideClick: false,
      allowEscapeKey: false,
      timer: timer ?? null,
    });
  }
}

class RingAudio extends Audio {
  constructor (path) {
    super(path);

    this.onended = () => { this.play(); };
    this.onpause = () => { this.currentTime = 0; };
  }
}

class Client {
  constructor (url) {
    this.socket = io(url, { autoConnect: false });
  }

  onConnect (document) {
    const el = document.getElementById("call_id");
    if (el) {
      el.textContent = `Your call id: ${this.socket.id}`;
    }
  }

  bind (document) {
    this.socket.on('connect', () => this.onConnect(document));
    this.socket.connect();
  }
}

class Call {
  constructor (audio) {
    this.audio = audio
  }

  static isValidId (callId) {
    return typeof callId === 'string' && callId.length === 20;
  }

  async make (callId) {
    if (!Call.isValidId(callId)) {
      throw new Error('Invalid call id');
    }

    this.audio.play();

    await Popups.cancelable({ title: 'Calling...', timer: 30000 });

    this.audio.pause();
  }

  bind (document) {
    const input = document.getElementById('call_input');
    const button = document.getElementById('call_button');

    input.onfocus = () => { input.style.borderColor = ''; };
    button.onclick = async () => {
      const callId = input.value;

      if (!callId || !Call.isValidId(callId)) {
        input.style.borderColor = 'red';
        return;
      }

      await this.make(callId);
    };
  }
}

class Camera {
  async get () {
    return navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  }

  async bind (document) {
    const el = document.getElementById('my_camera')
    if (!el) {
      await Popups.error({ message: `Something went wrong sorry :(` });
      return;
    }

    try {
      const stream = await this.get();
      el.srcObject = stream;
    } catch (err) {
      console.log(err);
      await Popups.error({ message: `Camera can't be found` });
    }
  }
}

const client = new Client('http://localhost:3000');
const ring = new RingAudio('./media/ring.mp3');
const call = new Call(ring);
const camera = new Camera();

call.bind(window.document);
camera.bind(window.document);
client.bind(window.document);
