//入口文件

/**
 * app 代表了一个正在运行的程序实例，提供了方法来创建和访问程序运行时必不可少的资源。
 * 如可以通过 app.createWindow 来创建 Window，可以通过 app.createElement 来创建
 * Image、Text、Light、Layout 等 UI元素，还可以通过app.getDisplay 、app.getInputManager 
 * 等获取系统资源。
 */
const { app } = require('xrweb')