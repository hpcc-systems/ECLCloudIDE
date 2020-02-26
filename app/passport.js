const passport    = require('passport');
const passportJWT = require("passport-jwt");

const ExtractJWT = passportJWT.ExtractJwt;

const LocalStrategy = require('passport-local').Strategy;
const JWTStrategy   = passportJWT.Strategy;

const db = require('./models/index');
const User = db.User;

const bcrypt = require('bcrypt');

const maxAttempts = process.env.MAX_ATTEMPTS || Infinity;
const loginInterval = process.env.LOGIN_INTERVAL || 100; // 100 ms
const maxInterval = process.env.MAX_INTERVAL || 300000; // 5 minutes

passport.use(new LocalStrategy((username, password, next) => {
  return User.findOne({
    where: {
      [db.Sequelize.Op.or]: {
        username: username,
        emailAddress: username
      }
    }
  }).then(user => {
    if (!user) { // user not found
      return next(null, false, { message: 'Incorrect username or password.' });
    }

    let attemptsInterval = Math.pow(loginInterval, Math.log(user.loginAttempts + 1));
    let calculatedInterval = (attemptsInterval < maxInterval) ? attemptsInterval : maxInterval;
    let timeToWait = Math.ceil(calculatedInterval / 1000);
    let timeToWaitUnits = 'second';

    if (timeToWait > 60) {
      timeToWait = Math.round(timeToWait / 60);
      timeToWaitUnits = 'minute';
    }

    let errorMsg = 'Incorrect username or password.';
    let now = new Date();

    if (user.loginAttempts > maxAttempts) {
      user.lastLoginAt = now.toISOString();
      user.loginAttempts += 1;
      user.save();
      errorMsg = 'This account is locked due to too many failed login attempts.';
      return next(null, false, { message: errorMsg });
    }

    if (user.lastLoginAt && now.getTime() - new Date(user.lastLoginAt).getTime() < calculatedInterval) {
      user.lastLoginAt = now.toISOString();
      user.loginAttempts += 1;
      user.save();
      errorMsg = 'This account is currently locked due to repeated failed attempts. ' +
        'Please wait ' + timeToWait + ' ' + timeToWaitUnits + ((timeToWait > 1) ? 's' : '') +
        ' before trying again.';
      return next(null, false, { message: errorMsg });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      user.lastLoginAt = now.toISOString();
      user.loginAttempts += 1;
      user.save();

      if (user.lastLoginAt && now.getTime() - new Date(user.lastLoginAt).getTime() < calculatedInterval) {
        errorMsg = 'This account is currently locked due to repeated failed attempts. ' +
          'Please wait ' + timeToWait + ' ' + timeToWaitUnits + ((timeToWait > 1) ? 's' : '') +
          ' before trying again.';
      }

      return next(null, false, { message: errorMsg });
    }

    user.loginAttempts = 0;
    user.lastLoginAt = null;
    user.save();

    return next(null, user, { message: 'Logged In Successfully' });
  }).catch(err => {
    console.log(err);
    return next(err);
  });
}));

passport.use(new JWTStrategy({
  //jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
  jwtFromRequest: (req) => {
    let token = null;
    if (req && req.cookies) {
      token = req.cookies['Token'];
    }
    return token;
  },
  secretOrKey: process.env.SECRET
}, (jwtPayload, next) => {
  //find the user in db if needed
  return User.findByPk(jwtPayload.id).then(user => {
    return next(null, user);
  }).catch(err => {
    return next(err);
  });
}));