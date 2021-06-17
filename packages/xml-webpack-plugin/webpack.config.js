const path = require('path')
const TerserPlugin = require('terser-webpack-plugin')

const isProd = process.env.NODE_ENV === 'production'

module.exports = {
    mode: isProd ? 'production' : 'development',
    target: 'node',
    entry: './src/index.js',
    output: {
        path: path.join(__dirname, 'dist'),
        filename: 'index.js',
        library: {
            type: 'commonjs'
        }
    },
    optimization: {
        minimize: isProd ? true : false,
        minimizer: [
            new TerserPlugin({
                extractComments: false
            })
        ]
    }
}