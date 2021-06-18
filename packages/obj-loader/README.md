# objLoader

#### indenpendent

处理obj资源的webpack loader

遇到fbx资源直接输出;遇到代码中直接引入mtl会忽略，所以不要在代码中直接引用mlt资源

### 作用

项目中使用obj资源时直接通过require('obj path')引入,而obj依赖的mtl资源和mtl依赖的贴图资源会通过loader处理到输出目录中，不用开发者在项目中引入。

### 使用

使用方式和支持的配置项与file-loader相同，配置项的唯一区别在于本loader的name选项不可配置，值为'[path][name].[ext]'