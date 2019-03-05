const EventEmitter  = require('events')
const config        = require('./config')

class FBSocket {

  constructor(query, opts) {
    this._events  = new EventEmitter();
    this.socket   = config.adapter.openSocket(query, opts)

    this.socket.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      this.emit('message', msg)
    }
  }

  on(name, callback) {
    return this._events.on(name, callback);
  }

  emit(name, ...args) {
    return this._events.emit(name, ...args);
  }

}

module.exports = FBSocket;