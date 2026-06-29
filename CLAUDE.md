# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Firefly is a feature-rich static blog theme built on **Astro 6** with **Svelte 5** for interactive components. It's a fork of [Fuwari](https://github.com/saicaca/fuwari) extended with extensive features. Primary language is Chinese (Simplified) with i18n for en, zh_TW, ja, ru.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev server at `localhost:4321` |
| `pnpm build` | Production build (icons → LQIPs → Astro build → Pagefind indexing) |
| `pnpm preview` | Preview production build |
| `pnpm check` | `astro check` for type/error checking |
| `pnpm type-check` | `tsc --noEmit --isolatedDeclarations` |
| `pnpm lint` | Biome lint + auto-fix |
| `pnpm format` | Biome format |
| `pnpm new-post <filename>` | Scaffold a new blog post |

Package manager is **pnpm** (enforced). Node.js >= 22 required.

## Architecture

### Astro + Svelte Hybrid

- `.astro` components for static content and layouts
- `.svelte` components for interactive UI (search, settings, pagination, archive) — mounted with `client:load` or `client:visible`
- Swup.js handles SPA-like page transitions with multiple container targets

### Configuration-Driven

All features are toggled/configured via TypeScript files in `src/config/`, exported through the barrel at `src/config/index.ts`. Key configs:

- `siteConfig.ts` — core site settings, theme, pagination
- `sidebarConfig.ts` — sidebar layout (left/right/both, widget ordering)
- `commentConfig.ts`, `analyticsConfig.ts`, `fontConfig.ts`, etc.

### Layout System

- `Layout.astro` — base HTML shell (head, body, theme init, analytics, Swup hooks)
- `MainGridLayout.astro` — full page grid with sidebar(s), navbar, wallpaper, footer

### Content Collections

Defined in `src/content.config.ts`:
- `posts` — blog posts (`.md`/`.mdx`) with frontmatter: title, published, tags, category, draft, pinned, password, comment, etc.
- `spec` — special pages (about, guestbook)

### Key Directories

- `src/components/` — organized by domain: `analytics/`, `comment/`, `common/`, `controls/`, `features/`, `layout/`, `misc/`, `pages/`, `widget/`
- `src/plugins/` — 15 custom remark/rehype plugins (Mermaid, PlantUML, KaTeX, GitHub cards, reading time, etc.)
- `src/i18n/` — translation keys in `i18nKey.ts`, language files in `languages/*.ts`, lookup via `translation.ts`
- `src/utils/` — content sorting, crypto (encrypted posts), date formatting, image processing/LQIP, TOC generation
- `src/pages/` — Astro file-based routing
- `scripts/` — build-time utilities (`generate-icons.js`, `generate-lqips.ts`, `new-post.js`)

### Path Aliases (tsconfig.json)

`@components/*`, `@assets/*`, `@constants/*`, `@utils/*`, `@i18n/*`, `@layouts/*` → `./src/<dir>/*`; `@/*` → `./src/*`

## Code Style

- **Biome** enforces: tab indentation, double quotes, recommended lint rules
- Relaxed rules for `.svelte`/`.astro` files (useConst off, noUnusedVariables off)
- Commit convention: **Conventional Commits** (`feat:`, `fix:`, `chore:`, etc.)

## Build Pipeline

Multi-step: `scripts/generate-icons.js` → `scripts/generate-lqips.ts` → `astro build` → `pagefind --site dist`

Icons/LQIP data are generated into `src/constants/` and committed. Regenerate with `pnpm icons` or `pnpm lqips`.

## Deployment

- **Cloudflare Workers**（主要）— 通过 `@astrojs/cloudflare` 适配器部署，设置 `CF_WORKERS` 环境变量激活，配置见 `wrangler.jsonc`
- Vercel（备选，`vercel.json`）
- 静态输出到 `dist/`

---

## 协作规范

### 行为准则
- **改动前先确认**：涉及删除文件、修改构建配置（`astro.config.mjs`）、改动 `src/config/` 下配置文件时，先说明影响再动手
- **不要自动 commit**：所有 git 操作由用户手动触发，不主动 commit 或 push
- **改动后说明**：每次修改完成后，简要总结改了哪些文件、为什么这样改

### 偏好
- 代码注释使用中文
- 新增组件保持与现有目录结构一致（`src/components/<领域>/`）
- 优先使用项目中已有的工具/插件，不引入新依赖除非必要

### 禁止事项
- 不要修改 `src/constants/` 下自动生成的文件（图标数据、LQIP 数据等），除非知道如何重新生成
- 不要删除或覆盖 `src/content/posts/` 下的博文
- 不要改动 `pnpm-lock.yaml` 除非明确要求

### 外部依赖与服务
- 评论系统：Waline / Giscus / Twikoo，通过 `commentConfig.ts` 切换
- 站内搜索：Pagefind（构建时自动索引）
- 分析统计：Umami / Google Analytics / Clarity，通过 `analyticsConfig.ts` 切换
- 部署：Cloudflare Workers（`@astrojs/cloudflare` + `wrangler.jsonc`）

