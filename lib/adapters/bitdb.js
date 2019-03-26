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

  find(query, opts) {
    const path    = this._encodeQuery(query),
          url     = this[opts.db].q + path,
          headers = { key: this.key };

    console.log('using db', opts.db)

    return axios.get(url, { headers })
  },

  openSocket(query, opts = {}) {
    const path  = this._encodeQuery(query),
          url   = this[opts.db || 'genesis'].s + path;

    return new EventSource(url);
  },

  loadScript(txid, opts = {}) {
    const options = {
      db: 'genesis',
      ...opts
    }
    const query = {
      "v": 3,
      "q": {
        "find": { "tx.h": txid, "out.b0.op": 106 },
        "limit": 1
      },
      "r": {
        "f": "[.[] | { tx: .tx, blk: .blk, out: [.out[] | { op: .b0.op, str: (.str // .), e: .e }] }]"
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
      db: 'babel',
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
    const out = tx.out.find(o => o.op === 106);
    // Genesis gives an output string, babel we need to reconstruct it
    if (typeof out.str === 'string') return out.str;
    const vals = Object.keys(out.str)
      .filter(k => /^l?h\d+$/.test(k))
      .sort((a, b) => {
        const n1 = a.match(/\d+/)[0],
              n2 = b.match(/\d+/)[0];
        return n1 - n2;
      })
      .map(k => out.str[k])
    vals.unshift('OP_RETURN')
    return vals.join(' ')
  },

  _encodeQuery(query) {
    return Buffer.from(JSON.stringify(query)).toString('base64')
  }
}

module.exports = bitdb;