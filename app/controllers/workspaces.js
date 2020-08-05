const db = require('../models/index');

const User = db.User;
const Workspace = db.Workspace;
const WorkspaceUser = db.WorkspaceUser;

const fs = require('fs-extra');

const crypt = require('../utils/crypt');

let request = require('request-promise');
let _ = require('lodash');

exports.getWorkspaceById = (req, res, next) => {
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
};

exports.createWorkspace = (req, res, next) => {
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
};

exports.getDropzoneInfo = (workspaceId) => {
  console.log('in getDropzoneInfo');
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
};