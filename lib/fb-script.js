const EventEmitter  = require('events')
const co            = require('co')
const config        = require('./config')

const $events = new EventEmitter();

class FBScript {

  constructor(txid) {
    this.txid     = txid;
    this.tx       = null;
    this.opReturn = null;
    this.stack    = null;
    this.result   = null;
  }

  on(name, callback) {
    return $events.on(name, callback);
  }

  emit(name, ...args) {
    return $events.emit(name, ...args);
  }

  isValidCmd(buf) {
    return /^[\w@\/]{1,64}$/.test( buf.toString() );
  }

  buildStack() {
    return this.opReturn.split(' ').splice(1)
      .reduce((stack, h) => {
        const ln  = stack[stack.length-1],
              buf = Buffer.from(h, 'hex');
        if ( !ln.cmd ) {
          if ( !this.isValidCmd(buf) ) return stack;
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
    return config.cache
      .getScript(this.txid)
      .then(res => {
        if (res) return res;
        return config.adapter
          .loadScript(this.txid)
          .then(tx => {
            config.cache.setScript(this.txid, tx)
            return tx;
          })
      })
      .then(tx => {
        this.tx       = tx;
        this.opReturn = config.adapter.parseOpReturn(tx);
        this.stack    = this.buildStack();
        $events.emit('load:script', this, tx)
        return tx;
      })
  }

  loadFunctions() {
    const cmds = this.stack.map(ln => ln.cmd)
    return config.cache
      .getFunctions(cmds)
      .then(res => {
        if ( res.length && !res.includes(null) ) return res;
        const cachedFuncs   = res.filter(r => r && r.h),
              cachedCmds    = cachedFuncs.map(f => f.h),
              unchachedCmds = cmds.filter(c => !cachedCmds.includes(c));
        return config.adapter
          .loadFunctions(unchachedCmds)
          .then(funcs => {
            const cacheArgs = funcs.map(f => [f.h, f]);
            config.cache.setFunctions(cacheArgs)
            return cachedFuncs.concat(funcs);
          })
      })
      .then(funcs => {
        funcs.forEach(f => {
          const line = this.stack.find(ln => ln.cmd === f.h),
                name = `${ f.name }.js`;
          line.fn = config.vm.run(f.fn, name);
        })
        $events.emit('load:functions', this, funcs)
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
    $events.emit('ready', this)
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
      $events.emit('success', this, res)
      return res;
    });
  }
}

module.exports = FBScript;