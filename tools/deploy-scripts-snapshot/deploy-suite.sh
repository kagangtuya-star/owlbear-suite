#!/bin/bash
# 只构建并部署 obr-suite (Full Suite) 到 obr.dnd.center/suite/
# 用法： bash "D:/Desktop/枭熊插件/deploy-suite.sh"
set -e
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== [1/4] vite build ==="
cd "$ROOT_DIR/obr-suite"
echo "=== sync shared content + stable feature flags ==="
cp ../shared/supporters.zh.json public/supporters.zh.json
cp ../shared/supporters.en.json public/supporters.en.json
cp ../shared/announcement.md public/announcement.md
# 2026-05-18 — sync supporter avatars. The /shared/pics/ folder is the
# single source of truth; each pic is renamed to match a supporter name
# in supporters.zh.json. settings.ts's SUPPORTER_AVATARS map references
# files in public/supporter-avatars/, vite bundles them as-is.
mkdir -p public/supporter-avatars
cp -r ../shared/pics/. public/supporter-avatars/
# Do not use `perl -pi` here: on removable / ownership-less Windows drives it
# can delete the original file and then fail to rename its temporary file.
# This rewrite validates the expected declaration before touching the source.
node -e 'const fs=require("fs");const p="src/feature-flags.ts";const s=fs.readFileSync(p,"utf8");const re=/export const STABLE_HIDES = (true|false);/;if(!re.test(s))throw new Error("STABLE_HIDES declaration not found");fs.writeFileSync(p,s.replace(re,"export const STABLE_HIDES = false;"),"utf8");'
npm run build

echo "=== [2/4] 打包 dist ==="
cd "$ROOT_DIR"
rm -rf deploy/obr-plugins/suite
mkdir -p deploy/obr-plugins/suite
cp -r obr-suite/dist/* deploy/obr-plugins/suite/
cd deploy
tar czf obr-deploy.tar.gz obr-plugins

echo "=== [3/4] scp 上传到服务器 ==="
scp obr-deploy.tar.gz root@47.120.61.255:/tmp/

echo "=== [4/4] 服务器解压替换 ==="
ssh root@47.120.61.255 "cd /tmp && rm -rf obr-plugins/suite && tar xzf obr-deploy.tar.gz && rm -rf /var/www/obr-plugins/suite && cp -r obr-plugins/suite /var/www/obr-plugins/ && echo DEPLOYED"

echo ""
echo "✅ 完成！打开 OBR 刷新页面即可看到新版本。"
echo "   线上地址： https://obr.dnd.center/suite/manifest.json"
