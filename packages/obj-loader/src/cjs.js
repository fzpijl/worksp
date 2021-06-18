const { LoaderOptionsPlugin } = require('webpack')
const loader = require('./index')


module.exports = loader.default
module.exports.raw = true