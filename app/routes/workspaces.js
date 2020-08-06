const express = require('express');
const router = express.Router();

const db = require('../models/index');

const multer = require('multer');
const _destPath = './landing_zone';
const _storage = multer.diskStorage({
  destination: function(req, file, callback) {
    callback(null, _destPath);
  },
  filename: function(req, file, callback) {
    callback(null, Date.now() + '_' + file.originalname);
  }
});
const upload = multer({ storage: _storage });

const fs = require('fs-extra');
const path = require('path');

const { param, body, validationResult } = require('express-validator/check');

const crypt = require('../utils/crypt');
const unzip = require('../utils/unzip');
const clusterWhitelist = require('../cluster-whitelist')[process.env.NODE_ENV];

const User = db.User;
const Workspace = db.Workspace;
const WorkspaceUser = db.WorkspaceUser;

const Dataset = db.Dataset;
const Script = db.Script;
const ScriptRevision = db.ScriptRevision;
const Workunit = db.Workunit;

const hpccFilesprayRouter = require('./hpcc_proxy/filespray');
const hpccWorkunitsRouter = require('./hpcc_proxy/workunits');

const workspacesCtrl = require('../controllers/workspaces');

let request = require('request-promise');
let _ = require('lodash');

/* Retrieve workspace by id */
router.get('/summary/:workspaceId', [
  param('workspaceId')
    .matches(/[0-9a-f]{8}\-([0-9a-f]{4}\-){3}[0-9a-f]{12}/).withMessage('Invalid workspace id')
], (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  return workspacesCtrl.getWorkspaceById(req, res, next);
});

/* Create workspace */
router.post('/', [
  body('workspaceName')
    .matches(/[a-zA-Z]{1}[a-zA-Z0-9_]*/).withMessage('Invalid workspace name'),
  body('workspaceCluster')
    .isIn(clusterWhitelist).withMessage('Invalid cluster')
], (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  console.log('request body', req.body);

  if (!clusterWhitelist.includes(req.body.workspaceCluster)) {
    return res.json({ success: false, message: 'Please select a valid cluster' });
  }

  return workspacesCtrl.createWorkspace(req, res, next);
});

/* Update workspace */
router.put('/', [
  body('workspaceName')
    .optional({ checkFalsy: true })
    .matches(/[a-zA-Z]{1}[a-zA-Z0-9_]*/).withMessage('Invalid workspace name')
    .escape(),
  // a weird issue with the isJSON() validator... evidently the first thing it does
  // is test that the value is a string, and then tries to use JSON.parse(...),
  // but a JSON parameter of the req object is already an object, so must be stringified
  function(req, res, next) { req.body.directoryTree = JSON.stringify(req.body.directoryTree); next(); },
  body('directoryTree')
    .optional({ checkFalsy: true})
    .isJSON().withMessage('Directory tree should be valid JSON'),
  body('folderName')
    .optional({ checkFalsy: true })
    .matches(/[a-zA-Z0-9_]*/).withMessage('Invalid folder name'),
  body('prevFolderName')
    .optional({ checkFalsy: true })
    .matches(/[a-zA-Z0-9_]*/).withMessage('Invalid folder name'),
  body('workspaceCluster')
    .optional({ checkFalsy: true })
    .isIn(clusterWhitelist).withMessage('Invalid cluster')
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  let _workspace = await Workspace.findOne({
    where: {
      id: req.body.id
    }, include: [{
      model: User,
      through: { userId: req.session.user.id }
    }]
  }).catch((err) => {
    console.log(err);
    return res.json({ success: false, message: 'Workspace could not be saved' });
  });

  if (_workspace.Users[0].dataValues.id !== req.session.user.id) {
    return res.status(403).send('Forbidden');
  }

  console.log('request body', req.body);

  if (req.body.workspaceCluster && !clusterWhitelist.includes(req.body.workspaceCluster)) {
    return res.json({ success: false, message: 'Please select a valid cluster' });
  }

  return workspacesCtrl.updateWorkspace(req, res, next);
});

/* Delete workspace */
router.delete('/', (req, res, next) => {
  return workspacesCtrl.deleteWorkspace(req, res, next);
});

