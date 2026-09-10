FROM n8nio/n8n:2.17.7

USER root

COPY patches/email.auth-handler.js /usr/local/lib/node_modules/n8n/dist/auth/handlers/email.auth-handler.js
COPY patches/custom-login.html /tmp/custom-login.html
COPY patches/inject-login.js /tmp/inject-login.js
COPY patches/register-server.js /usr/local/lib/n8n-custom/register-server.js

RUN node /tmp/inject-login.js && rm -f /tmp/inject-login.js /tmp/custom-login.html

COPY entrypoint-geos.sh /usr/local/bin/entrypoint-geos.sh
RUN chmod +x /usr/local/bin/entrypoint-geos.sh

USER node

ENTRYPOINT ["/usr/local/bin/entrypoint-geos.sh"]
