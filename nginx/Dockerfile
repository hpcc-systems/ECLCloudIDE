FROM nginx

COPY ["./nginx.conf", "/etc/nginx/nginx.conf"]

COPY ["./conf.d", "/etc/nginx/conf.d"]

ENV HOSTNAME ${HOSTNAME}
ENV NODE_PORT ${NODE_PORT}

EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]