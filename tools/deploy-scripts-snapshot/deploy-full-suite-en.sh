#!/bin/bash
# 部署 Full Suite (EN) 到 obr.dnd.center/full-suite-en/
#
# 用法： bash "D:/Desktop/枭熊插件/deploy-full-suite-en.sh"
#
# Manifest 安装地址（OBR）:
#   https://obr.dnd.center/full-suite-en/manifest.json
#
# 这是为 OBR 官方商店投递准备的英文阉割版 —— 拆掉了：
#   - 世界包模块
#   - 5etools / kiwee 任何字面提及
#   - 内置库（默认空，必须用户自己添加）
#   - xlsx 角色卡上传（改 JSON）
#   - 数据版本（2014/2024）选项
#   - 跨场景同步角色卡列表选项
#   - 中文社区相关 UI
#
# 命名空间已重置 (com.obr-suite/* → com.full-suite-en/*) 所以与
# 中文社区版可以共存（虽然实际 UX 上不建议同时装两个）。
set -e
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== [1/4] vite build (BASE=/full-suite-en/) ==="
cd "$ROOT_DIR/obr-suite-en"
echo "=== sync shared content ==="
cp ../shared/supporters.zh.json public/supporters.zh.json
cp ../shared/supporters.en.json public/supporters.en.json
# EN cut uses its OWN announcement source (announcement.en.md), so the
# changelog can describe only the features that ship here — no World
# Pack, no 5etools mentions, etc. The Chinese-community build keeps
# using shared/announcement.md (bilingual single-file).
cp ../shared/announcement.en.md public/announcement.md
SUITE_BASE=full-suite-en npx vite build

echo "=== [2/4] 打包 dist ==="
cd "$ROOT_DIR"
mkdir -p deploy/obr-plugins
rm -rf deploy/obr-plugins/full-suite-en
mkdir -p deploy/obr-plugins/full-suite-en
cp -r obr-suite-en/dist/* deploy/obr-plugins/full-suite-en/
cd deploy
tar czf obr-deploy-full-suite-en.tar.gz obr-plugins/full-suite-en

echo "=== [3/4] scp 上传到服务器 ==="
scp obr-deploy-full-suite-en.tar.gz root@47.120.61.255:/tmp/

echo "=== [4/4] 服务器解压替换 ==="
ssh root@47.120.61.255 "cd /tmp && rm -rf obr-plugins/full-suite-en && tar xzf obr-deploy-full-suite-en.tar.gz && rm -rf /var/www/obr-plugins/full-suite-en && cp -r obr-plugins/full-suite-en /var/www/obr-plugins/ && echo DEPLOYED"

echo ""
echo "✅ 完成！EN 版本已发布。"
echo "   manifest： https://obr.dnd.center/full-suite-en/manifest.json"
echo "   提交到 OBR 官方商店时使用上面这个 URL。"
