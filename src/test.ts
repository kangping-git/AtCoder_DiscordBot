import { getRanking, ranking } from "./api/ranking";
import { login } from "./api/getProblems";
import { createTable, textTable, userTable } from "./images/table";
import fs from "fs";
import { config } from "dotenv";
config();

type APref = {
    [keys: string]: number;
};

let colors = ["#C0C0C0", "#B08C56", "#3FAF3F", "#42E0E0", "#8888FF", "#FFFF56", "#FFB836", "#FF6767"];

const finf = bigf(400);

function bigf(n: number): number {
    let pow1 = 1;
    let pow2 = 1;
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; ++i) {
        pow1 *= 0.81;
        pow2 *= 0.9;
        numerator += pow1;
        denominator += pow2;
    }
    return Math.sqrt(numerator) / denominator;
}

function f(n: number): number {
    return ((bigf(n) - finf) / (bigf(1) - finf)) * 1200.0;
}

function calcAlgRatingFromLast(last: number, perf: number, ratedMatches: number): number {
    if (ratedMatches === 0) return perf - 1200;
    last += f(ratedMatches);
    const weight = 9 - 9 * 0.9 ** ratedMatches;
    const numerator = weight * 2 ** (last / 800.0) + 2 ** (perf / 800.0);
    const denominator = 1 + weight;
    return Math.log2(numerator / denominator) * 800.0 - f(ratedMatches + 1);
}

function calcPerf(i: ranking["StandingsData"][0], rankingOnlyRated: ranking["StandingsData"], APerf: APref, Memo: Map<number, number>, maxPerf: number) {
    let r = i.Rank;
    let upper = 6144;
    let lower = -2048;
    while (upper - lower > 0.5) {
        let mid = (upper + lower) / 2;
        let rateTemp = calcRating(rankingOnlyRated, APerf, mid, 1200, Memo);
        if (r > rateTemp) {
            upper = mid;
        } else {
            lower = mid;
        }
    }

    let mid = Math.round((lower + upper) / 2);
    if (mid <= 400) {
        mid = Math.round(400 / Math.E ** ((400 - mid) / 400));
    }

    mid = Math.min(maxPerf, mid);

    return mid;
}

function ordinal_suffix_of(i: number) {
    let j = i % 10,
        k = i % 100;
    if (j === 1 && k !== 11) {
        return i + "st";
    }
    if (j === 2 && k !== 12) {
        return i + "nd";
    }
    if (j === 3 && k !== 13) {
        return i + "rd";
    }
    return i + "th";
}

function calcRating(Ranking: ranking["StandingsData"], APref: APref, X: number, defaultAPref: number, memo: Map<number, number>): number {
    let memoData = memo.get(X);
    if (memoData) {
        return memoData;
    }
    let sum = 0.5;
    for (let i in Ranking) {
        let APref_val = APref[Ranking[i].UserScreenName];
        sum += 1.0 / (1.0 + Math.pow(6.0, (X - (APref_val ? APref_val : defaultAPref)) / 400.0));
    }
    memo.set(X, sum);
    return sum;
}

