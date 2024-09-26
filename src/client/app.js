import { Validator } from "./validator";
import { VideoCall } from "./video-call";
import { Popups } from './popups';

export class App {
  constructor (videoCall) {
    this.videoCall = videoCall;
  }

  async run (window) {
    const callInput = window.document.getElementByIdOrThrow('call_input');
    const callButton = window.document.getElementByIdOrThrow('call_button');
    const callStopButton = window.document.getElementByIdOrThrow('call_stop_button');
    const ownVideo = window.document.getElementByIdOrThrow('own_video');
    const otherVideo = window.document.getElementByIdOrThrow('other_video');

    const setIdleState = () => {
      if (callInput.className.includes('hidden')) { window.document.removeClassName(callInput, 'hidden'); }
      if (callButton.className.includes('hidden')) { window.document.removeClassName(callButton, 'hidden'); }
      if (!callStopButton.className.includes('hidden')) { window.document.appendClassName(callStopButton,'hidden'); }
      if (!otherVideo.className.includes('hidden')) { window.document.appendClassName(otherVideo, 'hidden'); }
      otherVideo.srcObject = null;
      callInput.value = '';
    };

    const setCallState = () => {
      if (!callInput.className.includes('hidden')) { window.document.appendClassName(callInput, 'hidden'); }
      if (!callButton.className.includes('hidden')) { window.document.appendClassName(callButton, 'hidden'); }
      if (callStopButton.className.includes('hidden')) { window.document.removeClassName(callStopButton,'hidden'); }
      if (otherVideo.className.includes('hidden')) { window.document.removeClassName(otherVideo, 'hidden'); }
    }

    window.addEventListener('unload', () => {
      this.videoCall.disconnect();
      setIdleState();
    });

    callInput.addEventListener('focus', () => {
      window.document.removeClassName(callInput, 'error');
    });

    callButton.addEventListener('click', async () => {
      const calleeId = callInput.value;

      if (!Validator.isSocketId(calleeId)) {
        window.document.appendClassName(callInput, 'error');
        return;
      }

      await this.videoCall.call(calleeId);

      const { dismiss } = await Popups.cancelable({ title: 'Calling...', timer: 30000 });

      if ([ 'cancel', 'timer' ].includes(dismiss)) {
        await this.videoCall.terminate();
        setIdleState();
      }
    });

    callStopButton.addEventListener('click', async () => {
      this.videoCall.terminate();
      setIdleState();
    });

    this.videoCall.on(VideoCall.Event.IdObtained, (id) => {
      const el = document.getElementByIdOrThrow('chat_id')
      el.textContent = `Your call id: ${id}`;
    });

    this.videoCall.on(VideoCall.Event.Call, async (callerId) => {
      const { isConfirmed, dismiss } = await Popups.questionable({ title: 'Call', message: `From: ${callerId}`, timer: 30000 });

      if (isConfirmed) {
        await this.videoCall.accept();

        setCallState();
        return;
      }

      if ([ 'cancel', 'timer' ].includes(dismiss)) {
        await this.videoCall.reject();

        setIdleState();
      }
    });

    this.videoCall.on(VideoCall.Event.InterlocutorNotFound, async () => {
      await Popups.error({ title: 'User offline', text: 'Please try again later' });
      setIdleState();
    });

    this.videoCall.on(VideoCall.Event.InterlocutorDisconnected, async () => {
      await Popups.error({ title: 'User disconnected', message: 'User suddenly disconnected' });
      setIdleState();
    })

    this.videoCall.on(VideoCall.Event.CallAcceptance, async () => {
      await Popups.close();
      setCallState()
    });

    this.videoCall.on(VideoCall.Event.CallRejection, async () => {
      await Popups.close();
      setIdleState();
    });

    this.videoCall.on(VideoCall.Event.CallTermination, async () => {
      await Popups.close();
      setIdleState();
    });

    this.videoCall.on(VideoCall.Event.CallUnavailable, async () => {
      await Popups.error({ title: 'User is busy', message: 'Another call in progress' });
      setIdleState();
    });

    this.videoCall.on(VideoCall.Event.OutgoingVideo, (stream) => {
      ownVideo.srcObject = stream;
    });

    this.videoCall.on(VideoCall.Event.IncomingVideo, (stream) => {
      otherVideo.srcObject = stream;
    });

    await this.videoCall.connect();
  }
}
