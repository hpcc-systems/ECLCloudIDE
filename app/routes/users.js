const express = require('express');
const router = express.Router();

const db = require('../models/index');
const User = db.User;
const Workspace = db.Workspace;
const WorkspaceUser = db.WorkspaceUser;

/* GET users listing. */
router.get('/account', (req, res, next) => {
  res.render('users/account', { title: 'ECL IDE' });
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

module.exports = router;
