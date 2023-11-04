import { getData, setData } from "../data";

async function getJSON(input: RequestInfo, init?: RequestInit | undefined) {
    try {
        return await (await fetch(input, init)).json();
    } catch (e) {
        return {};
    }
}

type contest = {
    id: string;
    start_epoch_second: number;
    duration_second: number;
    title: string;
    rate_change: string;
};
type problem = {
    id: string;
    contest_id: string;
    problem_index: string;
    name: string;
    title: string;
};
type problemModel = {
    slope?: number;
    intercept?: number;
    variance?: number;
    difficulty?: number;
    discrimination?: number;
    irt_loglikelihood?: number;
    irt_users?: number;
    is_experimental: boolean;
};
type problems = {
    [keys: string]: {
        contestId: string;
        title: string;
        problems: {
            [keys: string]: {
                id: string;
                contest_id: string;
                problem_index: string;
                name: string;
                title: string;
                difficulty: number | null;
            };
        };
    };
};
type APerf = {
    [keys: string]: number;
};

let APerfCache: {
    [keys: string]: APerf;
} = {};

let getDifficulty = (difficulty: number) => {
    return Math.round(difficulty >= 400 ? difficulty : 400 / Math.exp(1.0 - difficulty / 400));
};

async function atcoderProblems(): Promise<problems> {
    let contests: contest[] = await getJSON("https://kenkoooo.com/atcoder/resources/contests.json");
    let problems: problem[] = await getJSON("https://kenkoooo.com/atcoder/resources/problems.json");
    let problemModel: { [keys: string]: problemModel } = await getJSON("https://kenkoooo.com/atcoder/resources/problem-models.json");
    let data: problems = {};
    for (let i of contests) {
        if (!(i.id in APerfCache)) {
            APerfCache[i.id] = {};
        }
        data[i.id] = {
            contestId: i.id,
            title: i.title,
            problems: {},
        };
    }

    for (let i of problems) {
        data[i.contest_id].problems[i.problem_index] = {
            id: i.id,
            contest_id: i.contest_id,
            problem_index: i.problem_index,
            name: i.name,
            title: i.title,
            difficulty: problemModel[i.id] ? (problemModel[i.id].difficulty ? Number(problemModel[i.id].difficulty) : null) : null,
        };
        let difficulty = data[i.contest_id].problems[i.problem_index].difficulty;
        if (difficulty != null) {
            data[i.contest_id].problems[i.problem_index].difficulty = getDifficulty(difficulty);
        }
    }

    return data;
}

export { atcoderProblems, problems };
