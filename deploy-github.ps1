# ============================================================
# deploy-github.ps1 — 一键创建 GitHub 公开仓库并推送站点
# 用法：在 tbox-prep-site 目录下运行  .\deploy-github.ps1
# 说明：全程使用浏览器授权（gh CLI），不会在任何地方输入/保存你的密码
# ============================================================
$ErrorActionPreference = 'Stop'
$repoName = 'tbox-prep'   # 想改仓库名就改这一行

# 1. 检查 gh CLI
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host '未找到 gh CLI，请先安装 https://cli.github.com 或改用网页上传方案' -ForegroundColor Red
    exit 1
}

# 2. 登录检查（未登录会打开浏览器完成授权，不输入密码到任何聊天/脚本）
$null = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host '尚未登录 GitHub，正在打开浏览器授权……' -ForegroundColor Yellow
    gh auth login --hostname github.com --git-protocol https --web
    if ($LASTEXITCODE -ne 0) { Write-Host '登录失败，请重试' -ForegroundColor Red; exit 1 }
}

# 3. 获取你的 GitHub 用户名
$user = gh api user --jq .login
Write-Host ("GitHub 用户: " + $user) -ForegroundColor Cyan

# 4. 创建仓库并推送（仓库已存在则只推送）
$null = gh repo view "$user/$repoName" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "正在创建公开仓库 $repoName 并推送……" -ForegroundColor Yellow
    gh repo create $repoName --public --source . --remote origin --push
    if ($LASTEXITCODE -ne 0) { Write-Host '创建/推送失败，请检查网络或重试' -ForegroundColor Red; exit 1 }
} else {
    Write-Host "仓库 $repoName 已存在，直接推送更新……" -ForegroundColor Yellow
    git remote remove origin 2>$null
    git remote add origin "https://github.com/$user/$repoName.git"
    git push -u origin main
}

# 5. 开启 GitHub Pages（Deploy from branch: main / root）
Write-Host '正在开启 GitHub Pages……' -ForegroundColor Yellow
gh api "repos/$user/$repoName/pages" -X POST -f 'source[branch]=main' -f 'source[path]=/' 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Pages 已开启或稍后需手动确认（仓库 Settings -> Pages，Source 选 Deploy from a branch -> main / (root)）' -ForegroundColor Yellow
}

Write-Host ''
Write-Host ('✅ 全部完成！网站地址（等 1-2 分钟生效）:') -ForegroundColor Green
Write-Host ("   https://" + $user + ".github.io/" + $repoName + "/") -ForegroundColor Green
Write-Host ''
Write-Host '以后更新内容：编辑 content/*.md 后执行  git add . ; git commit -m "update" ; git push' -ForegroundColor Cyan
