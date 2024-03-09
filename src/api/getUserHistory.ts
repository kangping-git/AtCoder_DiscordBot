type history = {
    IsRated: boolean;
    Place: number;
    OldRating: number;
    NewRating: number;
    Performance: number;
    InnerPerformance: number;
    ContestScreenName: string;
    ContestName: string;
    ContestNameEn: string;
    EndTime: string;
};

const cache = new Map<string, { time: number; history: history[] }>();

export async function getHistory(username: string) {
    let cache_data = cache.get(username);
    if (cache_data && cache_data.time + 60 * 1000 * 15 > new Date().getTime()) {
        return cache_data.history;
    }
    let url = "https://atcoder.jp/users/" + username + "/history/json?contestType=heuristic";
    try {
        let history: history[] = await (await fetch(url)).json();
        cache.set(username, {
            time: new Date().getTime(),
            history: history,
        });
        await new Promise((resolve, reject) => setTimeout(resolve, 500));
        return history;
    } catch (e) {
        return [];
    }
}
