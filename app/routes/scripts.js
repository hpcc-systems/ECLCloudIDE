const express = require('express');
const router = express.Router();

const db = require('../models/index');
const User = db.User;
const Script = db.Script;
const Workspace = db.Workspace;
const WorkspaceUser = db.WorkspaceUser;

router.get('/', (req, res, next) => {
  console.log('request query', req.query);
  Script.findAll({
    where: {
      workspaceId: req.query.workspaceId
    }
  }).then((workspaces) => {
    res.json(workspaces);
  }).catch((err) => {
    console.log(err);
    res.json(err);
  });
});

/* Create script */
router.post('/', (req, res, next) => {
  console.log('request body', req.body);
  Script.create({
    name: req.body.scriptName,
    workspaceId: req.body.workspaceId
  }).then((script) => {
    return res.json(script);
  }).catch((err) => {
    console.log(err);
    return res.json({ message: 'Script could not be saved' });
  });
});

/* Create script */
router.delete('/', (req, res, next) => {
  console.log('request body', req.body);
  Script.findOne({
    where: {
      id: req.body.scriptId,
    }
  }).then((script) => {
    Script.destroy({
      where: { id: script.id }
    });
  }).then(() => {
    res.json({ message: 'Script deleted' });
  }).catch((err) => {
    console.log(err);
    return res.json({ message: 'Script could not be saved' });
  });
});

module.exports = router;