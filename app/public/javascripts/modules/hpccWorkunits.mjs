'use strict';

import { cluster, csrfToken, } from './consts.mjs';

let createWorkunit = () => {
  let _headers = {
    'Content-Type': 'application/json',
    'CSRF-Token': csrfToken
  };
  let workspaceId = $('.workspaces .active').data('id');
  return fetch('/hpcc/workunits', {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: workspaceId
    }),
    headers: _headers
  });
};

let updateWorkunit = (wuid, query, scriptName, scriptPath = null, datasetId = null, workspaceId) => {
  let _headers = {
    'Content-Type': 'application/json',
    'CSRF-Token': csrfToken
  };
  return fetch('/hpcc/workunits', {
    method: 'PUT',
    body: JSON.stringify({
      wuid: wuid,
      query: query,
      filename: scriptName,
      scriptPath: scriptPath,
      datasetId: datasetId,
      workspaceId: workspaceId
    }),
    headers: _headers
  });
};

let submitWorkunit = (wuid, selectedCluster) => {
  let _headers = {
    'Content-Type': 'application/json',
    'CSRF-Token': csrfToken
  };
  let workspaceId = $('.workspaces .active').data('id');
  return fetch('/hpcc/workunits/submit', {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: workspaceId,
      clusterAddr: cluster.host,
      clusterPort: cluster.port,
      wuid: wuid,
      cluster: selectedCluster
    }),
    headers: _headers
  });
};

let sendFileToLandingZone = (file) => {
  let _headers = {
    'CSRF-Token': csrfToken
  };
  console.log(file);
  let workspaceId = $('.workspaces .active').data('id');
  let formData = new FormData();
  formData.append('file', file);
  formData.append('workspaceId', workspaceId);

  return fetch('/hpcc/filespray/upload', {
    method: 'POST',
    body: formData,
    headers: _headers
  });
};

let sprayFile = (clusterFilename, workspaceName, workspaceId) => {
  console.log(clusterFilename);
  let _headers = {
    'CSRF-Token': csrfToken
  };
  let formData = new FormData();
  formData.append('filename', clusterFilename);
  formData.append('workspaceName', workspaceName);
  formData.append('workspaceId', workspaceId);

  return fetch('/hpcc/filespray/spray', {
    method: 'POST',
    body: formData,
    headers: _headers
  });
};

let getDfuWorkunit = (wuid) => {
  let _headers = {
    'CSRF-Token': csrfToken
  };
  let workspaceId = $('.workspaces .active').data('id');
  let formData = new FormData();
  formData.append('wuid', wuid);
  formData.append('workspaceId', workspaceId);

  return fetch('/hpcc/filespray/getDfuWorkunit', {
    method: 'POST',
    body: formData,
    headers: _headers
  });
};

let saveWorkunit = (objectId, workunitId) => {
  let _headers = {
    'Content-Type': 'application/json',
    'CSRF-Token': csrfToken
  };
  return fetch('/workunits/', {
    method: 'POST',
    body: JSON.stringify({
      objectId: objectId,
      workunitId: workunitId
    }),
    headers: _headers
  });
};

let checkWorkunitStatus = (wuid) => {
  let _headers = {
    'Content-Type': 'application/json'
  };
  let workspaceId = $('.workspaces .active').data('id');

  return fetch('/hpcc/workunits?wuid=' + wuid + '&workspaceId=' + workspaceId, {
    method: 'GET',
    headers: _headers
  });
};

let getWorkunitResults = (wuid, count, sequence) => {
  console.log('request /hpcc/workunits/results', wuid, count);

  let _headers = {
    'Content-Type': 'application/json',
    'CSRF-Token': csrfToken
  };
  let workspaceId = $('.workspaces .active').data('id');

  return fetch('/hpcc/workunits/results', {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: workspaceId,
      wuid: wuid,
      count: ((count) ? count : 1000),
      sequence: ((sequence) ? sequence : 0)
    }),
    headers: _headers
  });
};

export {
  createWorkunit, updateWorkunit, submitWorkunit, sendFileToLandingZone,
  sprayFile, getDfuWorkunit, saveWorkunit, checkWorkunitStatus,
  getWorkunitResults,
};