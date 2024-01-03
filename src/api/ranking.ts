import { AtCoderFetch } from "./getProblems";

async function getRanking(contestId: string) {
    let rawData = await (await AtCoderFetch("https://atcoder.jp/contests/" + contestId + "/standings/json")).json();
    return rawData;
}

export { getRanking };
