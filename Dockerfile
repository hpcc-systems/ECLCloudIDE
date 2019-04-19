FROM ubuntu:bionic

COPY ./app /app/

WORKDIR /app

RUN apt-get update -y && apt-get install -y build-essential curl

RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -

RUN apt-get install -y nodejs

ENV DEBIAN_FRONTEND noninteractive
ENV DEBCONF_NONINTERACTIVE_SEEN true

RUN echo "tzdata tzdata/Areas select America" > /tmp/preseed.txt; \
    echo "tzdata tzdata/Zones/America select New_York" >> /tmp/preseed.txt; \
    debconf-set-selections /tmp/preseed.txt

RUN apt-get install -y openssh-client openssh-server \
    expect rsync libapr1 psmisc libaprutil1 libarchive13 libatlas3-base \
    libboost-regex1.65.1 libmemcached11 libmemcachedutil2 libnuma1 \
    libpython2.7 libpython3.6 libxslt1.1

ARG clientToolsUrl=https://edgecastcdn.net/00423A/releases/CE-Candidate-7.2.2/bin/clienttools/hpccsystems-clienttools-community_7.2.2-1bionic_amd64.deb

RUN echo "get ${clientToolsUrl} with wget"
RUN wget -O clienttools.deb $clientToolsUrl && dpkg -i clienttools.deb && rm clienttools.deb

RUN npm install -g node-gyp && npm install

RUN npm install sequelize-cli pm2 -g

RUN npm run clientdeps

COPY [".env", "/app/.env"]