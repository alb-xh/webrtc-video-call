import { EventEmitter } from "./event-emitter";

export class Call extends EventEmitter {
  Forbidden = class extends Error {
    constructor () {
      super('Action is forbidden');
    }
  }

  static Status = {
    Idle: 'idle',
    Calling: 'calling',
    Receiving: 'receiving_call',
    Active: 'active_call',
  }

  static Event = {
    SubscriberId: 'receive_subscriber_id',
    SubscriberNotFound: 'subscriber_not_found',
    Call: 'call',
    CallRejection: 'call_rejection',
    CallAcceptance: 'call_acceptance',
    CallTermination: 'call_termination',
    CallUnavailable: 'call_unavailable',
  }

  constructor (ws) {
    this.ws = ws;
    this.callerId = null;
    this.calleeId = null;
    this.status = Call.Status.Idle;
  }

  call (calleeId, payload) {
    if (this.status !== Call.Status.Idle) {
      throw new Call.Forbidden();
    }

    this.status = Call.Status.Calling;
    this.callerId = this.ws.id;
    this.calleeId = calleeId;

    this.ws.emit('message', calleeId, { event: Call.Event.Call, payload });
  }

  accept (payload) {
    if (this.status !== Call.Status.Receiving) {
      throw new Call.Forbidden();
    }

    this.status = Call.Status.Active;

    this.ws.emit('message', this.callerId, { event: Call.Event.CallAcceptance, payload });
  }

  reject () {
    if (this.status !== Call.Status.Receiving) {
      throw new Call.Forbidden();
    }

    this.status = Call.Status.Idle;
    this.callerId = null;
    this.calleeId = null,

    this.ws.emit('message', this.callerId, { event: Call.Event.CallRejection });
  }

  stop () {
    if (this.status !== Call.Status.Active) {
      throw new Call.Forbidden();
    }

    this.status = Call.Status.Idle;
    this.callerId = null;
    this.calleeId = null,

    this.ws.emit('message', this.callerId === this.ws.id ? this.calleeId : this.callerId, { event: Call.Event.CallTermination });
  }

  connect () {
    this.ws.on('connect', () => {
      this.emit(CallEvent.SubscriberId, this.ws.id);
    });

    this.ws.on('connect_err', (err) => {
      if (!this.ws.active) {
        throw err;
      }
    });

    this.ws.on('receiver_not_found', () => {
      this.emit(CallEvent.SubscriberNotFound);
    });

    const onCall = (callerId, payload) => {
      if (this.status !== Call.Status.Idle) {
        this.ws.emit('message', callerId, { event: Call.Event.CallUnavailable });
        return;
      }

      this.status = Call.Status.Receiving;
      this.callerId = callerId;
      this.calleeId = this.ws.id;

      this.emit(Call.Event.Call, callerId, payload);
    }

    const onAccept = (calleeId, payload) => {
      if (
        this.status !== Call.Status.Calling ||
        this.calleeId !== calleeId
      ) {
        return;
      }

      this.status = Call.Status.Active;

      this.emit(Call.Event.CallAcceptance, calleeId, payload);
    }

    const onReject = (calleeId, payload) => {
      if (
        this.status !== Call.Status.Calling ||
        this.calleeId !== calleeId
      ) {
        return;
      }

      this.status = Call.Status.Idle;
      this.callerId = null;
      this.calleeId = null,

      this.emit(Call.Event.CallRejection, calleeId, payload);
    }

    const onStop = (senderId, payload) => {
       if (
        this.status !== Call.Status.Active ||
        (this.callerId !== senderId && this.calleeId !== senderId)
      ) {
        return;
      }

      this.status = Call.Status.Idle;
      this.callerId = null;
      this.calleeId = null,

      this.emit(Call.Event.CallTermination, senderId, payload);
    };

    const onUnavailable = (senderId, payload) => {
      this.emit(Call.Event.CallUnavailable, senderId, payload);
    };

    const onMessage = {
      [Call.Event.Call]: onCall,
      [Call.Event.CallAcceptance]: onAccept,
      [Call.Event.CallRejection]: onReject,
      [Call.Event.CallTermination]: onStop,
      [Call.Event.CallUnavailable]: onUnavailable,
    }

    this.ws.on('message', async (senderId, { type, payload }) => {
      const handler = onMessage[type];
      if (handler) {
        handler.call(this, senderId, payload)
      }
    });

    this.socket.connect();
  }
}