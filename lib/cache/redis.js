const { promisify } = require('util')
const redis         = require('redis')

const redisCache = {
  prefix: 'FB',
  expiry: 2628000,
  client: null,

  connect(...args) {
    this.client     = redis.createClient(...args)
    this.getAsync   = promisify(this.client.get).bind(this.client)
    this.mgetAsync  = promisify(this.client.mget).bind(this.client)
  },

  buildKey(...args) {
    return [this.prefix, ...args].join(':')
  },

  getScript(txid) {
    const key = this.buildKey('S', txid);
    return this.getAsync(key)
      .then(res => {
        if (res) return JSON.parse(res);
      })
  },

  setScript(txid, tx) {
    const key = this.buildKey('S', txid),
          payload = JSON.stringify(tx);
    return this.client.setex(key, this.expiry, payload)
  },

  getFunctions(txids) {
    const keys = txids.map(txid => this.buildKey('F', txid))
    return this.mgetAsync(keys)
      .then(res => {
        if (res.length) return res.map(payload => JSON.parse(payload));
      });
  },

  setFunctions(args) {
    const multi = this.client.multi();
    args.forEach(a => {
      const key = this.buildKey('F', a[0]),
            payload = JSON.stringify(a[1]);
      multi.setex(key, this.expiry, payload)
    })
    return multi.exec()
  }
}

module.exports = redisCache;