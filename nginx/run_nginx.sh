#!/bin/sh

echo "######## Run nginx"
export DOLLAR='$'
envsubst < /etc/nginx/conf.d/eclide.conf.template > /etc/nginx/conf.d/eclide.conf
nginx -g "daemon off;"