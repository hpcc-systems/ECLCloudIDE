'use strict';

let hostname = window.location.protocol + '//' + window.location.hostname +
  (window.location.port ? (':' + window.location.port) : '');

const NO_WORKSPACE = 'Select Workspace...';
const NEW_SCRIPT = 'New Script...';
const NEW_DATASET = 'New Dataset...';

const FILE_LIMIT = 16 * 1024 * 1024;

const DEFAULT_FILE_FEEDBACK = 'Please select a CSV file to upload.';

let currentDatasetFile = {};
let setCurrentDatasetFile = (file) => {
  currentDatasetFile = file;
};

let cluster = {
  host: 'http://10.173.147.1',
  port: '8010',
  user: '',
  pass: ''
};
let setClusterHost = (host) => {
  cluster.host = host;
};
let setClusterPort = (port) => {
  cluster.port = port;
};
let setClusterUser = (user) => {
  cluster.user = user;
};
let setClusterPass = (pass) => {
  cluster.pass = pass;
};

let csrfToken = document.querySelector('[name="csrf-token"]').content;

export {
  hostname, NO_WORKSPACE, NEW_SCRIPT, NEW_DATASET, FILE_LIMIT,
  DEFAULT_FILE_FEEDBACK, currentDatasetFile, setCurrentDatasetFile,
  cluster, setClusterHost, setClusterPort, setClusterUser, setClusterPass,
  csrfToken,
};