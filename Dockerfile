FROM node:10.15.3-alpine

COPY ./app /app/

WORKDIR /app

RUN apk --no-cache add --virtual build-deps build-base python

RUN npm install -g node-gyp && npm install

RUN npm install sequelize-cli pm2 -g

COPY [".env", "/app/.env"]

RUN apk del build-deps