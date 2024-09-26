import { Config } from "./config";
import { WindowEnhancer } from "./window-enhancer";
import { Camera } from "./camera";
import { RingAudio } from "./ring-audio";
import { VideoCall } from "./video-call";
import { App } from './app';

// io from CDN
const socket = io(Config.getSocketUrl(), {
  transports: [ 'websocket' ],
  autoConnect: false,
});

const ringAudio = new RingAudio(Config.getRingMediaUrl());
const camera = new Camera();

const videoCall = new VideoCall(socket, ringAudio, camera);
const app = new App(videoCall);

app.run(WindowEnhancer.enhance(window));
