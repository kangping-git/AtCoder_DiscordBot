import { getData, setData } from "../data";
import libxmljs from "libxmljs";

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

let session = "";

async function login() {
    let req = await fetch("https://atcoder.jp/login", {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
        },
        body: null,
        method: "GET",
    });
    let html = await req.text();
    let j = libxmljs.parseHtml(html);
    let _csrfToken = j
        .find("//input[@name='csrf_token']/@value")[0]
        .toString()
        .match(/"[^"]*"/);
    if (_csrfToken) {
        let csrf_token = _csrfToken[0].slice(1, -1);
        const formData = new FormData();
        formData.append("username", process.env.ATCODER_USERNAME as string);
        formData.append("password", process.env.ATCODER_PASSWORD as string);
        formData.append("csrf_token", csrf_token as string);
        let cookie = "";
        for (let i of req.headers.getSetCookie()) {
            let d = i.match(/^[^;]+/);
            if (d) {
                if (cookie) {
                    cookie += "; " + d[0];
                } else {
                    cookie += d[0];
                }
            }
        }
        let login = await fetch("https://atcoder.jp/login?continue=https%3A%2F%2Fatcoder.jp%2Fusers%2Fkangping", {
            headers: {
                "content-type": "application/x-www-form-urlencoded",
                cookie: cookie,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
            },
            body: `username=${encodeURIComponent(String(process.env.ATCODER_USERNAME))}&password=${encodeURIComponent(
                String(process.env.ATCODER_PASSWORD)
            )}&csrf_token=${encodeURIComponent(csrf_token)}`,
            method: "POST",
            redirect: "manual",
        });
        if (login.status == 302) {
            for (let i of login.headers.getSetCookie()) {
                let d = i.split("=");
                if (d) {
                    if (d[0] == "REVEL_SESSION") {
                        session = d.slice(1).join("=");
                    }
                }
            }
        } else {
            console.log("login failed!");
        }
    }
}

function AtCoderFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    if (init.headers) {
        init.headers = Object.assign(init.headers, {
            Cookie: "REVEL_FLASH=; REVEL_SESSION=" + session + ";",
        });
    } else {
        init.headers = {
            Cookie: "REVEL_FLASH=; REVEL_SESSION=" + session + ";",
        };
    }
    // console.log(init);
    return fetch(input, init);
}

async function updateTaskTable() {}

export { atcoderProblems, problems, login, AtCoderFetch, updateTaskTable };
