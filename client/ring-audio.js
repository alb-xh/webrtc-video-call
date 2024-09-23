export class RingAudio extends Audio {
  constructor (path) {
    super(path);
    this.loop = true;
    this.onpause = () => { this.currentTime = 0; };
  }
}
