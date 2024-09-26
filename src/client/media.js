export class Media {
  static NotFound = class extends Error {
    constructor (name) {
      super(`Media not found: ${name}`);
    }
  }

  static async getVideo () {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    if (!stream) {
      throw new Media.NotFound('video');
    }

    return stream;
  }


  static async getAudio () {
    const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
    if (!stream) {
      throw new Media.NotFound('audio');
    }

    return stream;
  }

  static async getVideoAudio () {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (!stream) {
      throw new Media.NotFound('video_audio');
    }

    return stream;
  }
}
