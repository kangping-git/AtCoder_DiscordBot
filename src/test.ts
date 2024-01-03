import { getRanking } from "./api/ranking";
import { login } from "./api/getProblems";
import { config } from "dotenv";
config();

async function main() {
    await login();
    console.log(await getRanking("abc335"));
}

main();
