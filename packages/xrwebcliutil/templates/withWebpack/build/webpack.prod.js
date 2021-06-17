const WebpackObfuscator = require("webpack-obfuscator");
const { merge } = require("webpack-merge");

const baseConfig = require("./webpack.base");

module.exports = merge(baseConfig, {
    mode: "production",
    optimization: {
        minimize: false
    },
    bail: true,
    plugins: [
        new WebpackObfuscator({
            compact: true
        })
    ],
});
