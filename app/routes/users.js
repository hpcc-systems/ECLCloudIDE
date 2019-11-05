const express = require('express');
const router = express.Router();

const bcrypt = require('bcrypt');

const db = require('../models/index');
const User = db.User;
const Workspace = db.Workspace;
const WorkspaceUser = db.WorkspaceUser;

/* GET users listing. */
router.get('/account', (req, res, next) => {
  res.locals.info = req.flash('info');
  let user = {
    id: req.session.user.id,
    username: req.session.user.username,
    emailVerified: req.session.user.emailVerified
  };
  res.render('users/account', { title: 'ECL IDE', user: user });
});

router.get('/workspaces', (req, res, next) => {
  User.findByPk(req.session.user.id, {
    include: [{
      model: Workspace,
      through: {
        where: { role: WorkspaceUser.roles.OWNER }
      }
    }]
  }).then((user) => {
    res.json(user.Workspaces);
  }).catch((err) => {
    console.log(err);
    res.json(err);
  });
});

router.get('/search', (req, res, next) => {
  User.findAll({
    attributes: ['id', 'username'],
    where: {
      [db.Sequelize.Op.and]: {
        id: { [db.Sequelize.Op.ne]: req.session.user.id },
        username: { [db.Sequelize.Op.like]: '%' + req.query.username + '%' },
        deletedAt: null
      }
    }
  }).then((users) => {
    res.json(users);
  }).catch((err) => {
    console.log(err);
    res.json(err);
  });
});

router.get('/password/change', (req, res, next) => {
  let user = {
    id: req.session.user.id,
    username: req.session.user.username,
    emailVerified: req.session.user.emailVerified
  };
  res.locals.errors = req.flash('error');
  res.locals.info = req.flash('info');
  console.log('locals', res.locals);
  res.render('users/change_password', { title: 'ECL IDE', user: user, csrfToken: req.csrfToken() });
});

router.post('/password/change', (req, res, next) => {
  User.findByPk(req.session.user.id, {
  }).then((user) => {
    let userParams = user.dataValues;
    console.log(userParams);
    bcrypt.hash(req.body.password, parseInt(process.env.SALT_ROUNDS, 10)).then((hash) => {
      console.log(hash);
      userParams.password = hash;
      console.log(userParams);
      User.update(userParams, {
        where: {
          id: user.id
        }
      }).then((result) => {
        let msg = 'Your password has been changed.';
        req.flash('info', msg);
        res.redirect('/users/password/change');
      }).catch((err) => {
        console.log(err);
        return res.json({ success: false, message: 'The Dataset could not be saved' });
      });
    });
  });
});

module.exports = router;
