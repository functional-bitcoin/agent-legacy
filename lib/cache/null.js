const nullCache = {
  getScript: () => Promise.resolve(),
  setScript: () => null,
  getFunctions: () => Promise.resolve([]),
  setFunctions: () => null
}

module.exports = nullCache;