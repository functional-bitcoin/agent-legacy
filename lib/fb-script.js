const EventEmitter  = require('events')
const co            = require('co')
const config        = require('./config')

class FBScript {

  constructor(txid) {
    this.$events  = new EventEmitter();
    this.txid     = txid;
    this.tx       = null;
    this.opreturn = null;
    this.stack    = null;
  }

  on(name, callback) {
    return this.$events.on(name, callback);
  }

  emit(name, ...args) {
    return this.$events.emit(name, this, ...args);
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
        this.validateStack()
        // TODO - validate stack?
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
    });
  }
}

module.exports = FBScript;