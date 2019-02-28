const nullCache = {
  getScript: () => Promise.resolve(),
  setScript: () => null,
  getFunctions: () => Promise.resolve([]),
  setFunctions: () => null,
  getResult: () => Promise.resolve(),
  setResult: () => null
}

module.exports = nullCache;