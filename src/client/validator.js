export class Validator {
  static isSocketId (id) {
    return typeof id === 'string' && id.length === 20;
  }
}
