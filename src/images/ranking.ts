import { getHistory } from "../api/getUserHistory";
import { getRanking, ranking } from "../api/ranking";
import { contestData } from "../api/tasks";
import { createTable, textTable, userTable } from "./table";
import { config } from "dotenv";
config();

type APref = {
    [keys: string]: number;
};

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

function calcAlgRatingFromLast({ oldRating, perf, ratedMatches }: { oldRating: number; perf: number; ratedMatches: number }): number {
    if (ratedMatches === 0) return perf - 1200;
    oldRating += f(ratedMatches);
    const weight = 9 - 9 * 0.9 ** ratedMatches;
    const numerator = weight * 2 ** (oldRating / 800.0) + 2 ** (perf / 800.0);
    const denominator = 1 + weight;
    return Math.log2(numerator / denominator) * 800.0 - f(ratedMatches + 1);
}

async function calcHeuristicRatingFromHistory(username: string, perf: number) {
    let history_raw = await getHistory(username);
    let history = history_raw
        .filter((val) => val.IsRated)
        .map((value) => {
            return value.Performance;
        });
    history.push(perf);
    history.reverse();
    const S = 724.4744301;
    const R = 0.8271973364;
    const qs: number[] = [];
    for (const perf of history) {
        for (let i = 1; i <= 100; i++) {
            qs.push(perf - S * Math.log(i));
        }
    }
    qs.sort((a, b) => b - a);

    let num = 0.0;
    let den = 0.0;
    for (let i = 99; i >= 0; i--) {
        num = num * R + qs[i];
        den = den * R + 1.0;
    }
    return num / den;
}

