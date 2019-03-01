const config    = require('./config')
const FBScript  = require('./fb-script')
const FBSocket  = require('./fb-socket')

const fbAgent = {
  config,

  loadScript(txid, opts = {}) {
    const script = new FBScript(txid)

    script
      .loadScript()
      .then(tx    => script.loadFunctions() )
      .then(funcs => script.validateStack() )
      .catch(err  => script.emit('error', err) )

    if (!!opts.run) {
      script.on('ready', s => s.execute() )
    }

    return script;
  },

  runScript(txid) {
    return this.loadScript(txid, { run: true })
  },

  listen(query, opts = {}) {
    const socket = new FBSocket(query)

    socket.on('message', msg => {
      msg.data.forEach(obj => {
        let type;
        const script = new FBScript(obj.tx.h);
        script.afterLoadScript(obj)
        
        switch(msg.type) {
          case 'u':
            type = 'unconfirmed';
            break;
          case 'c':
            type = 'confirmed';
            break;
          default:
            type = msg.type;
            break;
        }

        socket.emit(`tx:${ type }`, script)
        script.loadFunctions()
          .then(funcs => script.validateStack() )
          .catch(err  => script.emit('error', err) )

        if (!!opts.run) {
          script.on('ready', s => s.execute() )
        }
      })
    })

    return socket;
  }

}

module.exports = fbAgent;
