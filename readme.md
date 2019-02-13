[![license](https://img.shields.io/github/license/functional-bitcoin/library.svg)](https://github.com/functional-bitcoin/library/blob/master/license.md)

# Functional Bitcoin :: Agent

A node module for fetching and executing Functional Bitcoin scripts.

## Installation

```console
$ yarn add @functional-bitcoin/agent@beta
```

## Usage

```javascript
const fbAgent = require('@functional-bitcoin/agent')

fbAgent.runScript(txid)
  .on('load:script', (script, tx) => {
    // Callback after script TX has been loaded
    // `script.tx` contains the whole tx so is possible to
    // check all outputs and other tx attributes
  })
  .on('load:functions', (script, funcs) => {
    // Callback after all functions have been loaded,
    // but prior to script being validated
  })
  .on('success', (script, res) => {
    console.log('Result:', res)
  })
  .on('error', (script, err) => {
    console.log('Error:', err)
  })

```

### Compatibility with Bitcom protocols

Bitcom protocols are identified using a 25-byte Bitcoin address as the prefix for a protocol, whereas Functional Bitcoin scripts rely on a 32 byte TXID to reference a function. It is possible transform Bitcom address prefixes into valid function references using the following approach:

```javascript
const prefixTransforms = {
  // b:// protocal prefix               // bfile/new function
  '19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut': '5f94a325c835ac0fcc89370061c6a63b305b2c6cf3d2fe002d264e98dbd44ac2'

}

fbAgent.runScript(txid)
  .on('load:script', (script) => {
    script.stack
      .filter(ln => Object.keys(prefixTransforms).includes(ln.cmd))
      .forEach(ln => ln.cmd = prefixTransforms[ln.cmd])
  })
  .on('success', (script) => {
    console.log('B:// file:', script.result)
  })
```

### Function sandbox

Functions are executed within a sandboxed node VM, which by default has access to very little of the agent's environment. A function cannot access environment variables, or overwrite global functions.

It is expected that functions remain small, simple and self contained, and the agent application itself be responsible for handling and responding to the output of a script.

However, it is possible to manually expose objects to the sandbox, and so opt-in to sharing external libraries and environment variables with the functions executed within a script.

```javascript
const datapay = require('datapay')

fbAgent.config.env.datapay = datapay;
fbAgent.config.env.privKey = process.env.PRIVATE_KEY;

// functions can now access `env.datapay` and `env.privKey`
fbAgent.runScript(txid)
```

Using this approach it is entirely possible for a function to create a new transaction, and for multiple agents to autonomously interract by sending scripts to one another.

