/**
 * GitHub Releases 配置
 * 用于 /releases/ 页面展示 GitHub 仓库的 releases
 */
export interface GitHubRepo {
	owner: string;
	repo: string;
	label: string;
	/** 简短描述 */
	desc?: string;
	/** 封面图（/public 下的路径，如 /covers/xxx.png） */
	cover?: string;
	/** 前置模组 */
	prerequisite?: {
		name: string;
		/** 前置模组的 GitHub releases 页面或下载地址 */
		url: string;
	};
}

export const githubReleasesConfig = {
	repos: [
		{
			owner: "Alchyr",
			repo: "BaseLib-StS2",
			label: "BaseLib",
			desc: "杀戮尖塔2 基础库模组",
			cover: "/covers/baselib.png",
		},
		{
			owner: "BAKAOLC",
			repo: "STS2-RitsuLib",
			label: "RitsuLib",
			desc: "杀戮尖塔2 RitsuLib 模组",
			cover: "/covers/ritsulib.png",
		},
		{
			owner: "LuoTianOrange",
			repo: "STS2_WineFox",
			label: "酒狐",
			desc: "杀戮尖塔2 酒狐模组",
			cover: "/covers/jiuhu.png",
		},
		{
			owner: "YuWan886",
			repo: "Sts2-YuWanCard",
			label: "YuWan Card",
			desc: "杀戮尖塔2 YuWan Card 模组",
			cover: "/covers/yuwancard.png",
		},
	] as GitHubRepo[],
};
