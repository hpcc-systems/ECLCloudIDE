FROM ubuntu:bionic

ARG user=eclide
ARG appDir=/home/$user/app

RUN groupadd -r $user && useradd -r -g $user -d /home/$user -s /sbin/nologin -c "Docker image user" $user
WORKDIR $appDir/

RUN apt-get update -y && apt-get install -y build-essential curl

RUN curl -sL https://deb.nodesource.com/setup_12.x | bash -

RUN apt-get install -y nodejs

ENV DEBIAN_FRONTEND noninteractive
ENV DEBCONF_NONINTERACTIVE_SEEN true

RUN echo "tzdata tzdata/Areas select America" > /tmp/preseed.txt; \
    echo "tzdata tzdata/Zones/America select New_York" >> /tmp/preseed.txt; \
    debconf-set-selections /tmp/preseed.txt

RUN apt-get install -y openssh-client openssh-server \
    expect rsync libapr1 psmisc libaprutil1 libarchive13 libatlas3-base \
    libboost-regex1.65.1 libmemcached11 libmemcachedutil2 libnuma1 \
    libpython2.7 libpython3.6 libxslt1.1 netcat git

ARG cdnUrl=https://cdn.hpccsystems.com
ARG hpccVersion=7.10.26

ARG clientToolsUrl=$cdnUrl/releases/CE-Candidate-$hpccVersion/bin/clienttools/hpccsystems-clienttools-community_$hpccVersion-1bionic_amd64.deb

RUN echo "get ${clientToolsUrl} with wget"
RUN wget -O clienttools.deb $clientToolsUrl && dpkg -i clienttools.deb && rm clienttools.deb

RUN echo "install ecl bundles"
RUN ecl bundle install https://github.com/hpcc-systems/ML_Core.git \
    && ecl bundle install https://github.com/hpcc-systems/PBblas.git \
    && ecl bundle install https://github.com/hpcc-systems/GLM.git \
    && ecl bundle install https://github.com/hpcc-systems/LearningTrees.git \
    && ecl bundle install https://github.com/hpcc-systems/LinearRegression.git \
    && ecl bundle install https://github.com/hpcc-systems/LogisticRegression.git \
    && ecl bundle install https://github.com/hpcc-systems/dbscan.git \
    && ecl bundle install https://github.com/hpcc-systems/SupportVectorMachines.git \
    && ecl bundle install https://github.com/hpcc-systems/DataPatterns.git \
    && ecl bundle install https://github.com/hpcc-systems/PerformanceTesting.git \
    && ecl bundle install https://github.com/hpcc-systems/Visualizer.git \
    && ecl bundle install https://github.com/OdinProAgrica/dapper.git

COPY ./app/package.json $appDir/
COPY ./app/hsqlc-1.0.0.tgz $appDir/

RUN npm install -g node-gyp && npm install
RUN npm install ./hsqlc-1.0.0.tgz

RUN npm install sequelize-cli pm2 -g

COPY ./app $appDir

RUN npm run clientdeps

# temporary solution to issue with hpcc-js & CSP restriction of unsafe-eval
RUN sed -i 's/new Function("return this;")()/function(){return this;}/g' public/javascripts/hpcc-js/util/dist/index.min.js

RUN chown -R $user:$user /home/$user/
RUN mkdir -p /tmp/pm2/logs && chown -R eclide:eclide /tmp/pm2/

USER $user

COPY [".env", "$appDir/.env"]
COPY ["/app/config/config.js.sample", "$appDir/config/config.js"]