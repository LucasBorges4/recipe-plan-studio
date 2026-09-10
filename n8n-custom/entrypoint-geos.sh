#!/bin/sh
node /usr/local/lib/n8n-custom/register-server.js &
exec n8n start
