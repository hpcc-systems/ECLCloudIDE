const express = require('express');
const router = express.Router();

const db = require('../models/index');

const fs = require('fs-extra');

const { param, body, validationResult } = require('express-validator/check');

const crypt = require('../utils/crypt');
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

  Workspace.findOne({
    where: { id: req.params.workspaceId },
    attributes: [ 'id', 'name', 'cluster', 'createdAt' ],
    include: [{
      model: User,
      attributes: [ 'username' ],
      through: {
        where: { role: WorkspaceUser.roles.OWNER },
        attributes: []
      }
    }]
  }).then((workspace) => {
    delete workspace.dataValues.clusterPwd;
    return res.json({ success: true, data: workspace });
  }).catch((err) => {
    console.log(err);
    return res.json({ success: false, message: 'Workspace could not found' });
  });
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

  Workspace.create({
    name: req.body.workspaceName,
    cluster: req.body.workspaceCluster,
    clusterUser: (req.body.clusterUsername != '') ? req.body.clusterUsername : null,
    clusterPwd: (req.body.clusterPassword != '') ? crypt.encrypt(req.body.clusterPassword) : null
  }).then((workspace) => {
    let workspaceDirPath = process.cwd() + '/workspaces/' + workspace.id;
    if (!fs.existsSync(workspaceDirPath)) {
      fs.mkdirpSync(workspaceDirPath + '/scripts');
      fs.mkdirpSync(workspaceDirPath + '/datasets');
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

  let workspace = {},
      path = req.body.path || '';

  if (req.body.workspaceName) workspace.name = req.body.workspaceName;
  if (req.body.directoryTree) workspace.directoryTree = req.body.directoryTree;
  if (req.body.workspaceCluster) workspace.cluster = req.body.workspaceCluster;
  if (req.body.clusterUsername) {
    workspace.clusterUser = req.body.clusterUsername;
  } else if (req.body.clusterUsername === '') {
    workspace.clusterUser = null;
  }
  if (req.body.clusterPassword) {
    workspace.clusterPwd = crypt.encrypt(req.body.clusterPassword);
  } else if (req.body.clusterPassword === '') {
    workspace.clusterPwd = null;
  }

  if (req.body.prevFolderName && req.body.folderName) {

    let workspaceDirPath = process.cwd() + '/workspaces/' + req.body.id +
          '/' + req.body.folderType + '/',
        folderDirPath = workspaceDirPath + ( (path != '') ? path + '/' : '' ),
        currentFolderPath = folderDirPath + req.body.prevFolderName + '/',
        newFolderPath = folderDirPath + req.body.folderName + '/';

    if (fs.existsSync(currentFolderPath)) {
      fs.rename(currentFolderPath, newFolderPath, (err) => {
        if (err) {
          console.log(err);
          return res.json({ success: false, message: 'Folder could not be saved' });
        }

        Workspace.update(workspace, {
          where: {
            id: req.body.id
          }
        }).then((result) => {
          workspace.clusterPwd = req.body.clusterPassword;
          return res.json({ success: true, data: workspace });
        }).catch((err) => {
          console.log(err);
          return res.json({ success: false, message: 'Workspace could not be saved' });
        });
      });
    } else {
      return res.json({ success: false, message: 'Folder could not be saved' });
    }

  } else {
    Workspace.update(workspace, {
      where: {
        id: req.body.id
      }
    }).then((result) => {
      workspace.clusterPwd = req.body.clusterPassword;
      return res.json({ success: true, data: workspace });
    }).catch((err) => {
      console.log(err);
      return res.json({ success: false, message: 'Workspace could not be saved' });
    });
  }
});

/* Delete workspace */
router.delete('/', (req, res, next) => {
  Workspace.findOne({
    where: { id: req.body.workspaceId },
    include: [{
      model: User,
      through: { userId: req.session.user.id }
    }]
  }).then(workspace => {
    if (workspace.Users[0].dataValues.id !== req.session.user.id) {
      return res.status(403).send('Forbidden');
    }

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

let getUniqueWorkspaceName = async (workspaceToClone, user) => {
  let clonedWorkspaceName = workspaceToClone.name;
  //check workspaces with same name and determine a unique name for the cloned workspace
  return new Promise((resolve, reject) => {
    User.findByPk(user.id, {
      include: [{
        model: Workspace,
        through: {
          where: {
            [db.Sequelize.Op.or]: [{
              '$Workspaces.name$': workspaceToClone.name
            }, {
              '$Workspaces.name$': {
                [db.Sequelize.Op.like]: workspaceToClone.name + '_Copy%'
              }
            }]
          },
        }
      }]
    }).then((cloningUser) => {
      console.log(cloningUser.Workspaces.length);
      if (cloningUser.Workspaces.length > 0) {
        if (clonedWorkspaceName.indexOf('_Copy') > -1) {
          clonedWorkspaceName.replace(/_Copy_[0-9]+/, '_Copy_' + cloningUser.Workspaces.length);
        } else {
          clonedWorkspaceName += '_Copy_' + cloningUser.Workspaces.length;
        }
      }
      return resolve(clonedWorkspaceName);
    });
  })
};

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
       //console.log(workspaceToClone.Users[0].username);
      // console.log(workspaceToClone.Scripts.length + ' Scripts');
      // console.log(workspaceToClone.Datasets.length + ' Datasets');
      let clonedWorkspaceName = await getUniqueWorkspaceName(workspaceToClone, user);

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
      return reject({ success: false, message: err.message });
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
  }catch(err) {
    req.flash('error', 'There was an error importing the workspace. ');
  }

  return req.session.save(() => { res.redirect('/'); });
});

let getClusterInfo = async (workspaceId) => {
  return new Promise((resolve, reject) => {
    Workspace.findOne({
      where: { id: workspaceId },
      through: {
        where: { role: WorkspaceUser.roles.OWNER }
      }
    }).then(workspace => {
      let url = workspace.cluster;
      if (!url) {
        reject({ message: 'The cluster targets for scripts in this workspace could not ' +
          'be retrieved. The url provided for this cluster may be incorrect.' });
      }
      if (url.indexOf('http') < 0) {
        url = 'http://' + url
      }
        let _headers = {};
        if (workspace.clusterUser && workspace.clusterPwd) {
          let creds = workspace.clusterUser + ':' + crypt.decrypt(workspace.clusterPwd);
          _headers.Authorization = 'Basic ' + Buffer.from(creds).toString('base64');
        }
        request(url + '/WsTopology/TpListTargetClusters.json', {
          headers: _headers,
          json: true
        })
        .then(json => json.TpListTargetClustersResponse.TargetClusters.TpClusterNameType)
        .then(clusters => {
          let _clusters = clusters
            .map((cluster) => cluster.Name)
            .sort();

          resolve(_clusters);
        })
        .catch(error => {
          reject({ message: 'The cluster targets for scripts in this workspace could not ' +
            'be retrieved. The credentials provided for this cluster may be incorrect.' });
        });
    });
  });
};

/* Fetch cluster info (name of thors, etc) */
router.get('/clusters/:id', async (req, res, next) => {
  try {
    let clusters = await getClusterInfo(req.params.id);
    return res.json({ success: true, clusters: clusters });
  } catch(err) {
    console.log(err);
    return res.json({ success: false, message: err.message });
  }
});

let getDropzoneInfo = async (workspaceId) => {
  return new Promise((resolve) => {
    Workspace.findOne({
      where: { id: workspaceId },
      through: {
        where: { role: WorkspaceUser.roles.OWNER }
      }
    }).then(workspace => {
      let url = workspace.cluster;
      if (url.indexOf('http') < 0) {
        url = 'http://' + url
      }
        let _headers = {};
        if (workspace.clusterUser && workspace.clusterPwd) {
          let creds = workspace.clusterUser + ':' + crypt.decrypt(workspace.clusterPwd);
          _headers.Authorization = 'Basic ' + Buffer.from(creds).toString('base64');
        }
        request(url + '/WsTopology/TpDropZoneQuery.json', {
          headers: _headers,
          json: true
        })
        .then(json => json.TpDropZoneQueryResponse.TpDropZones.TpDropZone)
        .then(dropzones => {
          let _dropzones = {};
          dropzones.map(dropzone => {
            _dropzones[dropzone.Name] = [];
            _.flatMap(dropzone.TpMachines.TpMachine, (tpMachine) => {
              _dropzones[dropzone.Name] = _dropzones[dropzone.Name].concat([tpMachine.Netaddress]);
            })
          });

          resolve(_dropzones);
        })
    });
  });
}

router.get('/dropzones/:id', async (req, res, next) => {
  let dropzones = await getDropzoneInfo(req.params.id);
  return res.json({ dropzones: dropzones });
});

module.exports = router;