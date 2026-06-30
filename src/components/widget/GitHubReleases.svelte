<script lang="ts">
	import { onMount } from "svelte";
	import { scale } from "svelte/transition";
	import Icon from "@/components/common/Icon.svelte";

	interface Asset { name: string; size: number; browser_download_url: string; download_count: number; }
	interface Release { id: number; tag_name: string; name: string; published_at: string; html_url: string; body: string; assets: Asset[]; }
	interface Repo { owner: string; repo: string; label: string; desc?: string; cover?: string; prerequisite?: { name: string; url: string; }; }

	export let repos: Repo[] = [];
	const PER_PAGE = 10;

	let view: "grid" | "detail" = "grid";
	let activeRepo = 0;

	let dataMap: Record<string, { loading: boolean; error: string; releases: Release[]; currentPage: number }> = {};

	function k(o: string, r: string) { return o + "/" + r; }

	async function load(owner: string, repo: string) {
		const key = k(owner, repo);
		if (dataMap[key]?.releases?.length) return;
		dataMap[key] = { loading: true, error: "", releases: [], currentPage: 1 };
		dataMap = dataMap;
		try {
			// 将原始 API 数据映射为 Release
			const mapRel = (r: any): Release => ({
				id: r.id, tag_name: r.tag_name, name: r.name || r.tag_name,
				published_at: r.published_at, html_url: r.html_url,
				body: (r.body || "").slice(0, 500),
				assets: (r.assets || []).map((a: any) => ({
					name: a.name, size: a.size,
					browser_download_url: a.browser_download_url,
					download_count: a.download_count,
				})),
			});

			const seen = new Set<number>();
			const all: Release[] = [];

			// 1) 先用 /releases/latest 拿最新版本（列表 API 有 CDN 缓存延迟，可能漏掉刚发布的版本）
			const latestRes = await fetch(
				`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest`,
				{ headers: { Accept: "application/vnd.github+json" }, cache: "no-cache" },
			);
			if (latestRes.ok) {
				const latest = mapRel(await latestRes.json());
				all.push(latest);
				seen.add(latest.id);
			}

			// 2) 再拉取分页列表，去重后追加
			let page = 1; const pp = 100; let more = true;
			while (more) {
				const res = await fetch(
					`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=${pp}&page=${page}`,
					{ headers: { Accept: "application/vnd.github+json" }, cache: "no-cache" },
				);
				if (!res.ok) throw new Error(`GitHub API ${res.status}`);
				const d: Release[] = await res.json();
				for (const r of d) {
					if (!seen.has(r.id)) { all.push(mapRel(r)); seen.add(r.id); }
				}
				if (d.length < pp) more = false; else page++;
			}

			dataMap[key] = { loading: false, error: "", releases: all, currentPage: 1 };
		} catch (e: any) {
			dataMap[key] = { loading: false, error: e?.message || "加载失败", releases: [], currentPage: 1 };
		}
		dataMap = dataMap;
	}

	function goDetail(i: number) {
		activeRepo = i; view = "detail"; expandedRelease = null;
		const r = repos[i];
		if (r) load(r.owner, r.repo);
	}
	function goGrid() { view = "grid"; }

	function getPage(state: typeof dataMap[string]) {
		if (!state?.releases) return [];
		return state.releases.slice((state.currentPage - 1) * PER_PAGE, state.currentPage * PER_PAGE);
	}
	function totalPages(state: typeof dataMap[string]) { return state?.releases ? Math.ceil(state.releases.length / PER_PAGE) : 0; }
	function goPage(owner: string, repo: string, page: number) {
		const key = k(owner, repo);
		if (dataMap[key]) { dataMap[key].currentPage = page; dataMap = dataMap; expandedRelease = null; }
	}

	const ADJ = 2, VIS = ADJ * 2 + 1;
	function getPages(t: number, c: number): number[] {
		const H = -1; let l = c, r = c, n = 1;
		while (0 < l - 1 && r + 1 <= t && n + 2 <= VIS) { n += 2; l--; r++; }
		while (0 < l - 1 && n < VIS) { n++; l--; }
		while (r + 1 <= t && n < VIS) { n++; r++; }
		const p: number[] = [];
		if (l > 1) p.push(1);
		if (l === 3) p.push(2);
		if (l > 3) p.push(H);
		for (let i = l; i <= r; i++) p.push(i);
		if (r < t - 2) p.push(H);
		if (r === t - 2) p.push(t - 1);
		if (r < t) p.push(t);
		return p;
	}
	function fmtSize(b: number): string {
		if (b < 1024) return b + " B";
		if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
		if (b < 1073741824) return (b / 1048576).toFixed(1) + " MB";
		return (b / 1073741824).toFixed(2) + " GB";
	}
	function fmtDate(d: string): string {
		return new Date(d).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
	}

	let expandedRelease: number | null = null;
	function toggleRelease(id: number) { expandedRelease = expandedRelease === id ? null : id; }

	// 测速
	const NODES = [
		{ name: "美国通用节点", prefix: "https://proxy.gitwarp.top/" },
		{ name: "韩国节点", prefix: "http://kr2-proxy.gitwarp.top:9980/" },
		{ name: "香港节点", prefix: "http://gh.halonice.com/" },
		{ name: "直连", prefix: "" },
	];
	let dm = false, dt = false, df = "";
	let nr: { name: string; speed: number; url: string; status: string }[] = [];

	function estSpeed(l: number): number {
		if (l < 300) return 2500; if (l < 500) return 1500; if (l < 1000) return 800;
		if (l < 2000) return 300; if (l < 5000) return 100; return 20;
	}
	async function ping(u: string, to = 3000): Promise<number> {
		const s = performance.now(), ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), to);
		try { await fetch(u + (u.includes("?") ? "&" : "?") + "_t=" + Date.now(), { method: "HEAD", mode: "no-cors", signal: ctrl.signal }); } catch {}
		clearTimeout(t); return Math.round(performance.now() - s);
	}
	async function testNode(prefix: string, url: string) {
		const l1 = await ping(prefix + url, 8000);
		if (l1 >= 8000) return { ok: false, speed: 0 };
		const pings = [l1];
		for (let i = 0; i < 2; i++) { await new Promise(r => setTimeout(r, 100)); pings.push(await ping(prefix + url, 3000)); }
		const v = pings.filter(p => p < 10000);
		if (!v.length) return { ok: false, speed: 0 };
		const med = v.slice().sort((a, b) => a - b)[Math.floor(v.length / 2)];
		let sp = estSpeed(med);
		if (Math.max(...v) > med * 3) sp = Math.round(sp * 0.6);
		return { ok: true, speed: sp };
	}
	async function hd(url: string, name: string) {
		df = name; dm = true; dt = true;
		nr = NODES.map(n => ({ name: n.name, speed: 0, url: n.prefix + url, status: "testing" }));
		// 移动弹窗到 body 下，避免 #main-grid transform 导致 fixed 定位失效
		setTimeout(() => {
			const modal = document.querySelector('.so:not([data-moved])') as HTMLElement | null;
			if (modal) {
				modal.dataset.moved = 'true';
				document.body.appendChild(modal);
			}
		}, 0);
		await Promise.allSettled(NODES.map(async (n, i) => {
			try { const r = await testNode(n.prefix, url); nr[i] = { ...nr[i], speed: r.speed, status: r.ok ? "done" : "error" }; } catch { nr[i] = { ...nr[i], status: "error" }; }
			nr = [...nr];
		}));
		dt = false;
	}
	function cm() {
		// 先手动移除已移到 body 的弹窗，避免 Svelte 清理不到
		const modal = document.querySelector('.so[data-moved]') as HTMLElement | null;
		if (modal) modal.remove();
		dm = false;
	}

	// 自动跳转遮罩状态
	let autoNavOverlay = false;
	let autoNavText = "正在跳转";

	// 自动跳转：支持 URL 参数 ?repo=owner/repo&version=vX.Y.Z&open=1
		function initAutoNav() {
			const params = new URLSearchParams(window.location.search);
			const repoParam = params.get("repo");
			const versionParam = params.get("version");
			const openParam = params.get("open");

			if (!repoParam || openParam !== "1") return;

			const idx = repos.findIndex(r => `${r.owner}/${r.repo}` === repoParam);
			if (idx < 0) return;

			autoNavOverlay = true;
			autoNavText = "正在定位模组…";
			goDetail(idx);
				setTimeout(() => {
					const overlay = document.querySelector('.so[data-autonav]') as HTMLElement | null;
					if (overlay && overlay.parentElement !== document.body) {
						document.body.appendChild(overlay);
					}
				}, 0);

		// 关闭遮罩 & 清理 URL 参数
		function closeOverlay() {
			const overlay = document.querySelector('.so[data-autonav]') as HTMLElement | null;
			if (overlay) overlay.remove();
			autoNavOverlay = false;
			document.documentElement.style.overflow = '';
			document.body.style.overflow = '';
			const url = new URL(window.location.href);
			url.searchParams.delete("repo");
			url.searchParams.delete("version");
			url.searchParams.delete("open");
			window.history.replaceState({}, "", url.toString());
		}

		const startTime = Date.now();
		const TIMEOUT = 15000; // 15 秒超时

		// 轮询等待 releases 加载完成，然后自动展开目标版本
		function check() {
			const r = repos[idx];
			const key = k(r.owner, r.repo);
			const state = dataMap[key];

			// 超时：15 秒还没好就放弃
			if (Date.now() - startTime > TIMEOUT) {
				autoNavText = "加载超时，请稍后重试";
				setTimeout(closeOverlay, 3000);
				return;
			}

			if (state && !state.loading) {
				// API 报错（403 限流等）
				if (state.error) {
					autoNavText = `加载失败：${state.error}`;
					setTimeout(closeOverlay, 3000);
					return;
				}
				if (state.releases.length > 0) {
					let targetRel;
					autoNavText = "正在查找版本…";
					if (versionParam === "latest") {
						targetRel = state.releases[0];
						if (targetRel && state.currentPage !== 1) {
							goPage(r.owner, r.repo, 1);
						}
					} else if (versionParam) {
						targetRel = state.releases.find(rel => rel.tag_name === versionParam);
						if (targetRel) {
							const relIdx = state.releases.indexOf(targetRel);
							const page = Math.floor(relIdx / PER_PAGE) + 1;
							if (state.currentPage !== page) {
								goPage(r.owner, r.repo, page);
							}
						}
					}
					if (targetRel) {
						expandedRelease = targetRel.id;
						closeOverlay();
						// 自动选择第一个 .zip 文件触发下载测速
						const zipAsset = targetRel.assets.find(a => /.zip$/i.test(a.name));
						if (zipAsset) {
							setTimeout(() => hd(zipAsset.browser_download_url, zipAsset.name), 150);
						}
					}
					return;
				}
			}
			requestAnimationFrame(check);
		}
		requestAnimationFrame(check);
	}onMount(initAutoNav);