function calcPerf(i: ranking["StandingsData"][0], rankingOnlyRated: ranking["StandingsData"], APerf: APref, Memo: Map<number, number>, defaultAPref: number) {
    let r = i.Rank;
    let upper = 6144;
    let lower = -2048;
    while (upper - lower > 0.5) {
        let mid = (upper + lower) / 2;
        let rateTemp = calcRating({ Ranking: rankingOnlyRated, APref: APerf, X: mid, defaultAPref: defaultAPref, memo: Memo });
        if (r > rateTemp) {
            upper = mid;
        } else {
            lower = mid;
        }
    }

    let mid = (lower + upper) / 2;
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

function calcRating({
    Ranking,
    APref,
    X,
    defaultAPref,
    memo,
}: {
    Ranking: ranking["StandingsData"];
    APref: APref;
    X: number;
    defaultAPref: number;
    memo: Map<number, number>;
}): number {
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

async function CreateContestRanking(contestData: contestData, userList: string[], rankingRaw: ranking, APerf: APref) {
    let contestID = contestData.contestID;
    let ranking = rankingRaw.StandingsData;
    ranking = ranking.filter((value) => {
        return userList.includes(value.UserScreenName.toLowerCase());
    });
    let rankingServerPlaceData: textTable["data"] = [];
    let rankingPlaceData: textTable["data"] = [];
    let rankingPerfData: userTable["data"] = [];
    let rankingPerfNoLimitData: userTable["data"] = [];
    let rankingUserData: userTable["data"] = [];
    let rankingOldRate: userTable["data"] = [];
    let rankingNewRate: userTable["data"] = [];
    let rankingSub: textTable["data"] = [];
    let rankingUserRated: textTable["data"] = [];
    let rankingScores: textTable[] = [];

    let maxPerf = contestData.ratingRange[1] + 401;
    let defaultAPerf = 0;
    if (contestData.type == "Heuristic") {
        defaultAPerf = 1000;
    } else {
        let changeDate = new Date("2019-05-25");
        switch (contestData.contestType) {
            case "abc":
                defaultAPerf = 800;
                break;
            case "arc":
                if (contestData.startTime < changeDate) {
                    defaultAPerf = 1600;
                } else {
                    defaultAPerf = 1000;
                }
                break;
            case "agc":
                if (contestData.startTime < changeDate) {
                    defaultAPerf = 1600;
                } else {
                    defaultAPerf = 1200;
                }
                break;
        }
    }

    let rankingOnlyRated = rankingRaw.StandingsData.filter((val) => val.IsRated);
    if (contestData.type == "Heuristic") {
        rankingOnlyRated = rankingOnlyRated.filter((val) => val.TotalResult.Count);
    }

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
            rankingOnlyRated[i + j] = { ...rankingOnlyRated[i + j] };
            rankingOnlyRated[i + j].Rank = nowRank + (rankCount - 1) / 2;
        }
        nowRank += rankCount;
        i += rankCount;
    }

    rankingOnlyRated.sort((a, b) => a.Rank - b.Rank);
    rankingScores.push({
        align: "middle",
        data: [],
        type: "text",
        width: contestData.type == "Heuristic" ? 250 : 90,
        name: "Total",
    });

    for (let i of rankingRaw.TaskInfo) {
        rankingScores.push({
            align: "middle",
            data: [],
            type: "text",
            width: contestData.type == "Heuristic" ? 250 : 90,
            name: i.Assignment,
        });
    }

    let Memo = new Map<number, number>();

    for (let i = 0; i < ranking.length; ++i) {
        rankingServerPlaceData.push({ color: "#fff", value: ordinal_suffix_of(i + 1) });
        rankingPlaceData.push({ color: "#fff", value: ordinal_suffix_of(ranking[i].Rank) });
        rankingUserData.push({ rating: ranking[i].Rating, name: ranking[i].UserScreenName });
        let rawPerf = -1;
        let heuristic = true;
        if (contestData.type == "Heuristic") {
            heuristic = ranking[i].TotalResult.Count > 0;
        }
        if (ranking[i].IsRated && heuristic) {
            let rankingIndex = rankingOnlyRated.findIndex((value) => {
                return value.UserScreenName == ranking[i].UserScreenName;
            });
            rawPerf = calcPerf(rankingOnlyRated[rankingIndex], rankingOnlyRated, APerf, Memo, defaultAPerf);
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
            rawPerf = calcPerf(copy, rankingOnlyRated, APerf, Memo, defaultAPerf);
        }
        let oldRate = ranking[i].Rating;
        let perf = Math.round(rawPerf);
        if (rawPerf <= 400) {
            perf = Math.round(400 / Math.E ** ((400 - rawPerf) / 400));
        }
        rankingPerfNoLimitData.push({
            name: perf.toString(),
            rating: perf,
        });
        perf = Math.min(maxPerf, perf);
        rankingOldRate.push({
            name: oldRate.toString(),
            rating: oldRate,
        });

        let newRate = 0;
        if (contestData.type == "Heuristic") {
            newRate = await calcHeuristicRatingFromHistory(ranking[i].UserScreenName, perf);
        } else {
            newRate = calcAlgRatingFromLast({ oldRating: ranking[i].Rating, perf: perf, ratedMatches: ranking[i].Competitions });
        }

        if (newRate <= 400) {
            newRate = Math.round(400 / Math.E ** ((400 - newRate) / 400));
        } else {
            newRate = Math.round(newRate);
        }

        rankingNewRate.push({
            name: newRate.toString(),
            rating: newRate,
        });
        rankingSub.push({
            value: (newRate - oldRate >= 0 ? '<tspan fill="#92ff7f">+' : '<tspan fill="#ff7f7f">') + (newRate - oldRate).toString() + "</tspan>",
            color: "white",
        });
        rankingUserRated.push({
            value: ranking[i].IsRated && heuristic ? "Yes" : "No",
            color: ranking[i].IsRated && heuristic ? "white" : "gray",
        });
        rankingPerfData.push({
            name: perf.toString(),
            rating: perf,
        });
        rankingScores[0].data.push({
            value:
                ranking[i].TotalResult.Score / 100 +
                (ranking[i].TotalResult.Penalty ? '<tspan fill="#f33">(' + ranking[i].TotalResult.Penalty + ")</tspan>" : ""),
            color: "white",
        });
        let index = 1;
        for (let j of rankingRaw.TaskInfo) {
            let score = "";
            if (ranking[i].TaskResults[j.TaskScreenName]) {
                if (ranking[i].TaskResults[j.TaskScreenName].Score != 0) {
                    score = (ranking[i].TaskResults[j.TaskScreenName].Score / 100).toString();
                    if (ranking[i].TaskResults[j.TaskScreenName].Penalty) {
                        score += '<tspan fill="#f33">(' + ranking[i].TaskResults[j.TaskScreenName].Penalty + ")</tspan>";
                    }
                } else {
                    score = "";
                    if (ranking[i].TaskResults[j.TaskScreenName].Count) {
                        score += '<tspan fill="#f33">(' + ranking[i].TaskResults[j.TaskScreenName].Count + ")</tspan>";
                    }
                }
            } else {
                score = "-";
            }
            rankingScores[index].data.push({
                value: score,
                color: "white",
            });
            ++index;
        }
    }
    return await createTable(
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
            ...rankingScores,
            {
                type: "user",
                name: "パフォ",
                width: 140,
                data: rankingPerfData,
            },
            {
                type: "user",
                name: "OldRate",
                width: 130,
                data: rankingOldRate,
            },
            {
                type: "user",
                name: "NewRate",
                width: 130,
                data: rankingNewRate,
            },
            {
                type: "text",
                name: "差分",
                width: 80,
                align: "middle",
                data: rankingSub,
            },
            {
                type: "user",
                name: "RealPerf",
                width: 100,
                data: rankingPerfNoLimitData,
            },
            {
                type: "text",
                name: "Rated",
                width: 90,
                align: "middle",
                data: rankingUserRated,
            },
        ],
        true
    );
}

export { CreateContestRanking, APref };
