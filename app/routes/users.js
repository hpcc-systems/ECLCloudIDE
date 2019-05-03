const express = require('express');
const router = express.Router();

const db = require('../models/index');
const User = db.User;
const Workspace = db.Workspace;
const WorkspaceUser = db.WorkspaceUser;

/* GET users listing. */
router.get('/account', (req, res, next) => {
  let user = {
    id: req.session.user.id,
    username: req.session.user.username
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

module.exports = router;
