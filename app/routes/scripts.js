const express = require('express');
const router = express.Router();

const db = require('../models/index');

const fs = require('fs-extra');

const User = db.User;
const Workspace = db.Workspace;
const WorkspaceUser = db.WorkspaceUser;

const Dataset = db.Dataset;
const Script = db.Script;
const ScriptRevision = db.ScriptRevision;
const Workunit = db.Workunit;

router.get('/', (req, res, next) => {
  console.log('request query', req.query);
  const query = `SELECT s.id, s.name, sr.id AS revisionId, sr.content, \
    sr.createdAt, sr.updatedAt, w.workunitId \
    FROM Scripts AS s \
    LEFT JOIN ( \
      SELECT sr1.* FROM ScriptRevisions sr1 \
      LEFT JOIN ScriptRevisions sr2 ON sr2.scriptId = sr1.scriptId AND sr2.updatedAt > sr1.updatedAt \
      WHERE sr2.id IS NULL \
    ) AS sr ON sr.scriptId = s.id \
    LEFT JOIN Workunits AS w ON sr.id = w.objectId \
    WHERE s.workspaceId = "${req.query.workspaceId}" \
    AND (w.workunitId LIKE "W%" OR w.workunitId IS NULL) \
    AND s.deletedAt IS NULL \
    ORDER BY sr.updatedAt desc`;

  db.sequelize.query(query, {
    type: db.sequelize.QueryTypes.SELECT
  }).then((datasets) => {
    res.json(datasets);
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
    let scriptFilePath = process.cwd() + '/workspaces/' + script.workspaceId + '/scripts/' + script.name + '.ecl';
    if (!fs.existsSync(scriptFilePath)) {
      fs.closeSync(fs.openSync(scriptFilePath, 'w'));
    }
    return res.json({ success: true, data: script });
  }).catch((err) => {
    console.log(err);
    return res.json({ success: false, message: 'Script could not be saved' });
  });
});

/* Create script revision */
router.post('/revision', (req, res, next) => {
  console.log('request body', req.body);
  ScriptRevision.create({
    scriptId: req.body.scriptId,
    content: req.body.content
  }).then((revision) => {
    console.log('find script by id', req.body.scriptId);
    Script.findOne({
      where: {
        id: req.body.scriptId,
      }
    }).then((script) => {
      console.log('update contents of script file');
      let workspaceDirPath = process.cwd() + '/workspaces/' + script.workspaceId + '/scripts',
          scriptFilePath = workspaceDirPath + '/' + script.name + '.ecl';
      if (!fs.existsSync(workspaceDirPath)) {
        fs.mkdirSync(workspaceDirPath);
      }
      fs.writeFileSync(scriptFilePath, revision.content);
    }).then(() => {
      return res.json({ success: true, data: revision });
    });
  }).catch((err) => {
    console.log(err);
    return res.json({ success: false, message: 'Script Revision could not be saved' });
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
    Script.update(script, {
      where: {
        id: req.body.id
      }
    }).then((result) => {
      let currentScriptFilePath = process.cwd() + '/workspaces/' + script.workspaceId + '/scripts/' + req.body.prevName + '.ecl';
      let newScriptFilePath = process.cwd() + '/workspaces/' + script.workspaceId + '/scripts/' + script.name + '.ecl';
      if (fs.existsSync(currentScriptFilePath)) {
        fs.rename(currentScriptFilePath, newScriptFilePath);
      }
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
    let scriptFilePath = process.cwd() + '/workspaces/' + script.workspaceId + '/scripts/' + script.name + '.ecl';
    if (fs.existsSync(scriptFilePath)) {
      fs.unlinkSync(scriptFilePath);
    }
    Script.destroy({
      where: { id: script.id }
    });
  }).then(() => {
    res.json({ success: true, message: 'Script deleted' });
  }).catch((err) => {
    console.log(err);
    return res.json({ success: false, message: 'Script could not be deleted' });
  });
});
  });
});

module.exports = router;