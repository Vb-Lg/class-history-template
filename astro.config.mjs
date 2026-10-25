// @ts-check
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import markdownReveal from './src/plugins/markdown-reveal.mjs';

// https://astro.build/config
export default defineConfig({
    markdown: {
        // Astro 7 的默认 markdown 处理器是 Sätteri（@astrojs/markdown-remark
        // 已不再默认安装）。这里在它的 hast 阶段挂上插件，让 markdown 转
        // HTML 时自动给正文段落补 .reveal，源文件不用手写 class。
        processor: satteri({ features: { rawHtml: true }, hastPlugins: [markdownReveal] }),
    },
});
