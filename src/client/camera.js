export class Camera {
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
