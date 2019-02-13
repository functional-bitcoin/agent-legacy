const { NodeVM }  = require('vm2')
const bitdb       = require('./adapters/bitdb')
//const redisCache  = require('./cache/redis')
const nullCache  = require('./cache/null')


const config = {
  adapter: bitdb,
  cache: nullCache,
  env: {}
}

config.vm = new NodeVM({
  sandbox: {
    env: config.env
  }
});

module.exports = config;