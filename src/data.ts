import fs from "fs/promises";
import Path from "path";

let devMode = process.argv.includes("--main");
let dataPath = Path.join(__dirname, "../data/", devMode ? "debug" : "main");

function getData(path: string) {
    return fs.readFile(Path.join(dataPath, path), "utf-8");
}
function setData(path: string, data: string) {
    return fs.writeFile(Path.join(dataPath, path), data, "utf-8");
}

export { getData, setData };