</script>

{#if view === "grid"}
	<div class="repo-grid">
		{#each repos as r, i}
			<button class="repo-card-item" on:click={() => goDetail(i)}>
				{#if r.cover}
					<div class="repo-card-cover"><img src={r.cover} alt={r.label} loading="lazy" /></div>
				{:else}
					<div class="repo-card-cover repo-card-cover-ph"><Icon icon="material-symbols:code" /></div>
				{/if}
				<div class="repo-card-body">
					<h3 class="repo-card-label">{r.label}</h3>
					{#if r.desc}<p class="repo-card-desc">{r.desc}</p>{/if}
					<span class="repo-card-meta">{r.owner}/{r.repo}</span>
				</div>
			</button>
		{/each}
	</div>
{:else}
		{@const r = repos[activeRepo]}
		{@const key = k(r.owner, r.repo)}
		{@const state = dataMap[key]}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div in:scale={{ duration: 300, start: 0.9 }}>

		<button class="back-btn" on:click={goGrid}><Icon icon="material-symbols:chevron-left-rounded" /> 返回仓库列表</button>

		<div class="detail-header">
			{#if r.cover}<img src={r.cover} alt={r.label} class="detail-cover" />{/if}
			<div><h2 class="detail-title">{r.label}</h2>{#if r.desc}<p class="detail-desc">{r.desc}</p>{/if}<p class="detail-path">{r.owner}/{r.repo}</p></div>
		</div>

		{#if state?.loading}
			<div class="ls"><div class="sp" /><span>加载中...</span></div>
		{:else if state?.error}
			<div class="es"><Icon icon="material-symbols:error-outline-rounded" class="erricon" /><span>{state.error}</span></div>
		{:else if state?.releases.length === 0}
			<div class="es"><Icon icon="material-symbols:inbox-outline-rounded" class="erricon" /><span>暂无 release</span></div>
		{:else}
			{@const tp = totalPages(state)}
			{@const pr = getPage(state)}
			<div class="rl">
				{#each pr as rel}
					<div class="ri">
						<button class="rh" on:click={() => toggleRelease(rel.id)}>
							<div class="rinfo"><span class="rtag">{rel.tag_name}</span><span class="rdate"><Icon icon="material-symbols:calendar-month-outline-rounded" class="mi" />{fmtDate(rel.published_at)}</span></div>
							<Icon icon="material-symbols:chevron-right-rounded" class={`ra${expandedRelease === rel.id ? ' ex' : ''}`} />
						</button>
						{#if expandedRelease === rel.id}
							<div class="al">
								{#if repos[activeRepo].prerequisite}
									<a href={repos[activeRepo].prerequisite.url} target="_blank" rel="noopener noreferrer" class="prereq-btn">
										<Icon icon="material-symbols:warning-rounded" class="prereq-icon" />
										<span>下载前置模组：<strong>{repos[activeRepo].prerequisite.name}</strong></span>
										<Icon icon="material-symbols:open-in-new-rounded" class="mi" />
									</a>
								{/if}
								{#each rel.assets as asset}
									<a href="javascript:void(0)" on:click|preventDefault={() => hd(asset.browser_download_url, asset.name)} class="ai">
										<div class="ainfo"><span class="aname">{asset.name}</span><span class="ameta">{fmtSize(asset.size)} · {asset.download_count} 次下载</span></div>
										<span class="dl">下载</span>
									</a>
								{/each}
								<a href={rel.html_url} target="_blank" rel="noopener noreferrer" class="vgh"><Icon icon="material-symbols:open-in-new-rounded" class="mi" />在 GitHub 查看</a>
							</div>
						{/if}
					</div>
				{/each}
			</div>
			{#if tp > 1}
				<div class="pw"><div class="pb" role="navigation">
					<div class="mpg">
						<button class="bp" disabled={state.currentPage <= 1} on:click={() => goPage(r.owner, r.repo, state.currentPage - 1)}><Icon icon="material-symbols:chevron-left-rounded" /></button>
						<div class="bpi"><span class="bpc">{state.currentPage}</span><span class="bpd">/</span><span class="bpt">{tp}</span></div>
						<button class="bp" disabled={state.currentPage >= tp} on:click={() => goPage(r.owner, r.repo, state.currentPage + 1)}><Icon icon="material-symbols:chevron-right-rounded" /></button>
					</div>
					<div class="dpg">
						<button class="bp" disabled={state.currentPage <= 1} on:click={() => goPage(r.owner, r.repo, state.currentPage - 1)}><Icon icon="material-symbols:chevron-left-rounded" /></button>
						{#each getPages(tp, state.currentPage) as p}
							{#if p === -1}<span class="bpe"><Icon icon="material-symbols:more-horiz" /></span>
							{:else if p === state.currentPage}<span class="bpa">{p}</span>
							{:else}<button class="bp" on:click={() => goPage(r.owner, r.repo, p)}>{p}</button>{/if}
						{/each}
						<button class="bp" disabled={state.currentPage >= tp} on:click={() => goPage(r.owner, r.repo, state.currentPage + 1)}><Icon icon="material-symbols:chevron-right-rounded" /></button>
					</div>
				</div></div>
			{/if}
		{/if}
	</div>
{/if}

{#if dm}
<div class="so" on:click={cm} role="dialog">
<div class="sm" on:click={(e) => e.stopPropagation()}>
<div class="sh"><h3 class="st">下载测速</h3><button class="sx" on:click={cm}><Icon icon="material-symbols:close-rounded" /></button></div>
	<p style="text-align:center;font-size:.8rem;opacity:.6;margin:-.25rem 0 .5rem;color:rgba(255,255,255,.85);">{df}</p>
<div class="sr">
{#each [...nr].sort((a, b) => b.speed - a.speed) as r}
{@const b = [...nr].filter(x => x.status === "done").sort((a, b) => b.speed - a.speed)[0]}
<div class="srr" class:best={r === b && r.speed > 0}>
<span class="sn">{r.name}</span>
<span class="si">
{#if r.status === "testing"}<span class="ss" />{:else if r.status === "error"}<span class="se">超时</span>{:else}<span class="sv">{r.speed} KB/s</span>{/if}
{#if r.status === "done"}<a href={r.url} target="_blank" class="sdl">下载</a>{/if}
</span>
</div>
{/each}
</div>
<p class="stip">测速数据仅供参考，实际下载请自行选择</p>
</div>
</div>
{/if}

{#if autoNavOverlay}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="so" data-autonav="true" style="cursor:default;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);background:rgba(0,0,0,0.45);z-index:99999;display:flex;align-items:center;justify-content:center;">
		<div class="nav-card">
			<div class="nav-spinner"></div>
			<p class="nav-text">{autoNavText}</p>
		</div>
	</div>
	{/if}
