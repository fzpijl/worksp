import path from "path";
import fs from "fs";

import { getOptions, interpolateName } from "loader-utils";
import { validate } from "schema-utils";

import schema from "./options.json";
import { normalizePath } from "./utils";

function loader(content) {
  const options = getOptions(this);
  validate(schema, options, {
    name: "Obj Loader",
    baseDataPath: "options",
  });

  const context = options.context || this.rootContext;
  // 将name选项变得不可配置,防止不同目录下的同名资源处理到同一目录下
  const name = "[path][name].[ext]";

  const assetUrl = interpolateName(this, name, {
    context,
    content,
    regExp: options.regExp,
  });

  let outputPath = assetUrl;
  if (options.outputPath) {
    if (typeof options.outputPath === "function") {
      outputPath = options.outputPath(assetUrl, this.resourcePath, context);
    } else {
      outputPath = path.join(options.outputPath, assetUrl);
    }
  }

  let publicPath = `__webpack_public_path__ + ${JSON.stringify(outputPath)}`;
  if (options.publicPath) {
    if (typeof options.publicPath === "function") {
      publicPath = options.publicPath(assetUrl, this.resourcePath, context);
    } else {
      publicPath = `${options.publicPath.endsWith("/")
          ? options.publicPath
          : `${options.publicPath}/`
        }${assetUrl}`;
    }
    publicPath = JSON.stringify(publicPath);
  }

  if (options.postTransformPublicPath) {
    publicPath = options.postTransformPublicPath(publicPath);
  }

  if (typeof options.emitFile === "undefined" || options.emitFile) {
    const assetInfo = {};

    if (typeof name === "string") {
      let normalizedName = name;

      const idx = normalizedName.indexOf("?");

      if (idx >= 0) {
        normalizedName = normalizedName.substr(0, idx);
      }

      const isImmutable = /\[([^:\]]+:)?(hash|contenthash)(:[^\]]+)?]/gi.test(
        normalizedName
      );

      if (isImmutable === true) {
        assetInfo.immutable = true;
      }
    }
    assetInfo.sourceFilename = normalizePath(
      path.relative(this.rootContext, this.resourcePath)
    );
    // 如果是obj资源，处理其依赖的mtl资源
    if (this.resourcePath.endsWith('.obj')) {
      processObjContent(content, this.resourcePath, outputPath, this.emitFile);
    }
    // 如果不是mtl资源，则emit
    if(!this.resourcePath.endsWith('.mtl')){
      this.emitFile(outputPath, content, null, null);
    }
  }

  const esModule =
    typeof options.esModule !== "undefined" ? options.esModule : true;

  return `${esModule ? "export default" : "module.exports ="} ${publicPath};`;
}

export default loader;


// mtllib ./icon_shurufa.mtl

const mtllibReg = /^mtllib(?: |\t)+(.+)$/gm;
function processObjContent(objContent, objPath, destPath, emitFile) {
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
    processMtlContent(mtlContent, mtlPath, destDir, emitFile);
    emitFile(mtlDest, mtlContent, null, null);
  }
}

// map_d ./icon_fg.png

const mapReg = /^(?:\w+)(?: |\t)+(\S+\.[a-z]+)(?: |\t)*$/gim;
function processMtlContent(mtlContent, mtlPath, destDir, emitFile) {
  const srcDir = path.dirname(mtlPath);
  const matches = [...mtlContent.matchAll(mapReg)].map((m) => m[1]);

  for (let i = 0; i < matches.length; i++) {
    const mapPath = path.join(srcDir, matches[i]),
      mapDest = path.join(destDir, matches[i]);
    try {
      const mapContent = fs.readFileSync(mapPath);
      emitFile(mapDest, mapContent, null, null);
    } catch (e) {
      throw new Error(`读取"${mtlPath}"文件中引用的"${mapPath}"文件出错`);
    }
  }
}