let shareWorkspace = async (workspaceId, user) => {
  let _directoryTree = null,
      newWorkspaceId = null;

  return new Promise((resolve, reject) => {
    Workspace.findOne({
      where: { id: workspaceId },
      include: [{
        model: User,
        through: {
          where: { role: WorkspaceUser.roles.OWNER }
        }
      }, {
        model: Script
      }, {
        model: Dataset
      }]
    }).then(async (workspaceToClone) => {
      if (workspaceToClone == null) {
        // console.log('workspace ' + workspaceId + ' not found');
        reject({ success: false, message: 'The workspace you attempted to copy has been deleted by its owner' });
      }
      // console.log(workspaceToClone.Users[0].username);
      // console.log(workspaceToClone.Scripts.length + ' Scripts');
      // console.log(workspaceToClone.Datasets.length + ' Datasets');
      let clonedWorkspaceName = await workspacesCtrl.getUniqueWorkspaceName(workspaceToClone, user);

      _directoryTree = workspaceToClone.directoryTree;

      Workspace.create({
        name: clonedWorkspaceName,
        cluster: workspaceToClone.cluster,
        directoryTree: workspaceToClone.directoryTree
      }).then((newWorkspace) => {
        newWorkspaceId = newWorkspace.id;

        let oldWorkspaceScope = workspaceToClone.Users[0].username + '::' + workspaceToClone.name,
            newWorkspaceScope = user.name + '::' + newWorkspace.name;

        let _promises = [];

        WorkspaceUser.create({
          userId: user.id,
          workspaceId: newWorkspace.id,
          role: WorkspaceUser.roles.OWNER
        });
        console.log(workspaceToClone.name);

        let _createScripts = (scriptToClone) => {
          return new Promise((resolve) => {
            console.log('scriptToClone', scriptToClone.name);
            ScriptRevision.findOne({
              where: {
                [db.Sequelize.Op.and]: {
                  scriptId: scriptToClone.id,
                  deletedAt: null
                }
              },
              order: [ ['createdAt', 'DESC'] ]
            }).then((revision) => {
              let _content = '';
              if (revision && revision.content) {
                console.log(revision.content);
                _content = revision.content.replace(new RegExp(oldWorkspaceScope, 'g'), newWorkspaceScope);
              }
              Script.create({
                name: scriptToClone.name,
                workspaceId: newWorkspace.id,
                eclFilePath: scriptToClone.eclFilePath
              }).then((newScript) => {
                ScriptRevision.create({
                  content: _content,
                  scriptId: newScript.id
                });
                let _regex = new RegExp(scriptToClone.id, 'g');
                _directoryTree = _directoryTree.replace(_regex, newScript.id);
                console.log(_regex.toString(), newScript.id, _directoryTree);
                let _scriptDirPath = process.cwd() + '/workspaces/' + newScript.workspaceId +
                      '/scripts/' + newScript.eclFilePath,
                    _scriptFilePath = _scriptDirPath + '/' + newScript.name + '.ecl';

                console.log('creating directory: ' + _scriptDirPath);
                if (!fs.existsSync(_scriptDirPath)) { fs.mkdirpSync(_scriptDirPath); }
                console.log('creating ECL file: ' + _scriptFilePath);
                fs.writeFileSync(_scriptFilePath, _content);
                resolve();
              });
            });
          });
        };
        _promises = _promises.concat(workspaceToClone.Scripts.map(_createScripts));
        // console.log(_promises.length + ' PROMISES!!!!!!!!!!!!!!!! ---- Scripts');


        let _createDatasets = (datasetToClone) => {
          return new Promise((resolve) => {
            console.log('cloning ' + datasetToClone.filename);
            let filename = datasetToClone.filename,
                clusterAddr = newWorkspace.cluster,
                clusterPort = null,
                wuid = null;

            if (clusterAddr.substring(0, 4) != 'http') {
              clusterAddr = 'http://' + clusterAddr;
            }

            request({
              uri: clusterAddr + '/WsTopology/TpDropZoneQuery.json',
              json: true
            })
            .then((json) => {
              let dropzone = json.TpDropZoneQueryResponse.TpDropZones.TpDropZone[0];

              return dropzone.TpMachines.TpMachine[0].Netaddress;
            }).then((dropzoneIp) => {
              console.log(dropzoneIp);
              hpccFilesprayRouter.sprayFile(clusterAddr, filename, user.name, newWorkspace.name, dropzoneIp)
                .then((response) => {
                  console.log(response.body);
                  let json = JSON.parse(response.body);
                  wuid = json.SprayResponse.wuid;

                  Dataset.create({
                    name: datasetToClone.name,
                    filename: datasetToClone.filename,
                    logicalfile: newWorkspaceScope + '::' + datasetToClone.filename + '_thor',
                    rowCount: datasetToClone.rowCount,
                    columnCount: datasetToClone.columnCount,
                    eclSchema: datasetToClone.eclSchema,
                    eclQuery: (datasetToClone.eclQuery) ?
                      datasetToClone.eclQuery.replace(new RegExp(oldWorkspaceScope, 'g'), newWorkspaceScope) :
                      '',
                    workspaceId: newWorkspace.id
                  }).then((newDataset) => {
                    let _regex = new RegExp(datasetToClone.id, 'g');
                    _directoryTree = _directoryTree.replace(_regex, newDataset.id);
                    console.log(_regex.toString(), newDataset.id, _directoryTree);

                    Workunit.create({
                      workunitId: wuid,
                      objectId: newDataset.id
                    }).then(() => {
                      hpccWorkunitsRouter.createWorkunit(clusterAddr)
                        .then((response) => {
                          let json = JSON.parse(response.body),
                              wuid = json.WUCreateResponse.Workunit.Wuid;

                          Workunit.create({
                            workunitId: wuid,
                            objectId: newDataset.id
                          });
                          hpccWorkunitsRouter.updateWorkunit(clusterAddr, wuid, newDataset.eclQuery);
                          hpccWorkunitsRouter.submitWorkunit(clusterAddr, wuid);
                          resolve();
                        }).catch((err) => {
                          console.log(err);
                          return reject(err);
                        });
                    })
                  });
                }).catch((err) => {
                  console.log(err);
                  return reject(err);
                });
            });
          });
        };
        _promises = _promises.concat(workspaceToClone.Datasets.map(_createDatasets));
        // console.log(_promises.length + ' PROMISES!!!!!!!!!!!!!!!! ---- DataSets');

        Promise.all(_promises).then(() => {
          // console.log(_promises.length + ' PROMISES!!!!!!!!!!!!!!!! ---- ALL');
          let _workspace = {
            directoryTree: _directoryTree
          };
          console.log('new workspace???');
          console.log(_workspace);
          Workspace.update(_workspace, {
            where: {
              id: newWorkspaceId
            }
          }).then(() => {
             return resolve({ success: true, message: 'Workspace shared', workspaceId: newWorkspaceId });
          });
        });
      });
    }).catch((err) => {
      return reject({ success: false, message: 'There was an error importing the workspace' });
    });
  }) //end new Promise(...)
};

