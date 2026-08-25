#!/bin/bash
# 私人测试版部署：构建 obr-suite 并发布到 obr.dnd.center/suite-dev/
#
# 用法： bash "D:/Desktop/枭熊插件/deploy-suite-dev.sh"
#
# 用户在 OBR 用以下 manifest URL 安装测试版：
#   https://obr.dnd.center/suite-dev/manifest-dev.json
#
# 注意： dev 和 stable 现在已经做到资源完全独立 —— 每条 URL 都通过
# location.origin + import.meta.env.BASE_URL 计算，所以 /suite-dev/
# 的 background.js 打开的 popover/modal/图标全部从 /suite-dev/ 加载，
# 不会再串到 /suite/ 去。
#
# 但是 SCENE / ROOM 元数据的 namespace 还是共享的（com.obr-suite/...
# / com.bestiary/... / com.character-cards/...）。同一个 OBR 房间里
# 同时装两个会互相覆盖元数据，所以测 dev 时还是建议在「另一个房间」
# 或者先卸载 stable。
set -e
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== [1/4] vite build (BASE=/suite-dev/) ==="
cd "$ROOT_DIR/obr-suite"
echo "=== sync shared content + dev feature flags ==="
cp ../shared/supporters.zh.json public/supporters.zh.json
cp ../shared/supporters.en.json public/supporters.en.json
cp ../shared/announcement.md public/announcement.md
# 2026-05-18 — sync supporter avatars. /shared/pics/ → public/supporter-avatars/.
mkdir -p public/supporter-avatars
cp -r ../shared/pics/. public/supporter-avatars/
# Keep this in sync with deploy-suite.sh. `perl -pi` is unsafe on some
# ownership-less Windows drives, where its temporary-file rename can fail.
node -e 'const fs=require("fs");const p="src/feature-flags.ts";const s=fs.readFileSync(p,"utf8");const re=/export const STABLE_HIDES = (true|false);/;if(!re.test(s))throw new Error("STABLE_HIDES declaration not found");fs.writeFileSync(p,s.replace(re,"export const STABLE_HIDES = false;"),"utf8");'
# Pass bare dir name (no leading slash) — Git Bash on Windows uses
# MSYS which auto-converts "/suite-dev/" to "/Git/suite-dev/" because
# the MSYS root is C:\Program Files\Git\. vite.config.ts adds the
# slashes back, so "suite-dev" → "/suite-dev/" inside the config.
SUITE_BASE=suite-dev SUITE_CHANNEL=dev npm run build

echo "=== [2/4] 打包 dist ==="
cd "$ROOT_DIR"
rm -rf deploy/obr-plugins/suite-dev
mkdir -p deploy/obr-plugins/suite-dev
cp -r obr-suite/dist/* deploy/obr-plugins/suite-dev/
cd deploy
tar czf obr-deploy-dev.tar.gz obr-plugins/suite-dev

echo "=== [3/4] scp 上传到服务器 ==="
scp obr-deploy-dev.tar.gz root@47.120.61.255:/tmp/

echo "=== [4/4] 服务器解压替换 ==="
ssh root@47.120.61.255 "cd /tmp && rm -rf obr-plugins/suite-dev && tar xzf obr-deploy-dev.tar.gz && rm -rf /var/www/obr-plugins/suite-dev && cp -r obr-plugins/suite-dev /var/www/obr-plugins/ && echo DEPLOYED"

echo ""
echo "✅ 完成！测试版已发布。"
echo "   测试版 manifest： https://obr.dnd.center/suite-dev/manifest-dev.json"
echo "   稳定版（生产） ： https://obr.dnd.center/suite/manifest.json"
