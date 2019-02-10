const { NodeVM }  = require('vm2')
const bitdb       = require('./adapters/bitdb')

const vm = new NodeVM();

const config = {
  adapter: bitdb,
  vm
}

module.exports = config;