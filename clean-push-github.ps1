# ============================================================
# clean-push-github.ps1 — 干净历史一键推送（删除旧仓库 → 重建 → 推送 → 开启 Pages）
# 用法：在 tbox-prep-site 目录下运行  .\clean-push-github.ps1
# 说明：
#   1. 本脚本会【删除】GitHub 上旧的 tbox_9527 仓库（含个人信息的旧历史将彻底移除）
#   2. 然后重建同名空仓库，推送"只含干净内容"的单一提交
#   3. 想保留旧仓库改用新名字：改下面的 $repoName 即可（不会删除任何东西）
# ============================================================
$ErrorActionPreference = 'Stop'
$repoName = 'tbox_9527'   # 改成新名字（如 tbox-prep）可保留旧仓库

Write-Host '== 1/5 检查 gh CLI ==' -ForegroundColor Cyan
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host '未找到 gh CLI，请先安装 https://cli.github.com' -ForegroundColor Red
    exit 1
}

Write-Host '== 2/5 检查登录 ==' -ForegroundColor Cyan
$null = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host '尚未登录，打开浏览器授权...' -ForegroundColor Yellow
    gh auth login --hostname github.com --git-protocol https --web
    if ($LASTEXITCODE -ne 0) { Write-Host '登录失败' -ForegroundColor Red; exit 1 }
}
gh auth setup-git
$user = gh api user --jq .login
if ([string]::IsNullOrWhiteSpace($user)) { Write-Host '获取用户名失败' -ForegroundColor Red; exit 1 }
Write-Host ("GitHub 用户: " + $user) -ForegroundColor Green

Write-Host '== 3/5 检查旧仓库 ==' -ForegroundColor Cyan
$null = gh repo view "$user/$repoName" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host ("仓库 " + $repoName + " 已存在，即将删除（旧历史含个人信息，必须删除）") -ForegroundColor Yellow
    $confirm = Read-Host '输入 yes 确认删除，输入其他任意键取消'
    if ($confirm -ne 'yes') { Write-Host '已取消，未做任何更改'; exit 0 }
    gh api -X DELETE "repos/$user/$repoName"
    if ($LASTEXITCODE -ne 0) { Write-Host '删除失败，请到网页手动删除后重试'; exit 1 }
    Write-Host '旧仓库已删除' -ForegroundColor Green
    Start-Sleep -Seconds 3
} else {
    Write-Host "仓库 $repoName 不存在，直接创建" -ForegroundColor Green
}

Write-Host '== 4/5 创建仓库并推送（干净历史）== ' -ForegroundColor Cyan
gh repo create $repoName --public --source . --push
if ($LASTEXITCODE -ne 0) { Write-Host '创建/推送失败，请检查网络'; exit 1 }

Write-Host '== 5/5 开启 GitHub Pages ==' -ForegroundColor Cyan
gh api "repos/$user/$repoName/pages" -X POST -f "source[branch]=main" -f "source[path]=/" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Pages 需手动开启：仓库 Settings -> Pages -> Deploy from a branch -> main / (root) -> Save' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '完成！网站地址（等 1-2 分钟生效）:' -ForegroundColor Green
Write-Host ("  https://" + $user + ".github.io/" + $repoName + "/") -ForegroundColor Green
