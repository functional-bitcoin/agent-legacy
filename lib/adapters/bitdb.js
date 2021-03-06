const axios = require('axios')
const EventSource = require('eventsource')

// Functional Bitcoin protocol prefix
const protocolPrefix = '1AKyFQWGGrpj1Nwp6H6uUEercQP213zj3P';

const bitdb = {
  key: null,

  babel: {
    q: 'https://babel.bitdb.network/q/1DHDifPvtPgKFPZMRSxmVHhiPvFmxZwbfh/',
    s: 'https://babel.bitdb.network/s/1DHDifPvtPgKFPZMRSxmVHhiPvFmxZwbfh/'
  },

  data: {
    q: 'https://data.bitdb.network/q/1KuUr2pSJDao97XM8Jsq8zwLS6W1WtFfLg/',
    s: 'https://data.bitdb.network/s/1KuUr2pSJDao97XM8Jsq8zwLS6W1WtFfLg/'
  },

  genesis: {
    q: 'https://genesis.bitdb.network/q/1FnauZ9aUH2Bex6JzdcV4eNX7oLSSEbxtN/',
    s: 'https://genesis.bitdb.network/s/1FnauZ9aUH2Bex6JzdcV4eNX7oLSSEbxtN/'
  },

  neongenesis: {
    q: 'https://neongenesis.bitdb.network/q/1HcBPzWoKDL2FhCMbocQmLuFTYsiD73u1j/',
    s: 'https://neongenesis.bitdb.network/s/1HcBPzWoKDL2FhCMbocQmLuFTYsiD73u1j/'
  },

  find(query, opts) {
    const path    = this._encodeQuery(query),
          url     = this[opts.db].q + path,
          headers = { key: this.key };

    return axios.get(url, { headers })
  },

  openSocket(query, opts = {}) {
    const path  = this._encodeQuery(query),
          url   = this[opts.db || 'neongenesis'].s + path;

    return new EventSource(url);
  },

  loadScript(txid, opts = {}) {
    const options = {
      db: 'neongenesis',
      ...opts
    }
    const query = {
      "v": 3,
      "q": {
        "find": {
          "tx.h": txid,
          "$or": [
            {"out.b0.op": 106},
            {"out.b1.op": 106}
          ]
        },
        "limit": 1
      },
      "r": {
        "f": "[.[] | { tx: .tx, blk: .blk, out: .out }]"
      }
    }
    return this.find(query, options)
      .then(r => {
        const tx = r.data.u.concat(r.data.c)[0];
        if (!tx) throw new Error('Transaction script not found.');
        return tx;
      })
  },

  loadFunctions(cmds, opts = {}) {
    const options = {
      db: 'neongenesis',
      ...opts
    }
    const query = {
      "v": 3,
      "q": {
        "find": { "tx.h": { "$in": cmds }, "out.s1": protocolPrefix, },
        "limit": cmds.length
      },
      "r": {
        "f": "[.[] | { h: .tx.h, a: .in[0].e.a, name: .out[0].s2, fn: .out[0] | (.ls3 // .s3), v: .out[0].s4 }]"
      }
    }
    return this.find(query, options)
      .then(r => r.data.u.concat(r.data.c));
  },

  parseTx(tx) {
    return {
      txid: tx.tx.h,
      tx: tx,
      opReturn: this.parseOpReturn(tx)
    }
  },

  parseOpReturn(tx) {
    const out = tx.out.find(o => {
      return Object.values(o).some(v => v.op === 106)
    });
    // Genesis gives an output string, babel we need to reconstruct it
    if (typeof out.str === 'string') return out.str;

    const nums = Object.keys(out)
      .filter(k => /\d+$/.test(k))
      .map(k => k.match(/(\d+)$/)[1])

    const max = Math.max(...nums),
          vals = [];

    for (let i = 0; i <= max; i++) {
      let o = out[`b${ i }`]
      if (!(o && o.hasOwnProperty('op'))) {
        const v = out[`lh${ i }`] || out[`h${ i }`] || 0;
        vals.push(v)
      }
    }

    vals.unshift('OP_RETURN')
    return vals.join(' ')
  },

  _encodeQuery(query) {
    return Buffer.from(JSON.stringify(query)).toString('base64')
  }
}

module.exports = bitdb;