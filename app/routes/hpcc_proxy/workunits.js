const express = require('express');
const router = express.Router();

const cp = require('child_process');

const fs = require('fs-extra');

const { query, body, validationResult } = require('express-validator/check');

const dns = require('dns');

const ipv4 = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}';
const ipRegex = new RegExp(`(?:^${ipv4}$)`);

let request = require('request-promise');

let crypt = require('../../utils/crypt');

const db = require('../../models/index');
const Workspace = db.Workspace;
const WorkspaceUser = db.WorkspaceUser;

let buildClusterAddr = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  let workspaceId = req.body.workspaceId || req.query.workspaceId;
  Workspace.findOne({
    where: { id: workspaceId },
    through: {
      where: { role: WorkspaceUser.roles.OWNER }
    }
  }).then(workspace => {
    let cluster = workspace.cluster;
    if (cluster.indexOf(':') == 4) {
      let addr = cluster.substr(7).split(':');
      req.clusterAddr = addr[0];
      req.clusterPort = addr[1];
    } else if (cluster.lastIndexOf(':') > -1) {
      let addr = cluster.split(':');
      req.clusterAddr = addr[0];
      req.clusterPort = addr[1];
    }
    req.clusterAddrAndPort = cluster;
    if (req.clusterAddrAndPort.substring(0, 4) != 'http') {
      req.clusterAddrAndPort = 'http://' + req.clusterAddrAndPort;
    }
    let creds = '';
    if (workspace.clusterUser && workspace.clusterPwd) {
      creds = workspace.clusterUser + ':' + crypt.decrypt(workspace.clusterPwd);
    } else {
      creds = req.session.user.username + ':' + 'pass';
    }
    let auth = Buffer.from(creds).toString('base64');
    req.headers.Authorization = 'Basic ' + auth;
    if (ipRegex.test(req.clusterAddr)) {
      req.clusterIp = req.clusterAddr;
      next();
    } else {
      dns.lookup(req.clusterAddr, {}, (err, address, family) => {
        req.clusterIp = address;
        next();
      });
    }
  });
}

let createEclArchive = (args, cwd) => {
  console.log('in createEclArchive');
  //console.log('createEclArchive', cwd, args);
  return new Promise((resolve, _reject) => {
    //console.log('eclcc ' + args.join(' '));
    const child = cp.spawn('eclcc', args, { cwd: cwd });
    let stdOut = "", stdErr = "";
    child.stdout.on("data", (data) => {
      stdOut += data.toString();
    });
    child.stderr.on("data", (data) => {
      stdErr += data.toString();
    });
    child.on("close", (_code, _signal) => {
      resolve({
        stdout: stdOut.trim(),
        stderr: stdErr.trim()
      });
    });
  });
}

