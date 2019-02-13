const config      = require('./config')
const FBScript    = require('./fb-script')

const fbAgent = {
  config,

  loadScript(txid) {
    const script = new FBScript(txid)

    script
      .loadScript()
      .then(tx    => script.loadFunctions() )
      .then(funcs => script.validateStack() )
      .catch(err  => script.emit('error', err) )

    return script;
  },

  runScript(txid) {
    const script = this.loadScript(txid)

    script.on('ready', s => s.execute() )

    return script;
  }


}

module.exports = fbAgent;
