const express = require('express');
const passport = require('passport');

const validator = require('express-validator');

const nodemailer = require('nodemailer');

const bcrypt = require('bcrypt');

const db = require('../models/index');
const User = db.User;
const PasswordReset = db.PasswordReset;

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
          User.create({
            username: req.body.username,
            emailAddress: req.body.emailaddress,
            password: hash
          }).then((user) => {
            req.session.user = user;
            if (req.session.goToUrl) {
              let url = req.session.goToUrl;
              delete req.session.goToUrl;
              console.log(url, req.session.goToUrl);
              res.redirect(url);
            } else {
              res.redirect('/');
            }
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

  res.locals.errors = req.flash('error');
  res.locals.info = req.flash('info');
  console.log('locals', res.locals);
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
    if (req.session.goToUrl) {
      let url = req.session.goToUrl;
      delete req.session.goToUrl;
      console.log(url, req.session.goToUrl);
      res.redirect(url);
    } else {
      res.redirect('/');
    }
  })(req, res);
});

router.get('/forgot', (req, res, next) => {
  if (req.session.user) {
    res.redirect('/');
  }

  res.render('auth/forgot', { title: 'ECL IDE' });
});

router.post('/forgot', (req, res, next) => {
  // res.redirect('/');

  let sendMail = async (recipients, subject = '', message = '') => {
    let transporter = nodemailer.createTransport({
      host: 'appmail.choicepoint.net',
      port: 25,
      secure: false, // true for 465, false for other ports
      auth: {},
      tls: {
        rejectUnauthorized: false
      }
    });
    let info = await transporter.sendMail({
      from: '"ECL IDE ' + Buffer.from('F09FA496', 'hex').toString('utf8') + '" <ecl-ide@hpccsystems.com>', // sender address
      to: recipients.join(','), // list of receivers
      subject: (subject != '') ? subject : 'Subject', // Subject line
      html: (message != '') ? message : 'Message' // html body
    });

    console.log("Message sent: %s", info.messageId);
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  };

  User.findOne({
    where: {
      emailAddress: req.body.emailaddress
    }
  }).then((user) => {
    if (user != null) {
      let recipients = [ user.emailAddress ],
          subject = 'Password Reset',
          message = '';

      PasswordReset.create({
        userId: user.id
      }).then((reset) => {
        let url = req.protocol + '://' + req.get('host') + '/auth/reset/' + reset.id;
        message += '<p>A password reset url has been requested for the ECL Cloud IDE account ' +
          'associated with the email address "' + user.emailAddress + '" Click the link below ' +
          'to complete this reset:</p><p><a href="' + url + '">' + url + '</a>';
        sendMail(recipients, subject, message).catch(console.error);
      });
    }
    let msg = 'If an account for the specified email address exists, a password ' +
      'reset email has been sent.';
    req.flash('info', msg);
    res.redirect('/auth/login');
  }).catch((err) => {
    console.log(err);
  });
});

router.get('/reset/:id', (req, res, next) => {
  PasswordReset.findOne({
    where: {
      id: req.params.id,
      deletedAt: null,
    },
    include: User,
    order: [
      [ 'createdAt', 'DESC' ]
    ]
  }).then((reset) => {
    if (reset == null) {
      let msg = 'This password reset url is no longer valid.';
      req.flash('error', msg);
      res.redirect('/auth/login');
    } else {
      res.render('auth/reset', { title: 'ECL IDE', id: req.params.id });
    }
  });
});

router.post('/reset/:id', (req, res, next) => {
  PasswordReset.findOne({
    where: {
      id: req.params.id,
      deletedAt: null,
    },
    include: User,
    order: [
      [ 'createdAt', 'DESC' ]
    ]
  }).then((reset) => {
    console.log('resetting password for user ' + reset.User.id);
    console.log('new password ' + req.body.password);

    let userParams = reset.User.dataValues;
    bcrypt.hash(req.body.password, parseInt(process.env.SALT_ROUNDS, 10)).then((hash) => {
      userParams.password = hash;
      User.update(userParams, {
        where: {
          id: reset.User.id
        }
      }).then((user) => {
        PasswordReset.destroy({
          where: { id: reset.id }
        });
        let msg = 'Your password has been reset.';
        req.flash('info', msg);
        res.redirect('/auth/login');
      }).catch((err) => {
        console.log(err);
      });
    }).catch((err) => {
      console.log(err);
    });
  });
});

router.get('/logout', (req, res, next) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
