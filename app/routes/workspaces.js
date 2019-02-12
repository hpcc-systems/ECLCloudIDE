const express = require('express');
const router = express.Router();

const db = require('../models/index');
const User = db.User;
const Workspace = db.Workspace;
const WorkspaceUser = db.WorkspaceUser;

/* Create workspace */
router.post('/', (req, res, next) => {
  console.log('request body', req.body);
  Workspace.create({ name: req.body.workspaceName }).then((workspace) => {
    WorkspaceUser.create({
      role: WorkspaceUser.roles.OWNER,
      workspaceId: workspace.id,
      userId: req.session.user.id
    }).then((workspaceUser) => {
      return res.json(workspace);
    });
  }).catch((err) => {
    console.log(err);
    return res.json({ message: 'Workspace could not be saved' });
  });
});

/* Delete workspace */
router.delete('/', (req, res, next) => {
  Workspace.findOne({
    where: { name: req.body.workspaceName },
    through: {
      where: { role: WorkspaceUser.roles.OWNER }
    }
  }).then(workspace => {
    workspace.destroy();
    WorkspaceUser.destroy({
      where: { workspaceId: workspace.id }
    });
  }).then(() => {
    res.json({ message: 'Workspace deleted' });
  });
});

module.exports = router;
