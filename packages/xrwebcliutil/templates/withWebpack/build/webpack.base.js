const path = require('path');

const CopyWebpackPlugin = require('copy-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const ZipPlugin = require('zip-webpack-plugin')

const { XmlWebpackPlugin } = require('xml-webpack-plugin')

const pkg = require('../package.json')

const config = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, '..', 'dist'),
    filename: 'index.js'
  },
  externals: {
    xrweb: 'commonjs xrweb'
  },
  target: 'node',
  node: false,
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/env']
            ]
          }
        }
      },
      {
        test: /\.(png|jpg|gif|jpeg|webp|tga|svg|eot|ttf|woff|woff2|mp3|mp4|m4a)$/i,
        use: [
          {
            loader: 'file-loader',
            options: {
              esModule: false,
              name: '[path][name].[ext]'
            }
          }
        ],
        exclude: /node_modules/,
      },
      {
        test: /\.(obj|mtl|fbx)$/i, //处理obj中依赖的mlt及mtl中依赖的图片
        use: [
          {
            loader: 'obj-loader',
            options: {
              esModule: false
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new XmlWebpackPlugin({
      file: ['./index.xml', './XRManifest.xml'] //处理index.xml及XRManifest.xml中依赖的资源
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'package.json'
        }
      ]
    }),
    new CleanWebpackPlugin(),
    new ZipPlugin({
      path: "../packed",
      filename: `${pkg.name || 'out'}.${pkg.version || '1.0.0'}.zip`
    })
  ]
};

module.exports = config
