const EventEmitter  = require('events')
const co            = require('co')
const config        = require('./config')

const $events = new EventEmitter();

class FBScript {

  constructor(txid) {
    this.txid     = txid;
    this.tx       = null;
    this.opreturn = null;
    this.stack    = null;
    this.result   = null;
  }

  on(name, callback) {
    return $events.on(name, callback);
  }

  emit(name, ...args) {
    return $events.emit(name, this, ...args);
  }

  buildStack() {
    return this.opReturn.split(' ').splice(1)
      .reduce((stack, h) => {
        const ln  = stack[stack.length-1],
              buf = Buffer.from(h, 'hex');
        if ( !ln.cmd ) {
          ln.cmd = buf.toString()
          ln.args = []
        } else if ( h === '7c') {
          ln.delim = buf.toString()
          stack.push({})
        } else {
          ln.args.push(buf)
        }
        return stack;
      }, [{}])
  }

  loadScript() {
    return config.adapter
      .loadScript(this.txid)
      .then(tx => {
        this.tx       = tx;
        this.opReturn = tx.out.find(o => o.op === 106).str;
        this.stack    = this.buildStack();
        return tx;
      })
  }

  loadFunctions() {
    const cmds = this.stack.map(ln => ln.cmd)
    return config.adapter
      .loadFunctions(cmds)
      .then(funcs => {
        funcs.forEach(f => {
          const line = this.stack.find(ln => ln.cmd === f.h),
                name = `${ f.name }.js`;
          line.fn = config.vm.run(f.fn, name);
        })
        return funcs;
      })
  }

  validateStack() {
    this.stack
      .filter(ln => typeof ln.fn !== 'function')
      .forEach(ln => {
        const i = this.stack.indexOf(ln)
        if (i === this.stack.length-1 && this.stack.length > 1) {
          this.stack.pop()
        } else {
          throw new Error(`Invalid stack. Function not found: ${ ln.cmd }`)
        }
      })
    return true;
  }

  execute() {
    let ctx;
    const stack = this.stack;
    return co(function *() {
      for (var i = 0; i < stack.length; i++) {
        let ln = stack[i];
        ctx = yield Promise.resolve( ln.fn({ ctx }, ...ln.args) );
      }
      return ctx;
    }).then(res => {
      this.result = res;
      this.emit('success', res)
      return res;
    });
  }
}

module.exports = FBScript;