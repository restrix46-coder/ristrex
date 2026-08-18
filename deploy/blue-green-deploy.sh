#!/bin/bash
# deploy/blue-green-deploy.sh
# Zero-downtime Blue/Green Deployment لـ Weaver
#
# الاستخدام:
#   ./deploy/blue-green-deploy.sh <IMAGE_TAG>
#
# المتطلبات:
#   - Docker Compose v2
#   - الخدمة المسمّاة "app" في docker-compose.yml
#   - health endpoint على /api/health

set -euo pipefail

IMAGE_TAG="${1:-latest}"
APP_DIR="/opt/weaver"
COMPOSE_FILE="$APP_DIR/docker-compose.yml"
MAX_HEALTH_WAIT=60
HEALTH_INTERVAL=3

# ─── الألوان ─────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }

# ─── التحقق من المتطلبات ──────────────────────────────────────────────────────
log "التحقق من المتطلبات..."
command -v docker >/dev/null 2>&1 || { error "Docker غير مثبّت"; exit 1; }
[[ -f "$COMPOSE_FILE" ]] || { error "docker-compose.yml غير موجود في $APP_DIR"; exit 1; }

# ─── سحب الصورة الجديدة ──────────────────────────────────────────────────────
log "سحب الصورة: $IMAGE_TAG"
WEAVER_IMAGE="ghcr.io/$(cat $APP_DIR/.repo):$IMAGE_TAG"
docker pull "$WEAVER_IMAGE" || { error "فشل سحب الصورة $WEAVER_IMAGE"; exit 1; }
export WEAVER_IMAGE

# ─── حفظ الصورة الحالية للتراجع ─────────────────────────────────────────────
CURRENT_IMAGE=$(docker compose -f "$COMPOSE_FILE" images app --quiet 2>/dev/null || echo "none")
log "الصورة الحالية: $CURRENT_IMAGE"
echo "$CURRENT_IMAGE" > "$APP_DIR/.previous-image"

# ─── تشغيل الحاوية الجديدة ───────────────────────────────────────────────────
log "🟢 تشغيل الحاوية الجديدة (Green)..."
docker compose -f "$COMPOSE_FILE" up -d --no-deps --scale app=2 app

# ─── انتظار صحة الحاوية الجديدة ─────────────────────────────────────────────
log "انتظار صحة الحاوية الجديدة..."
WAIT=0
HEALTH_URL="http://localhost:3000/api/health"

while [[ $WAIT -lt $MAX_HEALTH_WAIT ]]; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")
  if [[ "$STATUS" == "200" ]]; then
    success "الحاوية الجديدة جاهزة (${WAIT}ث)"
    break
  fi
  sleep $HEALTH_INTERVAL
  WAIT=$((WAIT + HEALTH_INTERVAL))
  log "الانتظار... ${WAIT}ث (الحالة: $STATUS)"
done

if [[ $WAIT -ge $MAX_HEALTH_WAIT ]]; then
  error "الحاوية الجديدة لم تصبح جاهزة خلال ${MAX_HEALTH_WAIT}ث"
  log "التراجع إلى الصورة السابقة..."
  
  PREV_IMAGE=$(cat "$APP_DIR/.previous-image" 2>/dev/null || echo "")
  if [[ -n "$PREV_IMAGE" && "$PREV_IMAGE" != "none" ]]; then
    export WEAVER_IMAGE="$PREV_IMAGE"
    docker compose -f "$COMPOSE_FILE" up -d --no-deps --scale app=1 app
    success "تم التراجع إلى: $PREV_IMAGE"
  fi
  exit 1
fi

# ─── إيقاف الحاوية القديمة ───────────────────────────────────────────────────
log "🔵 إيقاف الحاوية القديمة..."
docker compose -f "$COMPOSE_FILE" up -d --no-deps --scale app=1 app

# ─── تنظيف الصور القديمة ────────────────────────────────────────────────────
log "تنظيف الصور القديمة..."
docker image prune -f --filter "until=24h" 2>/dev/null || true

# ─── سجل النشر ───────────────────────────────────────────────────────────────
echo "$(date --iso-8601=seconds) $IMAGE_TAG" >> "$APP_DIR/.deploy-history"

success "النشر مكتمل: $IMAGE_TAG"
log "تحقق نهائي..."
curl -s "$HEALTH_URL" | grep -q '"status"' && success "النظام يعمل" || warn "فشل التحقق النهائي"
