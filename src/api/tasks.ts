import { timeEnd } from "console";
import libxmljs from "libxmljs";

interface contestData {
    contest: string;
    startTime: Date;
    contestTime: number;
    endTime: Date;
    type: "Algorithm" | "Heuristic";
    url: string;
    contestType: "" | "abc" | "arc" | "agc";
}

async function updateTaskTable() {
    let html = await (await fetch("https://atcoder.jp/contests/")).text();
    let value = await libxmljs.parseHtmlAsync(html);
    let tr = value.find('//div[@id="contest-table-upcoming"]/div/div/table/tbody/tr|//div[@id="contest-table-action"]/div/div/table/tbody/tr');
    let tasks: contestData[] = [];
    tr.forEach((val) => {
        // コンテストの開催時間を取得
        let time = new Date(val.find("td[position()=1]/a/time/text()").toString());
        // コンテストの詳細(アルゴリズムコンテストかヒューリスティックコンテストか)を取得
        let contestTypes = val.find("td[position()=2]")[0];
        let ratingType: contestData["type"] = "Algorithm";
        let _ratingType = contestTypes.find("span[position()=1]/text()")[0].toString();
        if (_ratingType == "Ⓗ") {
            ratingType = "Heuristic";
        }
        let contestType: contestData["contestType"] = "";
        let _contestType = contestTypes.find("span[position()=2]/@class")[0].toString().trim();
        if (_contestType == 'class="user-blue"') {
            contestType = "abc";
        } else if (_contestType == 'class="user-orange"') {
            contestType = "arc";
        } else if (_contestType == 'class="user-red"') {
            contestType = "agc";
        }
        // コンテスト名&URLを取得
        let _contestName = contestTypes.find("a")[0];
        let contestName = _contestName.find("text()").toString();
        let contestURL = _contestName.find("@href").toString().split("=")[1].slice(1, -1);
        // コンテスト時間を取得
        let _duration = val.find("td[position()=3]/text()").toString().split(":");
        let duration = Number(_duration[1]);
        duration += Number(_duration[0]) * 60;
        // コンテスト終了時間を取得
        let timeEnd = new Date(time.getTime() + duration * 60 * 1000);
        // レーティング範囲を取得
        let ratingRange = [0, Number.MAX_SAFE_INTEGER];
        let _ratingRange = val.find("td[position()=4]/text()").toString().trim();
        if (_ratingRange != "All") {
            if (_ratingRange == "-") {
                ratingRange = [-Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER];
            } else {
                let _ratingRange_ = _ratingRange.split("-").map((v) => v.trim());
                if (_ratingRange_[0] != "") {
                    ratingRange[0] = Number(_ratingRange_[0]);
                }
                if (_ratingRange_[1] != "") {
                    ratingRange[1] = Number(_ratingRange_[1]);
                }
            }
        }
        tasks.push({
            contest: contestName,
            startTime: time,
            contestTime: duration,
            endTime: timeEnd,
            type: ratingType,
            url: contestURL,
            contestType: contestType,
        });
    });
    return tasks;
}

export { updateTaskTable };