/* Share workspace */
router.get('/share/:id', async (req, res, next) => {
  let workspaceId = req.params.id,
      user = { id: req.session.user.id, name: req.session.user.username };
  // console.log(workspaceId, user);
  try {
    let result = await shareWorkspace(workspaceId, user);
    // console.log('result: '+result);
    req.flash('info', 'Workspace imported succesfully.');
    req.flash('info', result);
  } catch(err) {
    req.flash('error', err.message);
  }

  return req.session.save(() => { res.redirect('/'); });
});



/* Fetch cluster info (name of thors, etc) */
router.get('/clusters/:id', async (req, res, next) => {
  try {
    let clusters = await workspacesCtrl.getClusterInfo(req.params.id);
    return res.json({ success: true, clusters: clusters });
  } catch(err) {
    console.log(err);
    return res.json({ success: false, message: err.message });
  }
});


router.get('/export/zip/:workspaceId', async (req, res, next) => {
  return workspacesCtrl.exportWorkspaceAsZip(req, res, next);
});

router.post('/import/zip/', [ upload.single('file') ], (req, res, next) => {
  // console.log(req.file);
  return workspacesCtrl.importWorkspaceFromZip(req, res, next);
});

router.get('/dropzones/:id', async (req, res, next) => {
  let dropzones = await workspacesCtrl.getDropzoneInfo(req.params.id);
  return res.json({ dropzones: dropzones });
});

module.exports = router;