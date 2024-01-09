import { AtCoderFetch } from "./getProblems";

type ranking = {
    Fixed: boolean;
    AdditionalColumns: null;
    TaskInfo: {
        Assignment: string;
        TaskName: string;
        TaskScreenName: string;
    }[];
    StandingsData: {
        Rank: number;
        Additional: null;
        UserName: string;
        UserScreenName: string;
        UserIsDeleted: boolean;
        Affiliation: string;
        Country: string;
        Rating: number;
        OldRating: number;
        IsRated: boolean;
        IsTeam: boolean;
        Competitions: number;
        AtCoderRank: number;
        TaskResults: {
            [keys: string]: {
                Count: number;
                Failure: number;
                Penalty: number;
                Score: number;
                Elapsed: number;
                Status: number;
                Pending: boolean;
                Frozen: boolean;
                Additional: null;
            };
        };
        TotalResult: {
            Count: number;
            Failure: number;
            Penalty: number;
            Score: number;
            Elapsed: number;
            Status: number;
            Frozen: boolean;
            Additional: null;
        };
    }[];
    Translation: {};
};

async function getRanking(contestId: string) {
    let rawData: ranking = await (await AtCoderFetch("https://atcoder.jp/contests/" + contestId + "/standings/json")).json();
    return rawData;
}

export { getRanking, ranking };
