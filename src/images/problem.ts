import { createTable, userTable } from "./table";
import { problems } from "../api/getProblems";

function createProblemTable(problem: problems["keys"]) {
    let r: userTable["data"] = [];
    for (let i in problem.problems) {
        r.push({
            name: problem.problems[i].name,
            rating: Number(problem.problems[i].difficulty),
        });
    }
    return createTable(problem.contestId + "のdiff", [
        {
            type: "user",
            name: "users",
            width: 600,
            data: r,
        },
    ]);
}

export { createProblemTable };
