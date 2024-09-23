export class Validator {
  static isSubscriberId (id) {
    return typeof id === 'string' && id.length === 20;
  }
}
