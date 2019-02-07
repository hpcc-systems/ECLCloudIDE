const passport    = require('passport');
const passportJWT = require("passport-jwt");

const ExtractJWT = passportJWT.ExtractJwt;

const LocalStrategy = require('passport-local').Strategy;
const JWTStrategy   = passportJWT.Strategy;

const db = require('./db');
const User = db.users;

const bcrypt = require('bcrypt');

passport.use(new LocalStrategy((username, password, next) => {
  return User.findOne({
    where: {
      username: username
    }
  }).then(user => {
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return next(null, false, { message: 'Incorrect username or password.' });
    }

    return next(null, user, { message: 'Logged In Successfully' });
  }).catch(err => {
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