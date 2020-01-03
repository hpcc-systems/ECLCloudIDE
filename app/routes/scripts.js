const express = require('express');
const router = express.Router();

const db = require('../models/index');

const cp = require('child_process');

const fs = require('fs-extra');

const User = db.User;
const Workspace = db.Workspace;
const WorkspaceUser = db.WorkspaceUser;

const Dataset = db.Dataset;
const Script = db.Script;
const ScriptRevision = db.ScriptRevision;
const Workunit = db.Workunit;

let eclccCmd = (args, cwd) => {
  console.log('in eclccCmd');
  //console.log('eclccCmd', cwd, args);
  return new Promise((resolve, _reject) => {
    console.log('eclcc ' + args.join(' '));
    const child = cp.spawn('eclcc', args, { cwd: cwd });
    let stdOut = "", stdErr = "";
    child.stdout.on("data", (data) => {
      stdOut += data.toString();
    });
    child.stderr.on("data", (data) => {
      stdErr += data.toString();
    });
    child.on("close", (_code, _signal) => {
      if (stdErr !== "") {
        _reject({
          stdout: stdOut.trim(),
          stderr: stdErr.trim()
        });
      }
      resolve({
        stdout: stdOut.trim(),
        stderr: stdErr.trim()
      });
    });
  });
};

router.get('/', (req, res, next) => {
  console.log('request query', req.query);
  const query = `SELECT s.id, s.name, sr.id AS revisionId, sr.content, \
    s.cluster, sr.createdAt, sr.updatedAt, w.workunitId \
    FROM Scripts AS s \
    LEFT JOIN ( \
      SELECT sr1.* FROM ScriptRevisions sr1 \
      LEFT JOIN ScriptRevisions sr2 ON sr2.scriptId = sr1.scriptId AND sr2.updatedAt > sr1.updatedAt \
      WHERE sr2.id IS NULL \
    ) AS sr ON sr.scriptId = s.id \
    LEFT JOIN Workunits AS w ON sr.id = w.objectId \
    WHERE s.workspaceId = :workspaceId \
    AND (w.workunitId LIKE "W%" OR w.workunitId IS NULL) \
    AND sr.id IS NOT NULL \
    AND s.deletedAt IS NULL \
    ORDER BY sr.updatedAt desc`;

  db.sequelize.query(query, {
    type: db.sequelize.QueryTypes.SELECT,
    replacements: { workspaceId: req.query.workspaceId }
  }).then((_scripts) => {
    let scripts = {};
    _scripts.forEach((script) => {
      scripts[script.id] = script
    });
    res.json(scripts);
  }).catch((err) => {
    console.log(err);
    res.json({ success: false, message: 'Could not retrieve Scripts for specified Workspace.' });
  });
});

/* Create script */
router.post('/', (req, res, next) => {
  console.log('request body', req.body);
  Script.create({
    name: req.body.scriptName,
    workspaceId: req.body.workspaceId,
    eclFilePath: req.body.parentPathNames
  }).then((script) => {
    let workspaceDirPath = process.cwd() + '/workspaces/' + script.workspaceId + '/scripts',
        scriptDirPath = workspaceDirPath + '/' + req.body.parentPathNames,
        scriptFilePath = scriptDirPath + '/' + script.name + '.ecl';

    if (!fs.existsSync(process.cwd() + '/workspaces/' + script.workspaceId)) {
      fs.mkdirpSync(process.cwd() + '/workspaces/' + script.workspaceId + '/scripts');
    }

    if (!fs.existsSync(scriptDirPath)) {
      fs.mkdirSync(scriptDirPath, { recursive: true }, (err) => {
        if (err) {
          throw err;
        }
      });
    }
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
  // console.log('request body', req.body);
  let path = req.body.path || '',
      args = [],
      workspaceDirPath = '',
      scriptDirPath = '',
      scriptFilePath = '';

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
      script.cluster = req.body.cluster;
      script.save({ fields: ['cluster'] });
      console.log('update contents of script file');
      workspaceDirPath = process.cwd() + '/workspaces/' + script.workspaceId + '/scripts/';
      scriptDirPath = workspaceDirPath + ( (path != '') ? path + '/' : '' );
      scriptFilePath = scriptDirPath + script.name + '.ecl';

      if (!fs.existsSync(scriptDirPath)) {
        fs.mkdirpSync(scriptDirPath);
      }

      console.log('write script revision content to fs - ' + scriptFilePath, revision.content.substring(0, 100));
      fs.writeFileSync(scriptFilePath, revision.content);

      args.push('-I', workspaceDirPath, '-syntax', scriptFilePath);
    }).then(() => {
      eclccCmd(args, workspaceDirPath).then((response) => {
        return res.json({ success: true, data: revision });
      }).catch((response) => {
        let errors = [], parsedErrors = [];
        if (response.stderr !== '') {
          errors = response.stderr.split(/\r\n/);
          errors.pop();
          errors.forEach((error) => {
            console.log(error);
            parsedErrors.push({
              'Source': 'eclcc',
              'Severity': 'Error',
              'FileName': error.match(new RegExp(/(.*)\(/))[1],
              'LineNo': error.match(new RegExp(/.*\(([0-9]+)/))[1],
              'Column': error.match(new RegExp(/.*\([0-9]+,([0-9]+)/))[1],
              'Message': error.match(new RegExp(/.*\):\s+error\s+[A-Z0-9]+\s*:\s+(.*)/))[1]
            });
          });
        }
        return res.json({ success: false, errors: parsedErrors, data: {} });
      });
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
      // let workspaceDirPath = process.cwd() + '/workspaces/' + script.workspaceId + '/scripts',
      //     currentScriptFilePath = workspaceDirPath + '/' + req.body.prevId + '/' + req.body.prevName + '.ecl',
      //     newScriptFilePath = workspaceDirPath + '/' + script.id + '/' + script.name + '.ecl';

      // if (fs.existsSync(currentScriptFilePath)) {
      //   fs.rename(currentScriptFilePath, newScriptFilePath);
      // }
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
    let workspaceDirPath = process.cwd() + '/workspaces/' + script.workspaceId + '/scripts',
        scriptFilePath = workspaceDirPath + '/' + script.id + '/' + script.name + '.ecl';
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

/* Delete multiple scripts */
router.delete('/batch', (req, res, next) => {
  console.log('request body', req.body);
  Script.findAll({
    where: {
      id: { [db.Sequelize.Op.in]: req.body.ids },
    }
  }).then((scripts) => {
    scripts.forEach((script) => {
      console.log(script.name, script.id);
      let workspaceDirPath = process.cwd() + '/workspaces/' + script.workspaceId + '/scripts',
          scriptFilePath = workspaceDirPath + '/' + script.id + '/' + script.name + '.ecl';
      if (fs.existsSync(scriptFilePath)) {
        fs.unlinkSync(scriptFilePath);
      }
      Script.destroy({
        where: { id: script.id }
      });
    });
  }).then(() => {
    res.json({ success: true, message: 'Scripts deleted' });
  }).catch((err) => {
    console.log(err);
    return res.json({ success: false, message: 'Scripts could not be deleted' });
  });
});

module.exports = router;