import { createCanvas, Image } from "canvas";
import crypto from "crypto";

type textTable = {
    type: "text";
    name: string;
    width: number;
    align: "start" | "middle" | "end";
    data: {
        value: string;
        color: string;
    }[];
};
type userTable = {
    type: "user";
    name: string;
    width: number;
    data: {
        name: string;
        rating: number;
    }[];
};

type TableElement = userTable | textTable;
type table = TableElement[];

const getRatingMetalColorCode = (metalColor: number) => {
    switch (metalColor) {
        case 8:
            return { base: "#965C2C", highlight: "#FFDABD" };
        case 9:
            return { base: "#808080", highlight: "white" };
        case 10:
            return { base: "#FFD700", highlight: "white" };
    }
};

let colors = ["#C0C0C0", "#B08C56", "#3FAF3F", "#42E0E0", "#8888FF", "#FFFF56", "#FFB836", "#FF6767"];

const ratingCircleGradient = (id: string, rating: number) => {
    let ratingColor = getRatingColor(rating) - 1;
    if (ratingColor >= 0 && ratingColor <= 7) {
        return `
<linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0%" stop-color="rgba(0,0,0,0)" />
    <stop offset="${100 - (rating % 400) / 4}%" stop-color="rgba(0,0,0,0)" />
    <stop offset="${100 - (rating % 400) / 4}%" stop-color="${colors[ratingColor]}" />
    <stop offset="100%" stop-color="${colors[ratingColor]}" />
</linearGradient>`;
    } else if (ratingColor >= 8 && ratingColor <= 10) {
        let d = getRatingMetalColorCode(ratingColor);
        return `
<linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0%" stop-color="${d?.base}" />
    <stop offset="50%" stop-color="${d?.highlight}" />
    <stop offset="100%" stop-color="${d?.base}" />
</linearGradient>`;
    } else {
        return "";
    }
};

const getRatingColor = (rating: number) => {
    const index = Math.min(Math.floor(rating / 400));
    return index + 1 ? index + 1 : -1;
};

function getCircle(rating: number, x: number, y: number) {
    let ratingColor = getRatingColor(rating) - 1;
    if (ratingColor >= 0 && ratingColor <= 10) {
        let UUID = crypto.randomUUID();
        let borderColor = "";
        if (ratingColor <= 7) {
            borderColor = colors[Math.max(0, ratingColor)];
        } else if (ratingColor >= 8 && ratingColor <= 10) {
            let d = getRatingMetalColorCode(ratingColor);
            borderColor = d?.base as string;
        }
        return {
            gradient: ratingCircleGradient(UUID, rating),
            svg: `<circle fill="url(#${UUID})" r="16" cx="${x}" cy="${y + 5}" stroke="${borderColor}" />`,
            color: colors[Math.min(Math.max(0, ratingColor), 7)],
        };
    }
    return {
        gradient: "",
        svg: `<circle fill="purple" r="16" cx="${x}" cy="${y + 5}" /><text fill="white" x="${x + 5}" y="${y + 5}" text-anchor="middle">?</text>`,
        color: "white",
    };
}

function createTable(title: string, table: table) {
    return new Promise<Buffer>((resolve, reject) => {
        let Table = [];
        let Circles = [];
        let RatingCircleGradient: string[] = [];
        let x = 0;
        let h = 0;
        for (let i in table) {
            if (table[i].type === "user") {
                let data = table[i].data as userTable["data"];
                let svg = [];
                let y = 52;
                for (let j in data) {
                    let circleData = getCircle(data[j].rating, x + 20, y);
                    RatingCircleGradient.push(circleData.gradient);
                    Circles.push(circleData.svg);
                    svg.push(`<tspan x="${x + 40}" y="${y + 15}" fill="${circleData.color}">${data[j].name}</tspan>`);
                    y += 35;
                }
                svg.push(`<tspan x="0" y="0" fill="rgba(0,0,0,0)">empty</tspan>`);
                Table.push('<text font-size="30">\n' + svg.join("\n") + "\n</text>");
                x += table[i].width;
                h = Math.max(h, y);
            } else if (table[i].type === "text") {
                let data = table[i] as textTable;
                let svg = [];
                let y = 12;
                let X = x;
                if (data.align == "middle") {
                    X = X + data.width / 2;
                } else if (data.align == "end") {
                    X = X + data.width;
                }
                for (let j in data.data) {
                    svg.push(`<tspan x="${X}" y="${y + 15}" fill="${data.data[j].color}" text-anchor="${data.align}">${data.data[j].value}</tspan>`);
                    y += 35;
                }
                svg.push(`<tspan x="0" y="0" fill="rgba(0,0,0,0)">empty</tspan>`);
                Table.push('<text font-size="30">\n' + svg.join("\n") + "\n</text>");
                x += data.width;
                h = Math.max(h, y);
            }
        }
        let svgCode = `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${h}" font-family="monospace"><rect x="0" y="0" width="${x}" height="${h}" fill="#222"/>${RatingCircleGradient.join(
            ""
        )}<g><text font-size="30" x="${x / 2}" y="30" fill="white" text-anchor="middle">${title}</text>${Table.join("\n")}</g>${Circles.join("\n")}</svg>`;
        const canvas = createCanvas(x, h);
        const ctx = canvas.getContext("2d");
        const image = new Image();
        image.onload = () => {
            ctx.drawImage(image, 0, 0);
            resolve(canvas.toBuffer());
        };
        image.onerror = (e) => {
            console.log(svgCode);
        };
        image.src = "data:image/svg," + svgCode;
    });
}

export { createTable, textTable, userTable };
