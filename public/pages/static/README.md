文章引用的静态资源（封面图、照片、音视频等）放在这个目录，正文里以 `/pages/static/文件名` 引用。

投稿表单上传的封面图也会由后端提交到这个目录（路径见 `functions/api/submit.ts` 的 `MEDIA_DIR`）。
