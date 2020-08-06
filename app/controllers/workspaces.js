const db = require('../models/index');

const User = db.User;
const Workspace = db.Workspace;
const WorkspaceUser = db.WorkspaceUser;

const Dataset = db.Dataset;
const Script = db.Script;
const ScriptRevision = db.ScriptRevision;
const Workunit = db.Workunit;

const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');

const crypt = require('../utils/crypt');
const unzip = require('../utils/unzip');

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

exports.updateWorkspace = (req, res, next) => {
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
};

exports.deleteWorkspace = (req, res, next) => {
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
};

exports.getUniqueWorkspaceName = async (workspaceToClone, user) => {
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
        if (!clonedWorkspaceName) {
          clonedWorkspaceName = 'workspace';
        }
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

exports.getClusterInfo = async (workspaceId) => {
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

exports.exportWorkspaceAsZip = (req, res, next) => {
  console.log('generate zip');

  Workspace.findOne({
    where: { id: req.params.workspaceId },
    through: {
      where: { role: WorkspaceUser.roles.OWNER }
    }
  }).then(workspace => {
    // console.log(workspace);
    let scriptDirPath = process.cwd() + '/workspaces/' + workspace.id + '/scripts/',
        zipPath = process.cwd() + '/landing_zone/' + workspace.id + '.zip',
        zipAttachName = workspace.name + '.zip',
        zip = fs.createWriteStream(zipPath),
        archive = archiver('zip', { zlib: { level: 9 } });

    zip.on('close', () => {
      // console.log('file complete');
      let secondsUntilDelete = 15;

      // delete the generated archive after secondsUntilDelete
      let delFile = setTimeout(() => {
        fs.remove(zipPath);
        clearTimeout(delFile);
      }, secondsUntilDelete * 1000);

      return res.download(zipPath, zipAttachName);
    });

    archive.on('warning', function(err) {
      if (err.code === 'ENOENT') {
        console.log(err)
      } else {
        throw err;
      }
    });

    archive.on('error', function(err) {
      console.log(err);
      throw err;
    });

    // console.log('pipe archive to zip');
    archive.pipe(zip);

    // console.log('add ' + scriptDirPath + ' to zip');
    archive.glob('**/*', {
      cwd: scriptDirPath,
      ignore: ['.eclcc', '**/eclcc.log']
    });
    archive.finalize();

  }).catch(err => {
    return res.json({ success: false, message: 'A workspace could not be found' })
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

exports.createSamplesWorkspace = async (userId) => {
  // console.log(req.file);
  let srcFilePath = path.join(process.cwd(), 'ecl-samples.zip'),
      baseName = path.basename(srcFilePath, path.extname(srcFilePath)),
      destFilePath = path.join(process.cwd(), 'landing_zone', baseName);

  let json = await unzip(srcFilePath, { dir: destFilePath });

  Workspace.create({
    name: 'ECL_Samples',
    cluster: 'http://play.hpccsystems.com:8010',
    clusterUser: null,
    clusterPwd: null,
    directoryTree: JSON.stringify({ datasets: {}, scripts: json.tree })
  }).then(async workspace => {
    Object.values(json.flat).filter(f => {
      if (f.type == 'file') return f;
    }).forEach(async script => {
      script.workspaceId = workspace.id;
      script.eclFilePath = script.parentPathNames;
      let newScript = await Script.create(script);
      await ScriptRevision.create({
        scriptId: newScript.id,
        content: fs.readFileSync(destFilePath + '/' + script.fileName)
      });
    });

    let workspaceDirPath = process.cwd() + '/workspaces/' + workspace.id + '/scripts';
    await fs.copy(destFilePath, workspaceDirPath);

    WorkspaceUser.create({
      role: WorkspaceUser.roles.OWNER,
      workspaceId: workspace.id,
      userId: userId
    }).then(() => {
      fs.remove(destFilePath);
    })
  });
};