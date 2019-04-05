const express = require('express');
const router = express.Router();

const db = require('../models/index');

const fs = require('fs-extra');

const User = db.User;
const Workspace = db.Workspace;
const WorkspaceUser = db.WorkspaceUser;

const Dataset = db.Dataset;
const Script = db.Script;
const Workunit = db.Workunit;

/* Create workspace */
router.post('/', (req, res, next) => {
  console.log('request body', req.body);
  Workspace.create({
    name: req.body.workspaceName,
    cluster: req.body.workspaceCluster
  }).then((workspace) => {
    let workspaceDirPath = process.cwd() + '/workspaces/' + workspace.id;
    if (!fs.existsSync(workspaceDirPath)) {
      fs.mkdirSync(workspaceDirPath);
    }
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

/* Update workspace */
router.put('/', (req, res, next) => {
  console.log('request body', req.body);
  let workspace = {};
  if (req.body.workspaceName) workspace.name = req.body.workspaceName;
  if (req.body.workspaceCluster) workspace.cluster = req.body.workspaceCluster;
  Workspace.update(workspace, {
    where: {
      id: req.body.id
    }
  }).then((result) => {
    return res.json({ success: true, data: workspace });
  }).catch((err) => {
    console.log(err);
    return res.json({ success: false, message: 'Workspace could not be saved' });
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
    let workspaceDirPath = process.cwd() + '/workspaces/' + workspace.id;
    if (fs.existsSync(workspaceDirPath)) {
      fs.removeSync(workspaceDirPath);
    }
    Workspace.destroy({
      where: { id: workspace.id }
    });
    WorkspaceUser.destroy({
      where: { workspaceId: workspace.id }
    });
    Dataset.destroy({
      where: { workspaceId: workspace.id }
    });
    Script.destroy({
      where: { workspaceId: workspace.id }
    });
  }).then(() => {
    res.json({ message: 'Workspace deleted' });
  });
});

module.exports = router;
