const express = require('express');
const router = express.Router();

const db = require('../models/index');
const User = db.User;
const Script = db.Script;
const Workspace = db.Workspace;
const WorkspaceUser = db.WorkspaceUser;

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

module.exports = router;