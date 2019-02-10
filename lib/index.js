const config      = require('./config')
const FBScript    = require('./fb-script')

const fbAgent = {
  config,

  loadScript(txid) {
    const script = new FBScript(txid)

    script
      .loadScript()
      .then(tx => {
        script.emit('load:script', tx)
        return script.loadFunctions()
      })
      .then(funcs => {
        script.emit('load:functions', funcs)
        script.emit('ready')
      })
      .catch(err => {
        script.emit('error', err)
      })

    return script;
  }
}

module.exports = fbAgent;
