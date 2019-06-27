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

const hpccFilesprayRouter = require('./hpcc_proxy/filespray');
const hpccWorkunitsRouter = require('./hpcc_proxy/workunits');

let request = require('request-promise');

/* Create workspace */
router.post('/', (req, res, next) => {
  console.log('request body', req.body);
  Workspace.create({
    name: req.body.workspaceName,
    cluster: req.body.workspaceCluster
  }).then((workspace) => {
    let workspaceDirPath = process.cwd() + '/workspaces/' + workspace.id;
    if (!fs.existsSync(workspaceDirPath)) {
      fs.mkdirSync(workspaceDirPath);
      fs.mkdirSync(workspaceDirPath + '/scripts');
      fs.mkdirSync(workspaceDirPath + '/datasets');
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
  Workspace.update(workspace, {
    where: {
      id: req.body.id
    }
  }).then((result) => {
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

let shareWorkspace = async (workspaceId, users) => {
  let _directoryTree = null,
      newWorkspaceId = null;

  Workspace.findOne({
    where: { id: workspaceId },
    include: {
      model: User,
      through: {
        where: { role: WorkspaceUser.roles.OWNER }
      }
    }
  }).then((workspaceToClone) => {
    console.log(workspaceToClone.Users[0].username);
    _directoryTree = workspaceToClone.directoryTree;

    users.forEach((user) => {
      Workspace.create({
        name: workspaceToClone.name,
        cluster: workspaceToClone.cluster,
        directoryTree: workspaceToClone.directoryTree
      }).then((newWorkspace) => {

        newWorkspaceId = newWorkspace.id;

        let oldWorkspaceScope = workspaceToClone.Users[0].username + '::' + workspaceToClone.name,
            newWorkspaceScope = user.name + '::' + newWorkspace.name;

        WorkspaceUser.create({
          userId: user.id,
          workspaceId: newWorkspace.id,
          role: WorkspaceUser.roles.OWNER
        });
        console.log(workspaceToClone.name);
        Script.findAll({
          where: {
            [db.Sequelize.Op.and]: {
              workspaceId: workspaceToClone.id,
              deletedAt: null
            }
          }
        }).then((scripts) => {
          scripts.forEach((scriptToClone) => {
            console.log('scriptToClone', scriptToClone);
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
                workspaceId: newWorkspace.id
              }).then((newScript) => {
                ScriptRevision.create({
                  content: _content,
                  scriptId: newScript.id
                });
                let _regex = new RegExp(scriptToClone.id, 'g');
                _directoryTree = _directoryTree.replace(_regex, newScript.id);
                console.log(_regex.toString(), newScript.id, _directoryTree);
              });
            });
          });
        });

        Dataset.findAll({
          where: {
            [db.Sequelize.Op.and]: {
              workspaceId: workspaceToClone.id,
              deletedAt: null
            }
          }
        }).then((datasets) => {
          datasets.forEach((datasetToClone) => {
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
                          hpccWorkunitsRouter.updateWorkunit(clusterAddr, wuid, newDataset.eclQuery)
                            .then((response) => {
                              hpccWorkunitsRouter.submitWorkunit(clusterAddr, wuid);
                              let _workspace = {
                                directoryTree: _directoryTree
                              };
                              Workspace.update(_workspace, {
                                where: {
                                  id: newWorkspaceId
                                }
                              });
                              return { success: true, message: 'Workspace shared' };
                            });
                        }).catch((err) => {
                          console.log(err);
                          return err;
                        });
                    })
                  });
                }).catch((err) => {
                  console.log(err);
                  return err;
                });
            });
          });
        });
      });
    });
  });
};

router.post('/share', (req, res, next) => {
  console.log(req.body);
  let result = shareWorkspace(req.body.workspaceId, req.body.users);
  console.log(result);
  return res.redirect('/');
});

router.get('/share/:id', (req, res, next) => {
  let workspaceId = req.params.id,
      users = [{ id: req.session.user.id, name: req.session.user.username }];
  console.log(workspaceId, users);
  let result = shareWorkspace(workspaceId, users);
  console.log(result);
  return res.redirect('/');
});

module.exports = router;