async function main() {
    await login();

    let contestID = "agc065";
    let rankingRaw = await getRanking(contestID);
    let ranking = rankingRaw.StandingsData;
    let userList = ["tourist", "kangping", "jikky1618"];
    ranking = ranking.filter((value) => {
        return userList.includes(value.UserScreenName.toLowerCase());
    });
    let rankingServerPlaceData: textTable["data"] = [];
    let rankingPlaceData: textTable["data"] = [];
    let rankingPerfData: userTable["data"] = [];
    let rankingUserData: userTable["data"] = [];
    let rankingOldRate: userTable["data"] = [];
    let rankingNewRate: userTable["data"] = [];
    let rankingSub: textTable["data"] = [];
    let rankingUserRated: textTable["data"] = [];

    let maxPerf = 1e100;
    let APerf: APref = await (await fetch("https://data.ac-predictor.com/aperfs/" + contestID + ".json")).json();

    let rankingOnlyRated = rankingRaw.StandingsData.filter((val) => val.IsRated);

    // 順位の正規化
    let rankMap: { [keys: number]: number } = {};
    for (let i of rankingOnlyRated) {
        if (i.Rank in rankMap) {
            rankMap[i.Rank] += 1;
        } else {
            rankMap[i.Rank] = 1;
        }
    }
    let nowRank = 1;
    let RankToRealRank: {
        Rank: number;
        realRank: number;
    }[] = [];
    for (let i = 0; i < rankingOnlyRated.length; ) {
        let rankCount = rankMap[rankingOnlyRated[i].Rank];
        RankToRealRank.push({ Rank: rankingOnlyRated[i].Rank, realRank: nowRank + (rankCount - 1) / 2 });
        for (let j = 0; j < rankCount; ++j) {
            rankingOnlyRated[i + j].Rank = nowRank + (rankCount - 1) / 2;
        }
        nowRank += rankCount;
        i += rankCount;
    }

    rankingOnlyRated.sort((a, b) => a.Rank - b.Rank);

    let Memo = new Map<number, number>();

    for (let i = 0; i < ranking.length; ++i) {
        rankingServerPlaceData.push({ color: "#fff", value: ordinal_suffix_of(i + 1) });
        rankingPlaceData.push({ color: "#fff", value: ordinal_suffix_of(ranking[i].Rank) });
        rankingUserData.push({ rating: ranking[i].Rating, name: ranking[i].UserScreenName });
        let perf = -1;
        if (ranking[i].IsRated) {
            let rankingIndex = rankingOnlyRated.findIndex((value) => {
                return value.UserScreenName == ranking[i].UserScreenName;
            });
            perf = calcPerf(rankingOnlyRated[rankingIndex], rankingOnlyRated, APerf, Memo, maxPerf);
        } else {
            let lower = 0;
            let upper = RankToRealRank.length;
            while (upper - lower > 1) {
                let mid = Math.floor((upper + lower) / 2);
                if (RankToRealRank[mid].Rank > ranking[i].Rank) {
                    upper = mid;
                } else {
                    lower = mid;
                }
            }
            let mid = lower;
            let copy = { ...ranking[i] };
            copy.Rank = RankToRealRank[mid].realRank;
            perf = calcPerf(copy, rankingOnlyRated, APerf, Memo, maxPerf);
        }
        let oldRate = ranking[i].OldRating;
        rankingOldRate.push({
            name: oldRate.toString(),
            rating: oldRate,
        });
        let newRate = Math.round(calcAlgRatingFromLast(ranking[i].OldRating, perf, ranking[i].Competitions));
        rankingNewRate.push({
            name: newRate.toString(),
            rating: newRate,
        });
        rankingSub.push({
            value: (newRate - oldRate >= 0 ? "+" : "") + (newRate - oldRate).toString(),
            color: "white",
        });
        rankingUserRated.push({
            value: ranking[i].IsRated ? "Yes" : "No",
            color: ranking[i].IsRated ? "white" : "gray",
        });
        rankingPerfData.push({
            name: perf.toString(),
            rating: perf,
        });
    }

    fs.writeFileSync(
        "./test.png",
        await createTable(
            contestID + "ランキング",
            [
                {
                    type: "text",
                    name: "鯖順位",
                    width: 100,
                    align: "end",
                    data: rankingServerPlaceData,
                },
                {
                    type: "text",
                    name: "全体順位",
                    width: 120,
                    align: "end",
                    data: rankingPlaceData,
                },
                {
                    type: "user",
                    name: "ユーザー",
                    width: 300,
                    data: rankingUserData,
                },
                {
                    type: "user",
                    name: "パフォ",
                    width: 140,
                    data: rankingPerfData,
                },
                {
                    type: "user",
                    name: "OldRate",
                    width: 140,
                    data: rankingOldRate,
                },
                {
                    type: "user",
                    name: "NewRate",
                    width: 140,
                    data: rankingNewRate,
                },
                {
                    type: "text",
                    name: "差分",
                    width: 140,
                    align: "middle",
                    data: rankingSub,
                },
                {
                    type: "text",
                    name: "Rated",
                    width: 120,
                    align: "middle",
                    data: rankingUserRated,
                },
            ],
            true
        )
    );
}

main();
