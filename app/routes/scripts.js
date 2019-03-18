const express = require('express');
const router = express.Router();

const db = require('../models/index');

const User = db.User;
const Workspace = db.Workspace;
const WorkspaceUser = db.WorkspaceUser;

const Dataset = db.Dataset;
const Script = db.Script;
const Workunit = db.Workunit;

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

/* Update script */
router.put('/', (req, res, next) => {
  let script = {};
  if (req.body.name) script.name = req.body.name;
  if (req.body.filename) script.filename = req.body.filename;
  if (req.body.logicalfile) script.logicalfile = req.body.logicalfile;
  if (req.body.workspaceId) script.workspaceId = req.body.workspaceId;
  if (req.body.rowCount) script.rowCount = req.body.rowCount;
  if (req.body.columnCount) script.columnCount = req.body.columnCount;
  if (req.body.eclSchema) script.eclSchema = JSON.parse(req.body.eclSchema);
  if (Object.keys(script).length > 0) {
    Dataset.update(script, {
      where: {
        id: req.body.id
      }
    }).then((script) => {
      return res.json({ success: true, data: script });
    }).catch((err) => {
      console.log(err);
      return res.json({ success: false, message: 'Script could not be saved' });
    });
  }
});

/* Delete script */
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