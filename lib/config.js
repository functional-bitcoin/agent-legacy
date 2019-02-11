const { NodeVM }  = require('vm2')
const bitdb       = require('./adapters/bitdb')


const config = {
  adapter: bitdb,
  env: {}
}

config.vm = new NodeVM({
  sandbox: {
    env: config.env
  }
});

module.exports = config;