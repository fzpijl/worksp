const fs = require("fs");
const path = require("path");

const { validate } = require('schema-utils')

const schema = require("./options.json")

class XmlWebpackPlugin {
  static defaultOptions = {
    file: ['index.xml', 'XRManifest.xml']
  };

  constructor(options = {}) {
    validate(schema, options, {
      name: "XML Plugin",
      baseDataPath: "options",
    });
    this.options = { ...XmlWebpackPlugin.defaultOptions, ...options };
  }

  apply(compiler) {
    const pluginName = XmlWebpackPlugin.name;
    const { webpack } = compiler;
    const { Compilation } = webpack;
    const { RawSource } = webpack.sources;

    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      compilation.hooks.additionalAssets.tapAsync(pluginName, async (cb) => {
        const files = await getFiles(this.options.file, compiler.context);
        Object.entries(files).map(([p, c]) => {
          const rawSource = new RawSource(c)
          compilation.emitAsset(p, rawSource);

          if (p.endsWith('.obj')) {
            processObjContent(c, path.join(compiler.context, p), p, compilation.emitAsset.bind(compilation), RawSource)
          }
        });
        cb()
      })
    });
  }
}
async function getFiles(entry, context) {
  const entries = typeof entry === "string" ? [entry] : entry;
  const res = {};

  const promises = entries.map(async (resource) => {
    const resourcePath = path.join(context, resource);
    const resourceContent = fs.readFileSync(resourcePath, "utf-8");
    res[resource] = resourceContent;
    await getDeps(resourceContent, resourcePath, res)
  });

  await Promise.all(promises)
  return res;
}
//  <Model src="./statics/models/bg/fenwei.obj" scale="[10,10,10]" />
//  <icon default="images/unknow.png" running="images/unknow.png" preview="images/unknow.png" />
//匹配index.xml中的src和XRManifest.xml中的icon标签的default、running和preview属性
const makeAttrReg = (arr) => new RegExp(`\\s*(?:${arr.join('|')})\\s*=\\s*('|")(.+?)\\1`, 'gs')
const srcReg = makeAttrReg(['src'])
const iconAttrReg = makeAttrReg(['default', 'running', 'preview'])
const iconReg = /\<icon\s+[^]*?\/?\>/g

async function getDeps(content, contentPath, res) {
  const dir = path.dirname(contentPath), matches = []
  if (content.search(srcReg) > -1) {
    matches.push(...[...content.matchAll(srcReg)].map(m => m[2]))
  }
  if (content.search(iconReg) > -1) {
    //假定只有一个XRManifest中只有一个icon标签
    const iconTag = content.match(iconReg)[0]
    matches.push(...[...iconTag.matchAll(iconAttrReg)].map(m => m[2]))
  }

  const promises = matches.map(async m => {
    res[m] = await fs.promises.readFile(path.join(dir, m))
  })
  await Promise.all(promises)
}

// mtllib ./icon_shurufa.mtl

const mtllibReg = /^mtllib(?: |\t)+(.+)$/gm;
function processObjContent(objContent, objPath, destPath, emitAsset, RawSource) {
  if (typeof objContent !== "string") objContent = objContent.toString()

  const srcDir = path.dirname(objPath),
    destDir = path.dirname(destPath);
  const matches = [...objContent.matchAll(mtllibReg)].map((m) => m[1].trim());

  for (let i = 0; i < matches.length; i++) {
    const mtlPath = path.join(srcDir, matches[i]),
      mtlDest = path.join(destDir, matches[i]);
    let mtlContent;
    try {
      mtlContent = fs.readFileSync(mtlPath, "utf-8");
    } catch (e) {
      throw new Error(`读取"${objPath}"文件中引用的"${mtlPath}"文件出错`);
    }
    emitAsset(mtlDest, new RawSource(mtlContent));
    processMtlContent(mtlContent, mtlPath, destDir, emitAsset, RawSource);

  }
}

// map_d ./icon_fg.png

const mapReg = /^(?:\w+)(?: |\t)+([^ \t]+\.[a-z]+)(?: |\t)*$/gim;
function processMtlContent(mtlContent, mtlPath, destDir, emitAsset, RawSource) {

  const srcDir = path.dirname(mtlPath);
  const matches = [...mtlContent.matchAll(mapReg)].map((m) => m[1]);

  for (let i = 0; i < matches.length; i++) {
    const mapPath = path.join(srcDir, matches[i]),
      mapDest = path.join(destDir, matches[i]);
    try {
      const mapContent = fs.readFileSync(mapPath);
      emitAsset(mapDest, new RawSource(mapContent));
    } catch (e) {
      throw new Error(`读取"${mtlPath}"文件中引用的"${mapPath}"文件出错`);
    }
  }
}
module.exports = { XmlWebpackPlugin };
