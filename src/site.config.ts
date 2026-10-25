/** 班级信息：改这一个文件即可完成大部分定制，各页面会自动引用。 */
export const SITE = {
    /** 班级全名，如 "30届1班" */
    className: "XX届X班",
    /** 班级简称，用于留言框占位符等口语场景，如 "1班" */
    classShort: "X班",
    /** 顶栏 logo 方块里显示的字符，如 "1" */
    brandMark: "X",
    /** 首屏徽章文字，如 "CLASS 1 · FOREVER" */
    heroBadge: "CLASS XX · FOREVER",
    /** 首页「班级简介」区块的统计数字 */
    stats: {
        /** 同学 */
        students: 40,
        /** 年时光 */
        years: 3,
        /** 个日夜 */
        days: 1000,
        /** + 回忆（值为 999 时会自动显示加号） */
        memories: 999,
    },
} as const;
