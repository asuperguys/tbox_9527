# ============================================================
# push-github.ps1 — 一键推送站点到 GitHub 并开启 Pages
# 用法：在 tbox-prep-site 目录下运行  .\push-github.ps1
# 说明：全程浏览器授权（gh CLI），不会在任何地方输入/保存你的密码
# ============================================================
$ErrorActionPreference = 'Stop'
$repoName = 'tbox_9527'   # 你的仓库名

Write-Host '== 步骤 1/5：检查 gh CLI ==' -ForegroundColor Cyan
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host '未找到 gh CLI，请先安装 https://cli.github.com' -ForegroundColor Red
    exit 1
}

Write-Host '== 步骤 2/5：检查登录 ==' -ForegroundColor Cyan
$null = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host '尚未登录 GitHub，正在打开浏览器授权...' -ForegroundColor Yellow
    gh auth login --hostname github.com --git-protocol https --web
    if ($LASTEXITCODE -ne 0) { Write-Host '登录失败' -ForegroundColor Red; exit 1 }
}
gh auth setup-git
$user = gh api user --jq .login
if ([string]::IsNullOrWhiteSpace($user)) { Write-Host '获取用户名失败' -ForegroundColor Red; exit 1 }
Write-Host ("GitHub 用户: " + $user) -ForegroundColor Green

Write-Host '== 步骤 3/5：配置远程仓库 ==' -ForegroundColor Cyan
$remote = "https://github.com/$user/$repoName.git"
git remote set-url origin $remote 2>$null
if ($LASTEXITCODE -ne 0) { git remote add origin $remote }
Write-Host ("远程仓库: " + $user + "/" + $repoName) -ForegroundColor Green

Write-Host '== 步骤 4/5：推送 ==' -ForegroundColor Cyan
git push -u origin main 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host '推送被拒（可能仓库有初始提交），尝试合并后重推...' -ForegroundColor Yellow
    git pull origin main --allow-unrelated-histories --no-edit 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Host '合并失败，请手动处理'; exit 1 }
    git push -u origin main 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Host '推送失败'; exit 1 }
}
Write-Host '推送成功' -ForegroundColor Green
git status -sb | Select-Object -First 1

Write-Host '== 步骤 5/5：开启 GitHub Pages ==' -ForegroundColor Cyan
gh api "repos/$user/$repoName/pages" -X POST -f "source[branch]=main" -f "source[path]=/" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Pages 自动开启失败（可能已开启或需手动），请按下面提示手动开启:' -ForegroundColor Yellow
    Write-Host '  仓库 Settings -> Pages -> Source 选 Deploy from a branch -> main / (root) -> Save' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '完成！网站地址（等 1-2 分钟生效）:' -ForegroundColor Green
Write-Host ("  https://" + $user + ".github.io/" + $repoName + "/") -ForegroundColor Green
