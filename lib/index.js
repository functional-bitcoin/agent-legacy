const config    = require('./config')
const FBAgent   = require('./fb-agent')
const FBScript  = require('./fb-script')
const FBSocket  = require('./fb-socket')



module.exports = {
  config,

  Agent:  FBAgent,
  Script: FBScript,
  Socket: FBSocket
}
