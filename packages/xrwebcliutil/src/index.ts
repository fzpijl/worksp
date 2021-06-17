import chalk from "chalk";
import FormData from "form-data";
import * as os from "os";
import * as path from "path";
import * as fs from "fs-extra";
import validateNpmName from "validate-npm-package-name";
import * as cp from "child_process";
import EventEmitter from "events";
import { obfuscate } from "javascript-obfuscator";
import glob from "glob";

import { getPackageName, makeZip } from "./util";
import { TInputOptions } from "javascript-obfuscator/src/types/options/TInputOptions";

type outputLoggerMsg = (msg: any, ...optionalMsg: any[]) => void;
const writeJSONOpt = { spaces: 2 };
const tmpDir = path.join(getHomeDir() as string, ".xrwebcliutil");
fs.ensureDirSync(tmpDir);

export interface CustomLogger {
  log: outputLoggerMsg;
  warn: outputLoggerMsg;
  error: outputLoggerMsg;
}
const defaultLogger: CustomLogger = {
  log: (msg: any, ...optionalMsg: any[]) => console.log(msg, ...optionalMsg),
  warn: (msg: any, ...optionalMsg: any[]) =>
    console.warn(chalk.yellow("Warn: "), msg, ...optionalMsg),
  error: (msg: any, ...optionalMsg: any[]) =>
    console.error(chalk.red("Error: "), msg, ...optionalMsg),
};
export class CliHelper extends EventEmitter {
  constructor(public logger: CustomLogger) {
    super();
    this.logger = logger;
  }
  validateProjectName(name: string): boolean {
    const res = validateNpmName(name);
    if (!res.validForNewPackages) {
      res.errors && res.errors.forEach((e) => this.logger.error(e));
      return false;
    }
    res.warnings && res.warnings.forEach((w) => this.logger.warn(w));
    return true;
  }
  //需要包含XRManifest.xml和package.json文件
  validate(projectRoot: string): boolean {
    const xmlPath = path.join(projectRoot, "XRManifest.xml"),
      jsonPath = path.join(projectRoot, "package.json");
    if (!fs.existsSync(xmlPath)) {
      throw new Error(
        `${chalk.cyan("XRManifest.xml")} file is needed in your project`
      );
    }
    if (!fs.existsSync(jsonPath)) {
      throw new Error(
        `${chalk.cyan("package.json")} file is needed in your project`
      );
    }
    return true;
  }
  async create(projectRoot: string, tmpl: string) {
    const tmplDir = path.join(__dirname, "templates", tmpl);
    await fs.copy(tmplDir, projectRoot);
    //修改package.json中的name字段
    const jsonPath = path.join(projectRoot, "package.json");
    const json = await fs.readJSON(jsonPath);
    json.name = path.basename(projectRoot);
    await fs.writeJSON(jsonPath, json, writeJSONOpt);
  }
  async pack(projectRoot: string, isDev: boolean = false): Promise<string> {
    const webpackConfig = path.join(projectRoot, "build", "webpack.base.js");
    if (fs.pathExistsSync(webpackConfig)) {
      return await this.packWebpack(projectRoot, webpackConfig, isDev);
    } else {
      return isDev
        ? await this.packPlain(projectRoot)
        : await this.packWithObfuscator(projectRoot);
    }
  }
  private async packWebpack(
    projectRoot: string,
    webpackConfig: string,
    isDev: boolean
  ): Promise<string> {
    eval(`delete require.cache[webpackConfig]`);
    let config;
    try {
      config = eval(`require(webpackConfig)`); //直接require会被webpack处理
    } catch (error) {
      throw new Error("check if you have installed dependencies");
    }
    const distPath = path.join((config.output && config.output.path) || "dist");
    const hasDist = await new Promise((resolve, reject) => {
      const packProcess = cp.spawn("npm", ["run", isDev ? "dev" : "build"], {
        cwd: projectRoot,
      });
      packProcess.on("error", (e) => {
        reject(e);
      });
      packProcess.on("close", (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          reject(
            new Error(
              "webpack 打包失败，请检查webpack的配置项，试试在本地命令行是否可以正常打包"
            )
          );
        }
      });
    });
    if (hasDist && fs.existsSync(distPath)) {
      const packName = await getPackageName(projectRoot);
      const toZipPath = path.join(projectRoot, "packed", packName);
      // const ziped = await makeZip(distPath, toZipPath);
      return toZipPath;
    } else {
      throw new Error(
        "webpack 打包失败，请检查webpack的配置项，试试在本地命令行是否可以正常打包"
      );
    }
  }
  private async packWithObfuscator(projectRoot: string): Promise<string> {
    const tmp = await copyToTmp(projectRoot);
    await obfuscateCode(tmp);
    const packName = await getPackageName(projectRoot);
    const toZipPath = path.join(projectRoot, "packed", packName);
    const ziped = await makeZip(tmp, toZipPath);
    await fs.removeSync(tmp);
    return ziped;
  }
  private async packPlain(projectRoot: string): Promise<string> {
    const packName = await getPackageName(projectRoot);
    const toZipPath = path.join(projectRoot, "packed", packName);
    const ziped = await makeZip(projectRoot, toZipPath);
    return ziped;
  }
  async push(
    projectRoot: string,
    ip = "127.0.0.1",
    isDev: boolean = false
  ): Promise<void> {
    const uploadUrl = `http://${ip}:8081/app/upload`;

    let packed;
    try {
      this.emit("packStart"); //通过事件将进度传递出去
      packed = await this.pack(projectRoot, isDev);
    } catch (error) {
      this.emit("packEnd");
      throw error;
    }

    await this.upload(packed, uploadUrl);
  }
  private async upload(file: string, url: string) {
    await new Promise((resolve, reject) => {
      this.emit("loadStart");
      const form = new FormData();
      form.append("file", fs.createReadStream(file));

      form.submit(url, (err) => {
        this.emit("loadEnd");
        if (err) {
          reject(
            new Error(
              `上传失败，请确保设备已与本机建立连接并且irisApp处于运行状态`
            )
          );
        } else {
          resolve("");
        }
      });
    });
  }
}

