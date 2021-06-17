import * as path from 'path'
import * as fs from 'fs-extra'
import JSZip, { filter } from 'jszip'

export async function getPackageName(projectRoot: string): Promise<string> {
    try {
        const json = await fs.readJSON(path.join(projectRoot, 'package.json'))
        return `${json.name || 'out'}.${json.version || '1.0.0'}.zip`
    } catch (error) {
        return 'out.1.0.0.zip'
    }
}

export async function makeZip(source: string, destName: string) {
    const zip = new JSZip()
    const destDir = path.dirname(destName)
    await fs.ensureDir(destDir)
    const stats = await fs.lstat(source);
    if (stats.isDirectory()) {
        //以.开头和packed文件不处理
        let dirs = fs.readdirSync(source).filter(f => f !== 'packed' && !f.startsWith('.')).map((d) => path.join(source, d));
        dirs.forEach((f) => {
            
            let stats = fs.statSync(f);
            if (stats.isDirectory()) {
                zipFolder(zip, f);
            } else if(stats.isFile()) {
                zipFile(zip, f);
            }
        });
    } else {
        zipFile(zip, source);
    }
    await new Promise((resolve, reject) => {
        zip
            .generateNodeStream({
                type: "nodebuffer",
                streamFiles: true,
            })
            .pipe(fs.createWriteStream(destName))
            .on("finish", resolve)
            .on('error', reject)
    });

    return destName;
}
function zipFile(zip: any, file: string) {
    const bname = path.basename(file);
    const content = fs.readFileSync(file);
    zip.file(bname, content);
}
function zipFolder(zip: any, foler: string) {
    const bname = path.basename(foler),
        newZip = zip.folder(bname);
    //.开头的文件不处理
    const dirs = fs.readdirSync(foler).filter((f) => !f.startsWith('.')).map((d) => path.join(foler, d));
    dirs.forEach((f) => {
        let stats = fs.statSync(f);
        if (stats.isDirectory()) {
            zipFolder(newZip, f);
        } else {
            zipFile(newZip, f);
        }
    });
}