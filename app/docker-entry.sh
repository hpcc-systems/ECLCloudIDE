#!/bin/sh

sequelize db:migrate
pm2-runtime start process.yml