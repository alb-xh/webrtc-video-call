import { Config } from "./config";
import { WindowEnhancer } from "./window-enhancer";
import { RingAudio } from "./ring-audio";
import { VideoCall } from "./video-call";
import { App } from './app';

// io from CDN
const socket = io(Config.getSocketUrl(), {
  transports: [ 'websocket' ],
  autoConnect: false,
});

const ringAudio = new RingAudio(Config.getRingMediaUrl());
const videoCall = new VideoCall(socket, ringAudio);
const app = new App(videoCall);

app.run(WindowEnhancer.enhance(window));
