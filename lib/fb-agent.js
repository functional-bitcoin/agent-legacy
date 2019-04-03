const { NodeVM }    = require('vm2')
const config        = require('./config')
const FBScript      = require('./fb-script')
const FBSocket      = require('./fb-socket')

class FBAgent {

  constructor(opts = {}) {
    this.options = {
      transforms: config.transforms,
      sandbox: config.sandbox,
      freeze: config.freeze,
      loadScript: {},
      loadFunctions: {},
      validate: { strict: true }
    }
    Object.keys(this.options)
      .filter(k => Object.keys(opts).includes(k))
      .forEach(k => {
        this.options[k] = {
          ...this.options[k],
          ...opts[k]
        }
      })
    this._initVM()
  }

  loadScript(txid, opts = {}) {
    const script = new FBScript({ txid, ctx: opts.ctx, agent: this });

    script
      .loadScript({ ...this.options.loadScript, ...opts.loadScript })
      .then(tx    => script.loadFunctions({ ...this.options.loadFunctions, ...opts.loadFunctions }) )
      .then(funcs => script.validateStack({ ...this.options.validate, ...opts.validate }) )
      .catch(err  => script.emit('error', err) )

    script.on('load:script', this._protocolTransforms)
    if (!!opts.run) script.on('ready', s => s.execute());

    return script;
  }

  runScript(txid, opts = {}) {
    return this.loadScript(txid, { ...opts, run: true })
  }

  openSocket(query, opts = {}) {
    const socket = new FBSocket(query) 

    socket.on('message', msg => {
      msg.data.forEach(obj => {
        const txid = obj.tx.h,
              script = new FBScript({ txid, ctx: opts.ctx, agent: this });
        script.afterLoadScript(obj)
        this._protocolTransforms(script)

        if      (msg.type === 'u')  { socket.emit(`tx:unconfirmed`, script) }
        else if (msg.type === 'c')  { socket.emit(`tx:confirmed`, script) }
        else                        { socket.emit(`tx:${ msg.type }`, script) }

        script.loadFunctions({ ...this.options.loadFunctions, ...opts.loadFunctions })
          .then(funcs => script.validateStack({ ...this.options.validate, ...opts.validate }) )
          .catch(err  => script.emit('error', err) )

        if (!!opts.run) {
          script.on('ready', s => s.execute() )
        }
      })
    })

    return socket;
  }

  _initVM() {
    this._vm = new NodeVM({
      sandbox: { ...this.options.sandbox }
    })
    Object.keys(this.options.freeze).forEach(key => {
      this._vm.freeze(this.options.freeze[key], key)
    })
  }

  _protocolTransforms(script) {
    const transforms = script._agent.options.transforms;
    script.stack
      .filter(ln => Object.keys(transforms).includes(ln.cmd))
      .forEach(ln => ln.cmd = transforms[ln.cmd])
  }
}

module.exports = FBAgent;