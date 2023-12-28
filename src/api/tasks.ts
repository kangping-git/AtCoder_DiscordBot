import libxmljs from "libxmljs";

async function updateTaskTable() {
    let html = await (await fetch("https://atcoder.jp/contests/")).text();
    let value = await libxmljs.parseHtmlAsync(html);
    let tr = value.find('//div[@id="contest-table-upcoming"]/div/div/table/tbody/tr');
    tr.forEach((val) => {
        // コンテストの開催時間を取得
        let time = new Date(val.find("td[position()=1]/a/time/text()").toString());
        // コンテストの詳細(アルゴリズムコンテストかヒューリスティックコンテストか)を取得
        let contestTypes = val.find("td[position()=2]")[0];
        let ratingType = "algorithm";
        let _ratingType = contestTypes.find("span[position()=1]/text()")[0].toString();
        if (_ratingType == "Ⓗ") {
            ratingType = "heuristic";
        }
        let contestType = "";
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
    });
}

export { updateTaskTable };
