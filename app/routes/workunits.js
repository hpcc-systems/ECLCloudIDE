const express = require('express');
const router = express.Router();

const db = require('../models/index');

const User = db.User;
const Workspace = db.Workspace;
const WorkspaceUser = db.WorkspaceUser;

const Dataset = db.Dataset;
const Script = db.Script;
const Workunit = db.Workunit;

/* Create workunit */
router.post('/', (req, res, next) => {
  console.log('request body', req.body);
  Workunit.create({
    objectId: req.body.objectId,
    workunitId: req.body.workunitId
  }).then((workunit) => {
    return res.json(workunit);
  }).catch((err) => {
    console.log(err);
    return res.json({ message: 'Workunit could not be saved' });
  });
});

/* Delete workspace */
router.delete('/', (req, res, next) => {
  Workunit.destroy({
    where: {
      objectId: req.body.objectId,
      workunitId: req.body.workunitId
    }
  }).then(() => {
    res.json({ message: 'Workunit deleted' });
  });
});

module.exports = router;
