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
    let result = {
      state: json.WUInfoResponse.Workunit.State,
      wuid: json.WUInfoResponse.Workunit.Wuid
    };

    if (json.WUInfoResponse.Workunit.Results) {
      let _wuResult = json.WUInfoResponse.Workunit.Results.ECLResult[0],
          _schema = _wuResult.ECLSchemas.ECLSchemaItem;

      result.logicalFile = _wuResult.FileName;
      result.rows = _wuResult.Total;
      result.columns = _schema.length;
      result.schema = _schema;
    }

    res.json(result);
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

module.exports = router;