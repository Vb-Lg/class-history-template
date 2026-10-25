import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const chronicle = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content' }),
    schema: z.object({
        title: z.string(),
        date: z.coerce.date(),
        summary: z.string().optional(),
        author: z.string().optional(),
        cover: z.string().optional(),
    }),
});

// 班级歌单：投稿表单生成的 JSON（src/songs/*.json）
const songs = defineCollection({
    loader: glob({ pattern: '**/*.json', base: './src/songs' }),
    schema: z.object({
        title: z.string(),
        artist: z.string(),
        link: z.string().optional(),
        note: z.string().optional(),
        author: z.string().optional(),
        date: z.string().optional(),
    }),
});

export const collections = { chronicle, songs };
