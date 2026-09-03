#!/usr/bin/env bash
set -e
CONTAINER=portal-postgres
DB=portal
USER=portal
BACKUP_DIR="$(dirname "$0")/../.data/pg-backups"
mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/portal_$(date +%Y%m%d_%H%M%S).sql"
docker exec $CONTAINER pg_dump -U $USER -d $DB > "$FILE"
gzip -f "$FILE"
echo "Backup salvo em $FILE.gz"
ls -lh "$BACKUP_DIR" | tail -n 20