router.get('/', [
  query('workspaceId').isUUID(4).withMessage('Invalid workspace id'),
  buildClusterAddr,
], (req, res, next) => {
  let clusterAddr = req.clusterAddrAndPort;
  let _headers = {};
  if (req.headers.Authorization) {
    _headers.Authorization = req.headers.Authorization;
  }
  console.log('workunit status', req.query);
  request({
    method: 'POST',
    uri: clusterAddr + '/WsWorkunits/WUInfo.json',
    form: { rawxml_: true, Wuid: req.query.wuid },
    resolveWithFullResponse: true,
    headers: _headers
  }).then((response) => {
    let json = JSON.parse(response.body);
    console.log(json.WUInfoResponse.Workunit);
    let wuInfo = {
      state: json.WUInfoResponse.Workunit.State,
      wuid: json.WUInfoResponse.Workunit.Wuid,
      results: [],
      errors: []
    };

    if (json.WUInfoResponse.Workunit.Archived) {
      request({
        method: 'POST',
        uri: clusterAddr + '/WsWorkunits/WUAction.json',
        form: { rawxml_: true, Wuids_i0: req.query.wuid, WUActionType: 'Restore' },
        resolveWithFullResponse: true,
        headers: _headers
      }).then((response) => {
        let _json = JSON.parse(response.body);
        console.log(_json);
      }).then(() => {
        request({
          method: 'POST',
          uri: clusterAddr + '/WsWorkunits/WUInfo.json',
          form: { rawxml_: true, Wuid: req.query.wuid },
          resolveWithFullResponse: true,
          headers: _headers
        }).then((response) => {
          console.log('restored workunit info');
          json = JSON.parse(response.body);
          console.log(json.WUInfoResponse.Workunit);
        });
      });
    }

    if (json.WUInfoResponse.Workunit.Results) {
      json.WUInfoResponse.Workunit.Results.ECLResult.forEach((result) => {
        console.log(result);
        let _result = {
          name: result.Name,
          logicalFile: result.FileName,
          rows: result.Total,
          columns: result.ECLSchemas.ECLSchemaItem.length,
          schema: result.ECLSchemas.ECLSchemaItem
        };
        wuInfo.results.push(_result);
      });

      wuInfo.query = json.WUInfoResponse.Workunit.Query.Text;
    } else if (json.WUInfoResponse.Workunit.Exceptions) {
      wuInfo.errors = json.WUInfoResponse.Workunit.Exceptions.ECLException;
    }

    res.json(wuInfo);
  }).catch((err) => {
    console.log(err);
    res.json(err);
  });
});

router.post('/', [
  body('workspaceId').isUUID(4).withMessage('Invalid workspace id'),
  buildClusterAddr,
], (req, res, next) => {
  router.createWorkunit(req.clusterAddrAndPort, req.headers.Authorization)
    .then((response) => {
      let json = JSON.parse(response.body);
      res.json({ wuid: json.WUCreateResponse.Workunit.Wuid });
    }).catch((err) => {
      console.log(err);
      res.json(err);
    });
});

router.createWorkunit = (clusterAddr, authHeader) => {
  let _headers = {};
  if (authHeader !== '') {
    _headers.Authorization = authHeader;
  }
  return request({
    method: 'POST',
    uri: clusterAddr + '/WsWorkunits/WUCreate.json',
    headers: _headers,
    form: { rawxml_: true },
    resolveWithFullResponse: true
  });
};

