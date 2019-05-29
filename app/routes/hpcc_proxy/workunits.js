const express = require('express');
const router = express.Router();

const cp = require('child_process');

let request = require('request-promise');

let buildClusterAddr = (req, res, next) => {
  if (req.body.clusterAddr && req.body.clusterPort) {
    req.clusterAddr = req.body.clusterAddr + ':' + req.body.clusterPort;
    next();
  }
}

let createEclArchive = (args, cwd) => {
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
      resolve({
        stdout: stdOut.trim(),
        stderr: stdErr.trim()
      });
    });
  });
}

router.get('/', (req, res, next) => {
  console.log('workunit status', req.query);
  request({
    method: 'POST',
    uri: req.query.clusterAddr + '/WsWorkunits/WUInfo.json',
    form: { rawxml_: true, Wuid: req.query.wuid },
    resolveWithFullResponse: true
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
        uri: req.query.clusterAddr + '/WsWorkunits/WUAction.json',
        form: { rawxml_: true, Wuids_i0: req.query.wuid, WUActionType: 'Restore' },
        resolveWithFullResponse: true
      }).then((response) => {
        let _json = JSON.parse(response.body);
        console.log(_json);
      }).then(() => {
        request({
          method: 'POST',
          uri: req.query.clusterAddr + '/WsWorkunits/WUInfo.json',
          form: { rawxml_: true, Wuid: req.query.wuid },
          resolveWithFullResponse: true
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

router.post('/', buildClusterAddr, (req, res, next) => {
  router.createWorkunit(req.clusterAddr)
    .then((response) => {
      let json = JSON.parse(response.body);
      res.json({ wuid: json.WUCreateResponse.Workunit.Wuid });
    }).catch((err) => {
      console.log(err);
      res.json(err);
    });
});

router.createWorkunit = (clusterAddr) => {
  return request({
    method: 'POST',
    uri: clusterAddr + '/WsWorkunits/WUCreate.json',
    form: { rawxml_: true },
    resolveWithFullResponse: true
  });
};

router.put('/', buildClusterAddr, (req, res, next) => {
  let _query = req.body.query,
      _filename = req.body.filename,
      _workspaceId = req.body.workspace,
      filePath = process.cwd() + '/workspaces/' + _workspaceId + '/scripts/',
      args = ['-E', filePath + _filename];

  if (_filename) {
    createEclArchive(args, filePath).then((response) => {
      _query = response.stdout;
      console.log(response);
      console.log('ecl archive: ' + _query);

      router.updateWorkunit(req.clusterAddr, req.body.wuid, _query)
        .then((response) => {
          console.log('response to WUUpdate', response.body);
          let json = JSON.parse(response.body);
          res.json(json);
        }).catch((err) => {
          console.log(err);
          res.json(err);
        });
    });
  } else {
    _query = _query.replace(/\#USERNAME\#/g, req.session.user.username)
    console.log('replaced #USERNAME#', _query);

    router.updateWorkunit(req.clusterAddr, req.body.wuid, _query)
      .then((response) => {
        console.log('response to WUUpdate', response.body);
        let json = JSON.parse(response.body);
        res.json(json);
      }).catch((err) => {
        console.log(err);
        res.json(err);
      });

  }
});

router.updateWorkunit = (clusterAddr, wuid, query) => {
  return request({
    method: 'POST',
    uri: clusterAddr + '/WsWorkunits/WUUpdate.json',
    form: { Wuid: wuid, QueryText: query },
    resolveWithFullResponse: true
  });
};

router.post('/submit', buildClusterAddr, (req, res, next) => {
  router.submitWorkunit(req.clusterAddr, req.body.wuid)
    .then((response) => {
      console.log('response to WUSubmit', response.body);
      let json = JSON.parse(response.body);
      res.json(json);
    }).catch((err) => {
      console.log(err);
      res.json(err);
    });
});

router.submitWorkunit = (clusterAddr, wuid) => {
  return request({
    method: 'POST',
    uri: clusterAddr + '/WsWorkunits/WUSubmit.json',
    form: { Wuid: wuid, Cluster: 'thor' },
    resolveWithFullResponse: true
  });
};

router.post('/results', buildClusterAddr, (req, res, next) => {
  console.log('requesting /WsWorkunits/WUResult.json');
  request({
    method: 'POST',
    uri: req.clusterAddr + '/WsWorkunits/WUResult.json',
    form: { Wuid: req.body.wuid, Count: req.body.count, Sequence: req.body.sequence },
    resolveWithFullResponse: true
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