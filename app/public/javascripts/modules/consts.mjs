'use strict';

let hostname = window.location.protocol + '//' + window.location.hostname +
  (window.location.port ? (':' + window.location.port) : '');

const NO_WORKSPACE = 'Select Workspace...';
const NEW_SCRIPT = 'New Script...';
const NEW_DATASET = 'New Dataset...';

const FILE_LIMIT = 16 * 1024 * 1024;

const DEFAULT_FILE_FEEDBACK = 'Please select a CSV file to upload.';
const DEFAULT_FILE_ROW_PATH_FEEDBACK = 'Specify either the root of the JSON as "/", or ' +
  'some property below the root as "/some-property...", the first character should always be /';

const ECL_KEYWORDS = [
  'abs', 'acos', 'allnodes', 'ascii', 'asin', 'asstring', 'atan', 'atan2', 'ave', 'case',
  'choose', 'choosen', 'choosesets', 'clustersize', 'combine', 'correlation', 'cos', 'cosh',
  'count', 'covariance', 'cron', 'dataset', 'dedup', 'define', 'denormalize', 'distribute',
  'distributed', 'distribution', 'ebcdic', 'enth', 'error', 'evaluate', 'event', 'eventextra',
  'eventname', 'exists', 'exp', 'failcode', 'failmessage', 'fetch', 'fromunicode', 'getisvalid',
  'global', 'graph', 'group', 'hash', 'hash32', 'hash64', 'hashcrc', 'hashmd5', 'having',
  'if', 'index', 'intformat', 'isvalid', 'iterate', 'join', 'keyunicode', 'length', 'library',
  'limit', 'ln', 'local', 'log', 'loop', 'map', 'matched', 'matchlength', 'matchposition',
  'matchtext', 'matchunicode', 'max', 'merge', 'mergejoin', 'min', 'nolocal', 'nonempty',
  'normalize', 'parse', 'pipe', 'power', 'preload', 'process', 'project', 'pull', 'random',
  'range', 'rank', 'ranked', 'realformat', 'recordof', 'regexfind', 'regexreplace', 'regroup',
  'rejected', 'rollup', 'round', 'roundup', 'row', 'rowdiff', 'sample', 'set', 'sin', 'sinh',
  'sizeof', 'soapcall', 'sort', 'sorted', 'sqrt', 'stepped', 'stored', 'sum', 'table', 'tan',
  'tanh', 'thisnode', 'topn', 'tounicode', 'transfer', 'trim', 'truncate', 'typeof', 'ungroup',
  'unicodeorder', 'variance', 'which', 'workunit', 'xmldecode', 'xmlencode', 'xmltext', 'xmlunicode'
];

let currentDatasetFile = {};
let setCurrentDatasetFile = (file) => {
  currentDatasetFile = file;
};

let cluster = {
  host: '',
  port: '',
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
  DEFAULT_FILE_FEEDBACK,  DEFAULT_FILE_ROW_PATH_FEEDBACK,
  ECL_KEYWORDS, currentDatasetFile, setCurrentDatasetFile,
  cluster, setClusterHost, setClusterPort, setClusterUser, setClusterPass,
  csrfToken,
};