router.put('/', [
  body('workspaceId')
    .isUUID(4).withMessage('Invalid workspace id'),
  body('datasetId')
    .optional({ checkFalsy: true })
    .isUUID(4).withMessage('Invalid dataset id'),
  body('filename')
    .optional({ checkFalsy: true })
    .matches(/^[a-zA-Z]{1}[a-zA-Z0-9_]*\.ecl$/).withMessage('Invalid script filename'),
  body('scriptPath')
    .optional({ checkFalsy: true })
    .matches(/^[a-zA-Z0-9\/]+$/).withMessage('Invalid path for script'),
  buildClusterAddr,
], (req, res, next) => {

  let _query = req.body.query,
      _filename = req.body.filename,
      _scriptPath = req.body.scriptPath || null,
      _datasetId = req.body.datasetId || null,
      _workspaceId = req.body.workspaceId,
      workspacePath = process.cwd() + '/workspaces/' + _workspaceId,
      scriptPath = process.cwd() + '/workspaces/' + _workspaceId;

  if (_datasetId) {
    scriptPath += '/datasets/' + _datasetId + '/';
  } else {
    scriptPath += '/scripts/' + (_scriptPath ? _scriptPath : '');
  }

  if (!fs.existsSync(scriptPath)) {
    fs.mkdirpSync(scriptPath);
  }

  let args = ['-E', scriptPath + '/' + _filename];

  if (_filename) {
    try {
      let _files = fs.readdirSync(workspacePath + '/scripts/', { withFileTypes: true });
      if (_datasetId) {
        _files = fs.readdirSync(workspacePath + '/datasets/', { withFileTypes: true });
      }
      _files.forEach((file) => {
        console.log(file);
        if (file.isDirectory() && file.name.indexOf('.') == -1) {
          args.push('-I');
          if (_datasetId) {
            args.push(workspacePath + '/datasets/' + file.name + '/');
          } else {
            args.push(workspacePath + '/scripts/' + file.name + '/');
          }
        }
      });
    } catch (err) {
      console.log(err);
      return;
    }

    createEclArchive(args, scriptPath).then((response) => {
      _query = response.stdout;
      console.log('in createEclArchive .then()');
      //console.log(response);
      //console.log('ecl archive: ' + _query);

      router.updateWorkunit(
        req.clusterAddrAndPort, req.body.wuid, _query, _filename,
        (req.headers.Authorization || '')
      ).then((response) => {
        console.log('response to WUUpdate', response.body);
        let json = JSON.parse(response.body);
        res.json(json);
      }).catch((err) => {
        console.log(err);
        res.json(err);
      });
    }).catch((err) => {
      console.log(err);
      res.json(err);
    });
  } else {
    _query = _query.replace(/\#USERNAME\#/g, req.session.user.username)
    console.log('replaced #USERNAME#', _query);

    router.updateWorkunit(
      req.clusterAddrAndPort, req.body.wuid, _query,
      _filename, (req.headers.Authorization || '')
    ).then((response) => {
      console.log('response to WUUpdate', response.body);
      let json = JSON.parse(response.body);
      res.json(json);
    }).catch((err) => {
      console.log(err);
      res.json(err);
    });

  }
});

router.updateWorkunit = (clusterAddr, wuid, query, filename="", authHeader="") => {
  let _headers = {};
  if (authHeader !== '') {
    _headers.Authorization = authHeader;
  }
  return request({
    method: 'POST',
    uri: clusterAddr + '/WsWorkunits/WUUpdate.json',
    form: { Wuid: wuid, QueryText: query, Jobname: filename },
    resolveWithFullResponse: true,
    headers: _headers
  });
};

router.post('/submit', [
  body('workspaceId').isUUID(4).withMessage('Invalid workspace id'),
  buildClusterAddr,
], (req, res, next) => {
  router.submitWorkunit(
    req.clusterAddrAndPort,
    req.body.wuid,
    (req.headers.Authorization || ''),
    req.body.cluster
  ).then((response) => {
    console.log('response to WUSubmit', response.body);
    let json = JSON.parse(response.body);
    res.json(json);
  }).catch((err) => {
    console.log(err);
    res.json(err);
  });
});

router.submitWorkunit = (clusterAddr, wuid, authHeader="", cluster) => {
  let _headers = {};
  if (authHeader !== '') {
    _headers.Authorization = authHeader;
  }
  return request({
    method: 'POST',
    uri: clusterAddr + '/WsWorkunits/WUSubmit.json',
    form: { Wuid: wuid, Cluster: cluster },
    resolveWithFullResponse: true,
    headers: _headers
  });
};

router.post('/results', [
  body('workspaceId').isUUID(4).withMessage('Invalid workspace id'),
  body('count').isNumeric().withMessage('Count must be numeric'),
  buildClusterAddr,
], (req, res, next) => {
  let _headers = {};
  if (req.headers.Authorization) {
    _headers.Authorization = req.headers.Authorization;
  }
  console.log('requesting /WsWorkunits/WUResult.json');
  let formData = {
    Count: req.body.count,
    Sequence: req.body.sequence
  };
  if (req.body.wuid) {
    formData.Wuid = req.body.wuid;
  }
  if (req.body.logicalfile) {
    formData.LogicalName = req.body.logicalfile;
  }
  request({
    method: 'POST',
    uri: req.clusterAddrAndPort + '/WsWorkunits/WUResult.json',
    form: formData,
    resolveWithFullResponse: true,
    headers: _headers
  }).then((response) => {
    console.log('response to WUResult');
    let json = JSON.parse(response.body);
    res.json(json);
  }).catch((err) => {
    console.log(err);
    res.json(err);
  });
});

module.exports = router;