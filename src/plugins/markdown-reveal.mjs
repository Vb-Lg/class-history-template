/* ================= markdown → HTML 时自动补 .reveal =================
   Astro 7 默认使用 Sätteri 处理器，这里是一个 Sätteri 的 hast 插件：
   在 markdown 转成 HTML 之后，给正文最外层的块级元素补上 .reveal，
   交给 /js/pages.js 的 IntersectionObserver 做错峰入场。

   这样文章的 markdown 源文件保持干净，不用手写任何 class。 */

// 需要入场动画的块级元素。
const BLOCK_TAGS = [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "ul",
    "ol",
    "blockquote",
    "pre",
    "table",
    "figure",
    "details",
    "summary",
];

/** 把 "reveal" 追加到已有 class 上（class 可能是数组或字符串）。 */
function withReveal(current) {
    const list = Array.isArray(current)
        ? current.slice()
        : typeof current === "string" && current.trim()
          ? current.trim().split(/\s+/)
          : [];
    if (!list.includes("reveal")) list.push("reveal");
    return list;
}

export default {
    name: "reveal",
    element: {
        // 由 Sätteri 在 Rust 侧按标签名过滤，只有这些元素会进到 visit
        filter: BLOCK_TAGS,
        visit(node, ctx) {
            // 只标注正文最外层：嵌套的 li、blockquote 里的 p、内层 ul 等
            // 跟着外层一起出现，再各自加一层会重复播放、时序也会互相错开。
            const parent = ctx.parent(node);
            if (parent && parent.type !== "root" && !(node.tagName === "summary" && parent.tagName === "details")) return;
            ctx.setProperty(node, "className", withReveal(node.properties?.className));
        },
    },
};
