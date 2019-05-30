const express = require('express');
const passport = require('passport');

const validator = require('express-validator');

const bcrypt = require('bcrypt');

const db = require('../models/index');
const User = db.User;

const router = express.Router();

/* Register */
router.get('/register', (req, res, next) => {
  if (req.session.user) {
    res.redirect('/');
  }

  res.locals.errors = req.flash();
  res.render('auth/register', { title: 'ECL IDE' });
});

router.post('/register', (req, res, next) => {
  if (req.user) {
    res.redirect('/');
  } else {
    User.findOne({
      where: {
        emailAddress: req.body.emailaddress
      }
    }).then((user) => {
      if (user == null) { // no user account exists using this email address
        bcrypt.hash(req.body.password, parseInt(process.env.SALT_ROUNDS, 10)).then((hash) => {
          User.create({ username: req.body.username, password: hash }).then((user) => {
            req.session.user = user;
            return res.redirect('/');
          }).catch((err) => {
            console.log(err);
          });
        }).catch((err) => {
          console.log(err);
        });
      } else {
        let msg = 'An account using this email address already exists. Perhaps try ' +
          'using the <a href="/auth/forgot">forgot password</a> form.'
        req.flash('error', msg);
        res.redirect('/auth/register');
      }
    });
  }
});

/* Login */
router.get('/login', (req, res, next) => {
  if (req.session.user) {
    res.redirect('/');
  }

  res.locals.errors = req.flash();
  console.log('flash', req.flash());
  res.render('auth/login', { title: 'ECL IDE' });
});

router.post('/login', (req, res, next) => {
  passport.authenticate('local', { session: true }, (err, user, info) => {
    if (err || !user) {
      req.flash('error', (info ? info.message : 'Login failed'));
      res.redirect('/auth/login');
    }

    console.log('set session user & go to index');
    req.session.user = user;
    res.redirect('/');
  })(req, res);
});

router.get('/logout', (req, res, next) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
