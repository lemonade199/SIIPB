#!/usr/bin/env bash
# Terbitkan sertifikat Let's Encrypt (Certbot, webroot) lalu wajibkan HTTPS.
# Jalankan SEKALI di EC2 setelah record A domain mengarah ke Elastic IP:
#   /opt/siipb/scripts/setup-ssl.sh
# Perpanjangan otomatis: certbot.timer (bawaan paket) + hook reload Nginx.
set -euo pipefail
set -a; . /etc/siipb/siipb.conf; set +a

server_ip=$(curl -fsS https://checkip.amazonaws.com)
dns_ip=$(getent ahostsv4 "$APP_DOMAIN" | awk 'NR==1{print $1}')
if [ "$server_ip" != "$dns_ip" ]; then
  echo "DNS $APP_DOMAIN -> '${dns_ip:-tidak ada}', IP server $server_ip. Tunggu propagasi DNS lalu ulangi." >&2
  exit 1
fi

sudo certbot certonly --webroot -w /var/www/certbot \
  -d "$APP_DOMAIN" --email "$LETSENCRYPT_EMAIL" \
  --agree-tos --no-eff-email --non-interactive --keep-until-expiring

sudo install -m 644 "$APP_DIR/nginx/snippets/siipb-locations.conf" /etc/nginx/snippets/siipb-locations.conf
sed "s/__DOMAIN__/$APP_DOMAIN/g" "$APP_DIR/nginx/siipb.https.conf" | sudo tee /etc/nginx/sites-available/siipb.conf >/dev/null
sudo nginx -t
sudo systemctl reload nginx

sudo certbot renew --dry-run
echo "HTTPS aktif: https://$APP_DOMAIN"
