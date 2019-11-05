'use strict';

import { cluster, csrfToken, } from './consts.mjs';

let createWorkunit = () => {
  return fetch('/hpcc/workunits', {
    method: 'POST',
    body: JSON.stringify({
      clusterAddr: cluster.host,
      clusterPort: cluster.port
    }),
    headers: {
      'Content-Type': 'application/json',
      'CSRF-Token': csrfToken
    }
  });
};

let updateWorkunit = (wuid, query, scriptName, scriptPath = null, datasetId = null, workspaceId) => {
  return fetch('/hpcc/workunits', {
    method: 'PUT',
    body: JSON.stringify({
      clusterAddr: cluster.host,
      clusterPort: cluster.port,
      wuid: wuid,
      query: query,
      filename: scriptName,
      scriptPath: scriptPath,
      datasetId: datasetId,
      workspace: workspaceId
    }),
    headers: {
      'Content-Type': 'application/json',
      'CSRF-Token': csrfToken
    }
  });
};

let submitWorkunit = (wuid) => {
  return fetch('/hpcc/workunits/submit', {
    method: 'POST',
    body: JSON.stringify({
      clusterAddr: cluster.host,
      clusterPort: cluster.port,
      wuid: wuid,
      cluster: 'thor'
    }),
    headers: {
      'Content-Type': 'application/json',
      'CSRF-Token': csrfToken
    }
  });
};

let sendFileToLandingZone = (file) => {
  console.log(file);
  let formData = new FormData();
  formData.append('file', file);
  formData.append('clusterAddr', cluster.host);
  formData.append('clusterPort', cluster.port);

  return fetch('/hpcc/filespray/upload', {
    method: 'POST',
    body: formData,
    headers: {
      'CSRF-Token': csrfToken
    }
  });
};

let sprayFile = (clusterFilename, workspaceId) => {
  console.log(clusterFilename);
  let formData = new FormData();
  formData.append('filename', clusterFilename);
  formData.append('clusterAddr', cluster.host);
  formData.append('clusterPort', cluster.port);
  formData.append('workspaceId', workspaceId);

  return fetch('/hpcc/filespray/spray', {
    method: 'POST',
    body: formData,
    headers: {
      'CSRF-Token': csrfToken
    }
  });
};

let getDfuWorkunit = (wuid) => {
  let formData = new FormData();
  formData.append('wuid', wuid);
  formData.append('clusterAddr', cluster.host);
  formData.append('clusterPort', cluster.port);

  return fetch('/hpcc/filespray/getDfuWorkunit', {
    method: 'POST',
    body: formData,
    headers: {
      'CSRF-Token': csrfToken
    }
  });
};

let saveWorkunit = (objectId, workunitId) => {
  return fetch('/workunits/', {
    method: 'POST',
    body: JSON.stringify({
      objectId: objectId,
      workunitId: workunitId
    }),
    headers: {
      'Content-Type': 'application/json',
      'CSRF-Token': csrfToken
    }
  });
};

let checkWorkunitStatus = (wuid) => {
  return fetch('/hpcc/workunits?wuid=' + wuid +
    '&clusterAddr=' + encodeURIComponent(cluster.host) +
    encodeURIComponent(':') + cluster.port);
};

let getWorkunitResults = (wuid, count, sequence) => {
  console.log('request /hpcc/workunits/results', wuid, count);

  return fetch('/hpcc/workunits/results', {
    method: 'POST',
    body: JSON.stringify({
      clusterAddr: cluster.host,
      clusterPort: cluster.port,
      wuid: wuid,
      count: ((count) ? count : 1000),
      sequence: ((sequence) ? sequence : 0)
    }),
    headers: {
      'Content-Type': 'application/json',
      'CSRF-Token': csrfToken
    }
  });
};

export {
  createWorkunit, updateWorkunit, submitWorkunit, sendFileToLandingZone,
  sprayFile, getDfuWorkunit, saveWorkunit, checkWorkunitStatus,
  getWorkunitResults,
};