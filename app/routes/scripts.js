const express = require('express');
const router = express.Router();

const db = require('../models/index');

const cp = require('child_process');

const hsqlc = require('@hpcc-systems/hsqlc');

const { EOL } = require('os');

const fs = require('fs-extra');
const path = require('path');

const { body, validationResult } = require('express-validator');

const allowedScriptExtensions = [ '.hsql', '.ecl' ];

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
  const query = `SELECT s.id, s.name, sr.id AS revisionId, sr.content, \
    s.cluster, s.eclFilePath AS path, sr.createdAt, sr.updatedAt, w.workunitId \
    FROM Scripts AS s \
    LEFT JOIN ( \
      SELECT sr1.* FROM ScriptRevisions sr1 \
      LEFT JOIN ScriptRevisions sr2 ON sr2.scriptId = sr1.scriptId AND sr2.updatedAt > sr1.updatedAt \
      WHERE sr2.id IS NULL \
    ) AS sr ON sr.scriptId = s.id \
    LEFT JOIN Workunits AS w ON sr.id = w.objectId \
    LEFT JOIN Workspaces AS ws ON s.workspaceId = ws.id \
    LEFT JOIN WorkspaceUsers AS wsu ON wsu.workspaceId = ws.id \
    WHERE s.workspaceId = :workspaceId \
    AND wsu.role = :owner \
    AND wsu.userId = :userId \
    AND (w.workunitId LIKE "W%" OR w.workunitId IS NULL) \
    AND sr.id IS NOT NULL \
    AND s.deletedAt IS NULL \
    ORDER BY sr.updatedAt desc`;

  db.sequelize.query(query, {
    type: db.sequelize.QueryTypes.SELECT,
    replacements: {
      workspaceId: req.query.workspaceId,
      owner: WorkspaceUser.roles.OWNER,
      userId: req.session.user.id
    }
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
router.post('/', [
    body('scriptName')
      .matches(/^[a-zA-Z]{1}[a-zA-Z0-9_\.]*$/).withMessage('Invalid script name')
      .escape(),
    body('workspaceId')
      .isUUID(4).withMessage('Invalid workspace id'),
    body('parentPathNames')
      .optional({ checkFalsy: true})
      .matches(/^[a-zA-Z0-9\/]+$/).withMessage('Invalid path for script')
], (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  Workspace.findOne({
    where: { id: req.body.workspaceId },
    include: [{
      model: User,
      through: { userId: req.session.user.id }
    }]
  }).then(async workspace => {
    if (workspace.Users[0].dataValues.id !== req.session.user.id) {
      return res.status(403).send('Forbidden');
    }

    let _script = null;
    _script = await Script.findOne({
      where: {
        name: req.body.scriptName,
        workspaceId: req.body.workspaceId,
        eclFilePath: req.body.parentPathNames
      }
    });
    // console.log(_script);
    if (_script != null) {
      return res.json({ success: false, message: 'A script with this name already exists' })
    }

    let extension = req.body.scriptName.substr(req.body.scriptName.lastIndexOf('.'))

    if (!allowedScriptExtensions.includes(extension)) {
      req.body.scriptName += '.ecl';
    }

    Script.create({
      name: req.body.scriptName,
      workspaceId: req.body.workspaceId,
      eclFilePath: req.body.parentPathNames
    }).then((script) => {
      let workspaceDirPath = process.cwd() + '/workspaces/' + script.workspaceId + '/scripts',
          scriptDirPath = workspaceDirPath + '/' + req.body.parentPathNames,
          scriptFilePath = scriptDirPath + '/' + script.name;

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
  }).catch((err) => {
      console.log(err);
      return res.json({ success: false, message: 'Script could not be saved' });
    });
});

/* Create script revision */
router.post('/revision', [
    body('scriptId')
      .isUUID(4).withMessage('Invalid script id'),
    body('path')
      .optional({ checkFalsy: true})
      .matches(/^[a-zA-Z0-9\/]+$/).withMessage('Invalid path for script'),
], (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  // console.log('request body', req.body);
  let path = req.body.path || '',
      workspaceDirPath = '',
      scriptDirPath = '',
      scriptFilePath = '';

  Script.findOne({
    where: {
      id: req.body.scriptId,
    }
  }).then((script) => {
    script.getWorkspace({
      include: [{
        model: User,
        through: { userId: req.session.user.id }
      }]
    }).then(workspace => {
      if (workspace.Users[0].dataValues.id !== req.session.user.id) {
        return res.status(403).send('Forbidden');
      }

      ScriptRevision.create({
        scriptId: req.body.scriptId,
        content: req.body.content
      }).then((revision) => {
        let extension = script.name.substr(script.name.lastIndexOf('.'));

        if (!allowedScriptExtensions.includes(extension)) {
          script.name += '.ecl';
        }

        script.cluster = req.body.cluster;
        script.save({ fields: ['cluster'] });
        console.log('update contents of script file');
        workspaceDirPath = process.cwd() + '/workspaces/' + script.workspaceId + '/scripts/';
        scriptDirPath = workspaceDirPath + ( (path != '') ? path + '/' : '' );
        scriptFilePath = scriptDirPath + script.name;

        if (!fs.existsSync(scriptDirPath)) {
          fs.mkdirpSync(scriptDirPath);
        }

        console.log('write script revision content to fs - ' + scriptFilePath, revision.content.substring(0, 100));
        fs.writeFileSync(scriptFilePath, revision.content);

        return res.json({ success: true, data: revision });
      }).catch((err) => {
        console.log(err);
        return res.json({ success: false, message: 'Script Revision could not be saved' });
      });

    }).catch((err) => {
      console.log(err);
      return res.json({ success: false, message: 'Script Revision could not be saved' });
    });

  }).catch((err) => {
    console.log(err);
    return res.json({ success: false, message: 'Script Revision could not be saved' });
  });

});

/* Compile script */
router.post('/compile', [
    body('scriptId')
      .isUUID(4).withMessage('Invalid script id'),
    body('path')
      .optional({ checkFalsy: true})
      .matches(/^[a-zA-Z0-9\/]+$/).withMessage('Invalid path for script'),
], (req, res, next) => {
  let filepath = req.body.path || '',
      args = [],
      workspaceDirPath = '',
      scriptDirPath = '',
      scriptFilePath = '';

  Script.findOne({
    where: {
      id: req.body.scriptId,
    }
  }).then((script) => {
    let extension = script.name.substr(script.name.lastIndexOf('.'));

    script.cluster = req.body.cluster;
    script.save({ fields: ['cluster'] });
    console.log('update contents of script file');
    workspaceDirPath = path.join(process.cwd(), 'workspaces', script.workspaceId, 'scripts');
    scriptDirPath = path.join(workspaceDirPath, filepath);
    scriptFilePath = path.join(scriptDirPath, script.name);

    args.push('-I', workspaceDirPath, '-syntax', scriptFilePath);

    switch (extension) {
      case '.hsql':
        hsqlc.fileToECL(path.parse(scriptFilePath)).then(eclTranslationResult => {
          let parsedErrors = [];
          if (eclTranslationResult.getErrorsList().length > 0) {
            //Has Errors
            eclTranslationResult.getErrorsList().map(e => {
              parsedErrors.push({
                'Source': 'hsqlc',
                'Severity': 'Error',
                'FileName': script.name,
                'LineNo': e.line,
                'Column': e.column,
                'Message': e.msg
              });
            });
            return res.json({ success: false, errors: parsedErrors, data: {} });
          }
          return res.json({ success: true });
        });
        break;
      case '.ecl':
      default:
        eclccCmd(args, workspaceDirPath).then((response) => {
          return res.json({ success: true });
        }).catch((response) => {
          console.log(response);
          let errors = [], parsedErrors = [];
          if (response.stderr !== '') {
            errors = response.stderr.split(EOL);
            // errors.pop();
            errors.forEach((error) => {
              console.log(error);
              if (error.match(new RegExp(/.*\):\s+(error|warning)\s+[A-Z0-9]+\s*:\s+(.*)/))) {
                parsedErrors.push({
                  'Source': 'eclcc',
                  'Severity': 'Error',
                  'FileName': error.match(new RegExp(/(.*)\(/))[1],
                  'LineNo': error.match(new RegExp(/.*\(([0-9]+)/))[1],
                  'Column': error.match(new RegExp(/.*\([0-9]+,([0-9]+)/))[1],
                  'Message': error.match(new RegExp(/.*\):\s+(error|warning)\s+[A-Z0-9]+\s*:\s+(.*)/))[2]
                });
              }
            });
          }
          return res.json({ success: false, errors: parsedErrors, data: {} });
        });
        break;
    }
  });
});

/* Update script */
router.put('/', [
    body('id')
      .isUUID(4).withMessage('Invalid script id'),
    body('name')
      .matches(/^[a-zA-Z]{1}[a-zA-Z0-9_\.]*$/).withMessage('Invalid script name')
      .escape(),
    body('path')
      .optional({ checkFalsy: true})
      .matches(/^[a-zA-Z0-9\/]+$/).withMessage('Invalid path for script'),
    body('workspaceId')
      .isUUID(4).withMessage('Invalid workspace id'),
], (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  Script.findOne({
    where: {
      id: req.body.id,
    }
  }).then((_script) => {
    _script.getWorkspace({
      include: [{
        model: User,
        through: { userId: req.session.user.id }
      }]
    }).then(async workspace => {
      if (workspace.Users[0].dataValues.id !== req.session.user.id) {
        return res.status(403).send('Forbidden');
      }

      let __script = null;
      __script = await Script.findOne({
        where: {
          name: req.body.name,
          workspaceId: req.body.workspaceId,
          eclFilePath: req.body.path
        }
      });
      // console.log(__script);
      if (__script != null) {
        return res.json({ success: false, message: 'A script with this name already exists' })
      }

      let script = {},
          path = req.body.path || '',
          extension = req.body.name.substr(req.body.name.lastIndexOf('.'));

      if (req.body.name) {
        if (!allowedScriptExtensions.includes(extension)) {
          req.body.name += '.ecl';
        }
        script.name = req.body.name;
      }
      if (req.body.filename) script.filename = req.body.filename;
      if (req.body.logicalfile) script.logicalfile = req.body.logicalfile;
      if (req.body.workspaceId) script.workspaceId = req.body.workspaceId;
      if (req.body.rowCount) script.rowCount = req.body.rowCount;
      if (req.body.columnCount) script.columnCount = req.body.columnCount;
      if (req.body.eclSchema) script.eclSchema = JSON.parse(req.body.eclSchema);
      if (Object.keys(script).length > 0) {
        let workspaceDirPath = process.cwd() + '/workspaces/' + script.workspaceId + '/scripts/',
            scriptDirPath = workspaceDirPath + ( (path != '') ? path + '/' : '' ),
            currentScriptFilePath = scriptDirPath + req.body.prevName,
            newScriptFilePath = scriptDirPath + script.name;

        if (fs.existsSync(currentScriptFilePath)) {
          fs.rename(currentScriptFilePath, newScriptFilePath, (err) => {
            if (err) {
              console.log(err);
              return res.json({ success: false, message: 'Script could not be saved' });
            }
          });

          Script.update(script, {
            where: {
              id: req.body.id
            }
          }).then((result) => {
            return res.json({ success: true, data: script });
          }).catch((err) => {
            console.log(err);
            return res.json({ success: false, message: 'Script could not be saved' });
          });
        } else {
          return res.json({ success: false, message: 'Script could not be saved' });
        }
      } //end if Object.keys(script).length > 0
    }).catch((err) => { // error from script.getWorkspace
      console.log(err);
      return res.json({ success: false, message: 'Script could not be saved' });
    });
  }).catch((err) => { // error from Script.findOne
    console.log(err);
    return res.json({ success: false, message: 'Script could not be saved' });
  });
});

/* Delete script */
router.delete('/', (req, res, next) => {
  console.log('request body', req.body);
  Script.findOne({
    where: {
      id: req.body.scriptId,
    }
  }).then((script) => {
     script.getWorkspace({
      include: [{
        model: User,
        through: { userId: req.session.user.id }
      }]
    }).then(workspace => {
      if (workspace.Users[0].dataValues.id !== req.session.user.id) {
        return res.status(403).send('Forbidden');
      }
      let path = req.body.path || '';
      let workspaceDirPath = process.cwd() + '/workspaces/' + script.workspaceId + '/scripts/',
          scriptDirPath = workspaceDirPath + ( (path != '') ? path + '/' : '' ),
          scriptFilePath = scriptDirPath + script.name + '.ecl';
      if (fs.existsSync(scriptFilePath)) {
        fs.unlinkSync(scriptFilePath);
      }
      Script.destroy({
        where: { id: script.id }
      }).then(() => {
        res.json({ success: true, message: 'Script deleted' });
      })
    }).catch((err) => {
      console.log(err);
      return res.json({ success: false, message: 'Script could not be deleted' });
    });
  }).catch((err) => {
    console.log(err);
    return res.json({ success: false, message: 'Script could not be deleted' });
  });
});

/* Delete multiple scripts */
router.delete('/batch', (req, res, next) => {
  // console.log('request body', req.body);
  Workspace.findOne({
    where: {
      id: req.body.workspaceId,
    },
    include: [{
      model: User,
      through: { userId: req.session.user.id }
    }]
  }).then((workspace) => {
    if (workspace.Users[0].dataValues.id !== req.session.user.id) {
      return res.status(403).send('Forbidden');
    }

    fs.remove(process.cwd() + '/workspaces/' + req.body.workspaceId + '/scripts/' + req.body.path);

    Script.destroy({
      where: {
        id: { [db.Sequelize.Op.in]: req.body.ids },
      }
    }).then(() => {
      res.json({ success: true, message: 'Scripts deleted' });
    });
  }).catch((err) => {
    console.log(err);
    return res.json({ success: false, message: 'Scripts could not be deleted' });
  });
});

module.exports = router;