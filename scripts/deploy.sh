#!/usr/bin/env bash
# =============================================================================
# Déploiement de DevOps Mentor sur le VPS (appelé par GitHub Actions via SSH).
#   Usage : bash scripts/deploy.sh <image_tag>
# Pré-requis : .env généré dans le même dossier, docker compose v2 installé.
# En cas d'échec du contrôle de santé, la version précédente est restaurée.
# =============================================================================
set -euo pipefail

NEW_TAG="${1:?usage: deploy.sh <image_tag>}"
COMPOSE=(docker compose --env-file .env -f docker-compose.prod.yml)
PROJECT="devops-tutor"
STATE_FILE=".deployed_tag"
HEALTH_TIMEOUT=120

log() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }

set_tag() {
  # Met à jour (ou ajoute) IMAGE_TAG dans .env
  if grep -q '^IMAGE_TAG=' .env; then
    sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$1/" .env
  else
    printf 'IMAGE_TAG=%s\n' "$1" >> .env
  fi
}

wait_healthy() {
  local container="$1" deadline=$((SECONDS + HEALTH_TIMEOUT)) status
  while (( SECONDS < deadline )); do
    status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || echo missing)
    case "$status" in
      healthy) echo "✅ $container : healthy"; return 0 ;;
      unhealthy|exited|dead) echo "❌ $container : $status"; return 1 ;;
    esac
    sleep 3
  done
  echo "❌ $container : délai dépassé (${HEALTH_TIMEOUT}s)"
  return 1
}

check_release() {
  wait_healthy devops-tutor-api && wait_healthy devops-tutor-web || return 1
  # Test de bout en bout : nginx → API
  local port
  port=$(grep -E '^WEB_PORT=' .env | cut -d= -f2)
  if ! curl -fsS --max-time 10 "http://127.0.0.1:${port:-8099}/api/health" >/dev/null; then
    echo "❌ /api/health injoignable via nginx"
    return 1
  fi
  echo "✅ Chaîne web → API opérationnelle"
}

cd "$(dirname "$0")/.."
echo "═══ DevOps Mentor — déploiement de la version ${NEW_TAG} ═══"

# 1. Anciens conteneurs (ancien pipeline self-hosted) portant les mêmes noms
log "Nettoyage des conteneurs hérités"
for name in devops-tutor-api devops-tutor-web monitoring-prometheus monitoring-node-exporter monitoring-grafana; do
  owner=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$name" 2>/dev/null || true)
  if [[ -n "$owner" && "$owner" != "$PROJECT" ]]; then
    echo "Suppression de $name (projet « $owner »)"
    docker rm -f "$name" >/dev/null
  fi
done

# 2. Vérification préalable : le port web doit être libre (ou déjà le nôtre),
#    sinon on s'arrête AVANT de toucher aux services en place.
WEB_PORT_VALUE=$(grep -E '^WEB_PORT=' .env | cut -d= -f2)
WEB_PORT_VALUE=${WEB_PORT_VALUE:-8099}
log "Vérification du port ${WEB_PORT_VALUE}"
holder=$(docker ps --format '{{.Names}}' --filter "publish=${WEB_PORT_VALUE}" | grep -v '^devops-tutor-web$' || true)
if [[ -n "$holder" ]]; then
  echo "❌ Le port ${WEB_PORT_VALUE} est déjà utilisé par le conteneur : ${holder}"
  echo "   Choisis un autre port (variable GitHub WEB_PORT) ou libère celui-ci."
  exit 1
fi
if ! docker ps --format '{{.Names}}' --filter "publish=${WEB_PORT_VALUE}" | grep -q '^devops-tutor-web$' \
   && ss -ltnH "sport = :${WEB_PORT_VALUE}" 2>/dev/null | grep -q .; then
  echo "❌ Le port ${WEB_PORT_VALUE} est déjà utilisé par un processus de l'hôte :"
  ss -ltnpH "sport = :${WEB_PORT_VALUE}" 2>/dev/null || true
  echo "   Choisis un autre port (variable GitHub WEB_PORT) ou libère celui-ci."
  exit 1
fi
echo "✅ Port ${WEB_PORT_VALUE} disponible"

# 3. Nouvelle version
PREVIOUS_TAG=$(cat "$STATE_FILE" 2>/dev/null || true)
set_tag "$NEW_TAG"

log "Téléchargement des images"
"${COMPOSE[@]}" pull

# 4. Démarrage + contrôle de santé. Tout échec (y compris un conteneur qui ne
#    démarre pas pendant « up ») déclenche le retour à la version précédente.
log "Démarrage des services et contrôle de santé"
if "${COMPOSE[@]}" up -d --remove-orphans && check_release; then
  echo "$NEW_TAG" > "$STATE_FILE"
else
  echo "--- Logs API ---"; docker logs --tail 60 devops-tutor-api 2>&1 || true
  if [[ -n "$PREVIOUS_TAG" && "$PREVIOUS_TAG" != "$NEW_TAG" ]]; then
    log "Échec : retour à la version ${PREVIOUS_TAG}"
    set_tag "$PREVIOUS_TAG"
    if "${COMPOSE[@]}" up -d --remove-orphans && check_release; then
      echo "↩️  Version ${PREVIOUS_TAG} restaurée : la production reste en ligne."
    else
      echo "⚠️ La version précédente ne répond pas non plus : intervention manuelle requise."
    fi
  else
    echo "⚠️ Aucune version précédente connue : pas de retour arrière possible."
  fi
  exit 1
fi

# 5. État et nettoyage
log "État des services"
"${COMPOSE[@]}" ps
docker image prune -f >/dev/null
echo
echo "🚀 Déploiement ${NEW_TAG} terminé."
