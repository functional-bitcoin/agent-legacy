const axios = require('axios')

// Functional Bitcoin protocol prefix
const protocolPrefix = '1AKyFQWGGrpj1Nwp6H6uUEercQP213zj3P';

// Bitdb Genesis node
const genesis = axios.create({
  baseURL: 'https://genesis.bitdb.network/q/1FnauZ9aUH2Bex6JzdcV4eNX7oLSSEbxtN/'
})

// Bitdb Babel node
const babel = axios.create({
  baseURL: 'https://babel.bitdb.network/q/1DHDifPvtPgKFPZMRSxmVHhiPvFmxZwbfh/'
})

if (typeof btoa !== 'function') {
  function btoa(str) {
    return Buffer.from(str.toString(), 'binary')
      .toString('base64');
  }
}

const bitdb = {
  key: null,
  genesis,
  babel,

  loadScriptBitdb: babel,
  loadFunctionsBitdb: babel,


  loadScriptQry(txid) {
    return {
      'v': 3,
      'q': {
        'find': {
          'tx.h': txid,
          'out.b0.op': 106
        },
        'limit': 1
      },
      'r': {
        //'f': '[.[] | { h: .tx.h, blk: .blk, out: [.out[] | { op: .b0.op, str: .str, e: .e }] }]'
        'f': '[.[] | { h: .tx.h, blk: .blk, out: [.out[]] }]'
      }
    }
  },

  loadScript(txid) {
    const query   = this.loadScriptQry(txid),
          path    = btoa(JSON.stringify(query)),
          headers = { key: this.key };

    return this.loadScriptBitdb
      .get(path, { headers })
      .then(r => {
        const tx = r.data.u.concat(r.data.c)[0];
        if (!tx) throw new Error('Transaction script not found.');
        return tx;
      })
  },

  loadFunctionsQry(cmds) {
    //const fnQuery = cmds.map(cmd => {
    //  const [name, txid] = cmd.split('@');
    //  return {
    //    'tx.h': { '$regex': `^${txid}` },
    //    'out.s2': name
    //  }
    //})
    return {
      'v': 3,
      'q': {
        'find': {
          'tx.h': { '$in': cmds },
          'out.s1': protocolPrefix,
          //'$or': fnQuery
        },
        'limit': cmds.length
      },
      'r': {
        'f': '[.[] | { h: .tx.h, a: .in[0].e.a, name: .out[0].s2, fn: .out[0] | (.ls3 // .s3), v: .out[0].s4 }]'
      }
    }
  },

  loadFunctions(cmds) {
    const query   = this.loadFunctionsQry(cmds),
          path    = btoa(JSON.stringify(query)),
          headers = { key: this.key };

    return this.loadFunctionsBitdb
      .get(path, { headers })
      .then(r => r.data.u.concat(r.data.c));
  },

  parseOpReturn(tx) {
    const out = tx.out.find(o => o.b0.op === 106);
    if (out.str) return out.str;
    const vals = Object.keys(out)
      .filter(k => /^l?h\d+$/.test(k))
      .sort((a, b) => {
        const n1 = a.match(/\d+/)[0],
              n2 = b.match(/\d+/)[0];
        return n1 - n2;
      })
      .map(k => out[k])
    vals.unshift('OP_RETURN')
    return vals.join(' ')
  },

}

module.exports = bitdb;