export const cliHelper = new CliHelper(defaultLogger);

export function getHomeDir() {
  switch (process.platform) {
    case "win32":
      return process.env["USERPROFILE"];
    case "linux":
    case "darwin":
      return os.homedir();
    default:
      throw Error("Unsupported platform");
  }
}
async function copyToTmp(src: string) {
  const dirs = await fs.readdir(src),
    dist = path.join(tmpDir, "tmpdir");
  await Promise.all(
    dirs.map(async (dir) => {
      if (
        dir === "node_modules" ||
        dir === "dist" ||
        dir === "packed" ||
        dir === ".git" ||
        dir === ".vscode" ||
        dir === "build"
      )
        return;
      await fs.copy(path.join(src, dir), path.join(dist, dir));
    })
  );
  return dist;
}

async function obfuscateCode(src: string) {
  return new Promise<void>((resolve, reject) => {
    glob(
      "**/*.js",
      {
        cwd: src,
        ignore: ["node_modules/**"],
      },
      async (err, files) => {
        if (err) reject(err);
        await Promise.all(
          files.map(async (file) => {
            file = path.join(src, file);
            await obfuscateFile(file);
          })
        );
        resolve();
      }
    );
  });
}
const obfuscateOpt: TInputOptions = {
  compact: true,
  sourceMap: false,
  sourceMapMode: "separate",
  target: "node",
};
async function obfuscateFile(file: string) {
  const source = await fs.readFile(file, "utf8");

  try {
    const result = obfuscate(source, obfuscateOpt);
    await fs.writeFile(file, result.getObfuscatedCode());
  } catch (e) {
    const babel = require("@babel/core");
    const transformedCode = babel.transform(source, {
      presets: [
        ['@babel/env']
      ],
      cwd: path.join(__dirname, '..')
    }).code;
    const result = obfuscate(transformedCode, obfuscateOpt);
    await fs.writeFile(file, result.getObfuscatedCode());
  }
}

export { makeZip };
