#!/usr/bin/env bash
# Detecta IP público da máquina e sugere N8N_PUBLIC_URL para .env / docker-compose
# Uso: bash scripts/detect-public-ip.sh [--write-env]
set -e

IP=$(curl -s --max-time 5 https://api.ipify.org || curl -s --max-time 5 https://ifconfig.me || hostname -I | awk '{print $1}' | head -1)
IP=$(echo "$IP" | tr -d '[:space:]')

if [[ ! "$IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
  echo "Não foi possível detectar IP público. IP bruto: '$IP'"
  echo "Tente: curl -s https://api.ipify.org"
  exit 1
fi

SSLIP="https://${IP//./-}.sslip.io"
echo "IP público detectado: $IP"
echo "N8N_PUBLIC_URL sugerido: $SSLIP"
echo ""
echo "Para aplicar:"
echo "  echo \"N8N_PUBLIC_URL=$SSLIP\" >> .env"
echo "  echo \"N8N_URL=http://127.0.0.1:5679\" >> .env"
echo "  # ou export N8N_PUBLIC_URL=\"$SSLIP\" antes do docker compose"
echo ""
echo "Docker compose:"
echo "  N8N_PUBLIC_URL=$SSLIP docker compose -f docker-compose.n8n.yml up -d"

if [[ "$1" == "--write-env" ]]; then
  if [ -f .env ]; then
    if grep -q "^N8N_PUBLIC_URL=" .env; then
      sed -i "s|^N8N_PUBLIC_URL=.*|N8N_PUBLIC_URL=$SSLIP|" .env
      echo "Atualizado N8N_PUBLIC_URL em .env"
    else
      echo "N8N_PUBLIC_URL=$SSLIP" >> .env
      echo "Adicionado N8N_PUBLIC_URL ao .env"
    fi
  else
    echo "N8N_PUBLIC_URL=$SSLIP" > .env
    echo "Criado .env com N8N_PUBLIC_URL"
  fi
  cat .env | grep -E "N8N_"
fi
