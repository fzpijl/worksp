const path = require('path')
const TerserPlugin = require('terser-webpack-plugin')

const isProd = process.env.NODE_ENV === 'production'

module.exports = {
    mode: isProd ? 'production' : 'development',
    target: 'node',
    entry: './src/cjs.js',
    output: {
        path: path.join(__dirname, 'dist'),
        filename: 'index.js',
        library: {
            type: 'commonjs2'
        }
    },
    optimization: {
        minimize: isProd,
        minimizer: [
            new TerserPlugin({
                extractComments: false // 禁止生成license文件
            })
        ]
    }
}