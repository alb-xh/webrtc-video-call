import { Validator } from "./validator";
import { VideoCall } from "./video-call";
import { Popups } from './popups';

export class App {
  constructor (videoCall) {
    this.videoCall = videoCall;
  }

  async run (window) {
    const input = window.document.getElementByIdOrThrow('call_input');
    const button = window.document.getElementByIdOrThrow('call_button')

    input.addEventListener('focus', () => {
      const input = window.document.getElementByIdOrThrow('call_input');
      window.document.removeClassName(input, 'error');
    });

    button.addEventListener('click', async () => {
      const calleeId = input.value;

      if (!Validator.isSubscriberId(calleeId)) {
        window.document.appendClassName(input, 'error');
        return;
      }

      await this.videoCall.call(calleeId);

      const { dismiss } = await Popups.cancelable({ title: 'Calling...' });
      if (dismiss === 'cancel') {
        await this.videoCall.stop();
      }
    });

    this.videoCall.on(VideoCall.Event.SubscriberId, (subscriberId) => {
      const el = document.getElementByIdOrThrow('callee_id')
      el.textContent = `Your call id: ${subscriberId}`;
    });

    this.videoCall.on(VideoCall.Event.SubscriberNotFound, async () => {
      await Popups.error({ title: 'User offline', text: 'Please try again later' });
    });

    this.videoCall.on(VideoCall.Event.CallAcceptance, async () => {
      await Popups.close()
    });

    this.videoCall.on(VideoCall.Event.CallRejection, async () => {
      await Popups.close()
    });

    this.videoCall.on(VideoCall.Event.CallTermination, async () => {
      await Popups.close()
    });

    this.videoCall.on(VideoCall.Event.Call, async (callerId) => {
      const { isConfirmed } = await Popups.questionable({ title: 'Call', message: `From: ${callerId}`, timer: 30000 });

      if (isConfirmed) {
        await this.videoCall.accept();
      } else {
        await this.videoCall.reject();
      }
    });

    this.videoCall.on(VideoCall.Event.IncomingVideo, (stream) => {
      console.log('Incoming', stream)
      const video = document.getElementByIdOrThrow('other_video')
      video.srcObject = stream;

      document.removeClassName(video, 'hidden');
    });

    this.videoCall.on(VideoCall.Event.OutgoingVideo, (stream) => {
      console.log('Outgoing', stream)
      const video = document.getElementByIdOrThrow('own_video')
      video.srcObject = stream;
    });


    await this.videoCall.connect();
  }
}
