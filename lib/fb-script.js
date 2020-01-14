const EventEmitter  = require('events')
const co            = require('co')
const config        = require('./config')

class FBScript {

  constructor(opts = {}) {
    this.txid     = opts.txid;
    this.tx       = null;
    this.opReturn = null;
    this.ctx      = opts.ctx;
    this.stack    = null;
    this.result   = null;
    this._agent   = opts.agent;
    this._events  = new EventEmitter();
  }

  on(name, callback) {
    this._events.on(name, callback)
    return this;
  }

  emit(name, ...args) {
    this._events.emit(name, ...args)
    return this;
  }

  isValidCmd(cmd) {
    return /^[\w@\/]{1,64}$/.test( cmd );
  }

  buildStack() {
    const chunks = this.opReturn.split(' '),
          oprIdx = chunks.indexOf('OP_RETURN');
    return chunks.splice(oprIdx+1)
      .reduce((stack, h) => {
        const ln  = stack[stack.length-1],
              buf = Buffer.from(h, 'hex');
        if ( !ln.cmd ) {
          // If buf is precisely 32 bytes, then assume it is raw hex
          // Otherwise convert to utf-8 string
          let cmd = buf.toString(buf.length === 32 ? 'hex' : 'utf8')
          if ( !this.isValidCmd(cmd) ) return stack;
          ln.cmd = cmd;
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

  loadScript(opts = {}) {
    return Promise.resolve(opts.force ? null : config.cache.getScript(this.txid))
      .then(res => {
        if (res) return res;
        return config.adapter
          .loadScript(this.txid, opts)
          .then(tx => {
            config.cache.setScript(this.txid, tx)
            return tx;
          })
      })
      .then(tx => {
        this.afterLoadScript(tx)
        this.emit('load:script', this, tx)
        return tx;
      })
  }

  afterLoadScript(tx) {
    this.tx       = tx;
    this.opReturn = config.adapter.parseOpReturn(tx);
    this.stack    = this.buildStack();
  }

  loadFunctions(opts = {}) {
    const cmds = this.stack.map(ln => ln.cmd)
    return Promise.resolve(opts.force ? null : config.cache.getFunctions(cmds))
      .then(res => {
        if ( res.length && !res.includes(null) ) return res;
        const cachedFuncs   = res.filter(r => r && r.h),
              cachedCmds    = cachedFuncs.map(f => f.h),
              unchachedCmds = cmds.filter(c => !cachedCmds.includes(c));
        return config.adapter
          .loadFunctions(unchachedCmds, opts)
          .then(funcs => {
            const cacheArgs = funcs.map(f => [f.h, f]);
            config.cache.setFunctions(cacheArgs)
            return cachedFuncs.concat(funcs);
          })
      })
      .then(funcs => {
        this.afterLoadFunctions(funcs)
        this.emit('load:functions', this, funcs)
        return funcs;
      })
  }

  afterLoadFunctions(funcs) {
    this.stack
      .forEach(ln => {
        const fn    = funcs.find(f => f.h === ln.cmd),
              name  = `${ fn.name }.js`;
        ln.fn = this._agent._vm.run(fn.fn, name);
      })
  }

  validateStack(opts) {
    if (opts) {
      this.stack
        .filter(ln => typeof ln.fn !== 'function')
        .forEach(ln => {
          const i = this.stack.indexOf(ln)
          if (opts.strict) {
            throw new Error(`Invalid stack. Function not found: ${ ln.cmd }`)
          } else {
            this.stack.splice(i, 1)
          }
        })
    }
    this.emit('ready', this)
    return true;
  }

  execute(force) {
    let   ctx     = this.ctx;
    const $agent  = this._agent,
          $script = this,
          stack   = this.stack;
    return co(function *() {
      for (var i = 0; i < stack.length; i++) {
        let ln = stack[i];
        ctx = yield Promise.resolve( ln.fn({ ctx, $agent, $script }, ...ln.args) );
      }
      return ctx;
    })
    .then(res => {
      this.result = res;
      this.emit('success', this, res)
      return res;
    })
  }
}

module.exports = FBScript;