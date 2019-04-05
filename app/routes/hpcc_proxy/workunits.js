const express = require('express');
const router = express.Router();

let request = require('request-promise');

let buildClusterAddr = (req, res, next) => {
  if (req.body.clusterAddr && req.body.clusterPort) {
    req.clusterAddr = req.body.clusterAddr + ':' + req.body.clusterPort;
    next();
  }
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
  request({
    method: 'POST',
    uri: req.clusterAddr + '/WsWorkunits/WUCreate.json',
    form: { rawxml_: true },
    resolveWithFullResponse: true
  }).then((response) => {
    let json = JSON.parse(response.body);
    res.json({ wuid: json.WUCreateResponse.Workunit.Wuid });
  }).catch((err) => {
    console.log(err);
    res.json(err);
  });
});

router.put('/', buildClusterAddr, (req, res, next) => {
  let _query = req.body.query.replace(/\#USERNAME\#/g, req.session.user.username);

  console.log('replaced #USERNAME#', _query)

  request({
    method: 'POST',
    uri: req.clusterAddr + '/WsWorkunits/WUUpdate.json',
    form: { Wuid: req.body.wuid, QueryText: _query },
    resolveWithFullResponse: true
  }).then((response) => {
    console.log('response to WUUpdate', response.body);
    let json = JSON.parse(response.body);
    res.json(json);
  }).catch((err) => {
    console.log(err);
    res.json(err);
  });
});

router.post('/submit', buildClusterAddr, (req, res, next) => {
  request({
    method: 'POST',
    uri: req.clusterAddr + '/WsWorkunits/WUSubmit.json',
    form: { Wuid: req.body.wuid, Cluster: req.body.cluster },
    resolveWithFullResponse: true
  }).then((response) => {
    console.log('response to WUSubmit', response.body);
    let json = JSON.parse(response.body);
    res.json(json);
  }).catch((err) => {
    console.log(err);
    res.json(err);
  });
});

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