const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const compression = require('compression');

require('dotenv').load();

require('./passport');

const passport = require('passport');

const session = require('express-session');
const flash = require('express-flash');

const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const workspacesRouter = require('./routes/workspaces');
const datasetsRouter = require('./routes/datasets');
const scriptsRouter = require('./routes/scripts');
const workunitsRouter = require('./routes/workunits');

const hpccWorkunitsRouter = require('./routes/hpcc_proxy/workunits');
const hpccFilesprayRouter = require('./routes/hpcc_proxy/filespray');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.set('trust proxy', ['uniquelocal']);

app.use(compression());

app.use(logger('dev'));
app.use(express.json({ limit: '24mb' }));
app.use(express.urlencoded({ limit: '24mb', extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieParser(process.env.SECRET));

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  name: 'sessionId',
  store: new session.MemoryStore,
  saveUninitialized: true,
  cookie: {
    secure: (process.env.NODE_ENV === 'production'),
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 3600000,
  }
}));

app.use(flash());

app.use(passport.initialize());

app.use('/auth', authRouter);

// for all routes not /auth/*
// test for user session object
app.use((req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    req.session.goToUrl = req.url;
    console.log('NEED TO GO TO: ' + req.session.goToUrl);
    res.redirect('/auth/login');
  }
});

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/workspaces', workspacesRouter);
app.use('/datasets', datasetsRouter);
app.use('/scripts', scriptsRouter);
app.use('/workunits', workunitsRouter);

app.use('/hpcc/workunits', hpccWorkunitsRouter);
app.use('/hpcc/filespray', hpccFilesprayRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// error handler
app.use((err, req, res, next) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
