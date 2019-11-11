const express = require('express');
const router = express.Router();

const db = require('../models/index');

const fs = require('fs-extra');

const crypt = require('../utils/crypt');

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

/* Create workspace */
router.post('/', (req, res, next) => {
  console.log('request body', req.body);
  Workspace.create({
    name: req.body.workspaceName,
    cluster: req.body.workspaceCluster,
    clusterUser: req.body.clusterUsername,
    clusterPwd: crypt.encrypt(req.body.clusterPassword)
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
router.put('/', (req, res, next) => {
  console.log('request body', req.body);
  let workspace = {};
  if (req.body.workspaceName) workspace.name = req.body.workspaceName;
  if (req.body.directoryTree) workspace.directoryTree = JSON.stringify(req.body.directoryTree);
  if (req.body.workspaceCluster) workspace.cluster = req.body.workspaceCluster;
  if (req.body.clusterUsername) workspace.clusterUser = req.body.clusterUsername;
  if (req.body.clusterPassword) workspace.clusterPwd = crypt.encrypt(req.body.clusterPassword);
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

/* Delete workspace */
router.delete('/', (req, res, next) => {
  Workspace.findOne({
    where: { id: req.body.workspaceId },
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
                [db.Sequelize.Op.like]: workspaceToClone.name + ' (Copy%'
              }
            }]
          },
        }
      }]
    }).then((cloningUser) => {
      console.log(cloningUser.Workspaces.length);
      if (cloningUser.Workspaces.length > 0) {
        clonedWorkspaceName += ' (Copy-' + cloningUser.Workspaces.length + ')';
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
      // console.log(workspaceToClone.Users[0].username);
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
                    eclQuery: datasetToClone.eclQuery.replace(new RegExp(oldWorkspaceScope, 'g'), newWorkspaceScope),
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
             return resolve({ success: true, message: 'Workspace shared' });
          });
        });
      });
    });
  }); //end new Promise(...)
};

router.get('/share/:id', async (req, res, next) => {
  let workspaceId = req.params.id,
      user = { id: req.session.user.id, name: req.session.user.username };
  console.log(workspaceId, user);
  let result = await shareWorkspace(workspaceId, user);
  console.log(result);
  return res.redirect('/');
});

module.exports = router;