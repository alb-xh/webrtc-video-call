export class EventEmitter {
  handlers = {}

  on (event, cb) {
    this.handlers[event] = this.handlers[event] ?? [];
    this.handlers[event].push(cb);
  }

  emit (event, ...args) {
    const handlers = this.handlers[event] ?? [];

    for (const handler of handler) {
      handler(...args);
    }
  }
}