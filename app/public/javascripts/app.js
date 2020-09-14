'use strict';

import {
  hostname, NO_WORKSPACE, NEW_SCRIPT, NEW_DATASET, FILE_LIMIT,
  DEFAULT_FILE_FEEDBACK,  DEFAULT_FILE_ROW_PATH_FEEDBACK,
  ECL_KEYWORDS, currentDatasetFile, setCurrentDatasetFile,
  cluster, setClusterHost, setClusterPort, setClusterUser, setClusterPass,
  csrfToken,
} from './modules/consts.mjs';

import { tour } from './modules/featureTour.mjs';

import {
  renderTree, addScript, addDataset, addFolder, populateWorkspaces,
  populateWorkspaceDirectoryTree, populateDatasets, showDatasets,
  populateScripts, showScripts,
} from './modules/directoryTree.mjs';

import {
  createWorkunit, updateWorkunit, submitWorkunit, sendFileToLandingZone,
  sprayFile, getDfuWorkunit, dfuQuery, dfuInfo, saveWorkunit, checkWorkunitStatus,
  getWorkunitResults,
} from './modules/hpccWorkunits.mjs';

import { parseDatasetFile } from './modules/fileParser.mjs';

import Sortable from './sortablejs/sortable.esm.js';

let dataTable = null;

let toggleNewScriptPopover = () => {
  let $workspaceSelect = $('#workspaceSelect'),
      $newScript = $('#new-script'),
      $newDataset = $('#new-dataset'),

      _togglePopover = ($element, defaultTitle) => {
        if ($workspaceSelect.text() == NO_WORKSPACE) {
          $element.attr('data-toggle', 'popover');
          $element.attr('title', 'Select a Workspace');
          $element.attr('data-content', 'Create a new Workspace or select one of your existing Workspaces');
          $element.attr('data-placement', 'right');
          $element.attr('data-boundary', 'window');

          $element.popover({ trigger: 'focus' });
          $element.popover('enable');
        } else {
          $element.attr('data-toggle', 'modal');
          $element.attr('title', defaultTitle);
          $element.removeAttr('data-content');
          $element.removeAttr('data-placement');
          $element.removeAttr('data-boundary');

          $element.popover('disable');
        }
      };

    _togglePopover($newScript, NEW_SCRIPT);
    _togglePopover($newDataset, NEW_DATASET);
};

let generateUUIDv4 = () => {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
};

let getDropzones = async (url, usr, pwd) => {
  let workspaceId = $('.workspaces .active').data('id');
  return new Promise((resolve) => {
    fetch('/workspaces/dropzones/' + workspaceId)
      .then(resp => resp.json())
      .then(json => resolve(json.dropzones))
  });
};

let getThors = async (workspaceId) => {
  return new Promise((resolve, reject) => {
    fetch('/workspaces/clusters/' + workspaceId)
      .then(resp => resp.json())
      .then(json => {
        if (json.success) {
          resolve(json.clusters);
        } else {
          reject(json);
        }
      })
  });
};

let getDefaultTargetCluster = async (url, usr, pwd) => {
  return new Promise((resolve) => {
    url = ((cluster.host.indexOf('http') < 0) ? 'http://' : '') + cluster.host + ':' + cluster.port + url;
    fetch(url)
      .then(resp => resp.json())
      .then(json => {
        let _clusters = json.TpListTargetClustersResponse.TargetClusters.TpClusterNameType,
            target = _clusters.filter(cluster => cluster.IsDefault);

        if (target.length === 1) {
          resolve(target[0].Name);
        }
      })
  })
};

let populateScriptTargets = async () => {
  let clusterUrl = cluster.host + (cluster.port != '' ? ':' + cluster.port : ''),
      clusters = [],
      workspaceId = $('.workspaces .active').data('id');

  if (clusterUrl.indexOf('http') < 0) {
    clusterUrl = 'http://' + clusterUrl;
  }
  try {
    clusters = await getThors(workspaceId);
  } catch (err) {
    alert(err.message);
    return false;
  }
  let $selectTarget = $('#selectTarget'),
      $thors = $('.thors'),
      $clusters = $thors.find('.dropdown-item:not(.cloner)');

  $selectTarget.text('Select...');
  $clusters.remove();

  clusters.forEach(cluster => {
    let $newTarget = $thors.find('.cloner').clone();
    $newTarget.removeClass('d-none cloner');
    $newTarget.data('name', cluster);
    $newTarget.text(cluster);
    $thors.append($newTarget);
  });
};

let getFormData = ($form) => {
  let arr = $form.serializeArray(),
      result = {};

  $.map(arr, (el, idx) => { result[el['name']] = el['value'] });

  return result;
};

let isDataPatternProfile = (schema) => {
  let matchThreshold = 4,
      matches = 0,
      knownProfileField = (column) => {
        return ([
          'attribute', 'given_attribute_type', 'best_attribute_type',
          'rec_count', 'fill_count', 'fill_rate', 'cardinality',
          'cardinality_breakdown', 'modes', 'min_length', 'max_length',
          'ave_length', 'popular_patterns', 'rare_patterns', 'is_numeric',
          'numeric_min', 'numeric_max', 'numeric_mean', 'numeric_std_dev',
          'numeric_lower_quartile', 'numeric_median', 'numeric_upper_quartile',
          'numeric_correlations'
        ].indexOf(column.ColumnName) > -1);
      };

  return (schema.filter(knownProfileField).length > matchThreshold);
};

let isVisualization = (name) => {
  return name.indexOf('__hpcc_visualization') > -1;
}

let isDashboard = (name) => {
  return name.indexOf('_dashboard') > -1;
}

require.config({
  paths: {
    '_': '/javascripts/lodash',
    'downloadjs': 'https://cdnjs.cloudflare.com/ajax/libs/downloadjs/1.4.8/download.min',
    'g2plot': 'https://cdn.jsdelivr.net/npm/@antv/g2plot@1.1.3/dist/g2plot',
    'papaparse': '/javascripts/papaparse',
    '@hpcc-js/util': '/javascripts/hpcc-js/util/dist/index.min',
    '@hpcc-js/comms': '/javascripts/hpcc-js/comms/dist/index.min',
  },
  packages: [{
    name: 'codemirror',
    location: '/javascripts/codemirror/',
    main: 'lib/codemirror'
  }],
  onNodeCreated: function(node, config, module, path) {
    var sri = {
      downloadjs: 'sha256-k77iqKeo6Og1Lf5mawux2rTxjaV9zUtyOWKVX3VttKE=',
      g2plot: 'sha256-/7CaTud+CGiLqmiMviUAJRJHVKeVyFyxEAjaM9IwwdA='
    };

    if (sri[module]) {
      node.setAttribute('integrity', sri[module]);
      node.setAttribute('crossorigin', 'anonymous');
    }
  }
});

require([
  'codemirror', '_/lodash.min', '@hpcc-js/comms', 'papaparse/papaparse.min',
  'downloadjs', 'g2plot', 'codemirror/mode/ecl/ecl', 'codemirror/mode/sql/sql',
  'codemirror/addon/selection/active-line',
  'codemirror/addon/scroll/simplescrollbars',
  'codemirror/addon/comment/comment',
  'codemirror/keymap/sublime'
], function(CodeMirror, _, comms, Papa, downloadjs, g2plot) {
  let editor = null,
      editor2 = null,
      $draggedObject = null,
      $scriptPanel = $('.script-panel'),
      $main = $('[role="main"]'),
      $sidebar = $('.sidebar'),
      $outputsPanel = $('.outputs-panel');

  $scriptPanel.resizable({
    handles: 'n',
    stop: function(evt, ui) {
      $('.dataTables_scrollBody').css('height', parseInt(window.innerHeight - 425, 10) + 'px');
    }
  });
  $main.css({
    'margin-left': $sidebar.css('width'),
  });
  $outputsPanel.css('left', $sidebar.css('width'));
  $scriptPanel.css('width', 'calc(100% - ' + $sidebar.css('width') + ')');

  $sidebar.resizable({
    handles: 'e',
    resize: function(evt, ui) {
      $main.css({
        'margin-left': $sidebar.css('width'),
        'width': 'calc(100% - ' + $sidebar.css('width') + ')',
      });
      $outputsPanel.css('left', $sidebar.css('width'));
      $scriptPanel.css('width', 'calc(100% - ' + $sidebar.css('width') + ')');
    },
    stop: function(evt, ui) {
      if (parseInt($sidebar.css('width'), 10) > 225) {
        $sidebar.data('last-width', $sidebar.css('width'));
      } else {
        $sidebar.data('last-width', '');
      }
    }
  });

  if ('ResizeObserver' in self) {
    var ro = new ResizeObserver(function(entries) {
      var defaultBreakpoints = {SM: 25, MD: 85, LG: 230, XL: 320};

      entries.forEach(function(entry) {
        var breakpoints = entry.target.dataset.breakpoints ?
            JSON.parse(entry.target.dataset.breakpoints) :
            defaultBreakpoints;

        Object.keys(breakpoints).forEach(function(breakpoint) {
          var minWidth = breakpoints[breakpoint];
          if (entry.contentRect.width >= minWidth) {
            entry.target.classList.add(breakpoint);
          } else {
            entry.target.classList.remove(breakpoint);
          }
        });
      });
    });

    var elements = document.querySelectorAll('[data-observe-resize]');
    for (var element, i = 0; element = elements[i]; i++) {
      ro.observe(element);
    }
  }

  $('.sidebar-collapser').on('click', function() {
    if ($sidebar.hasClass('MD')) {
      $sidebar.css('width', '60px');
      $scriptPanel.css('width', 'calc(100% - 60px)');
      $main.css({
        'width': 'calc(100% - 60px)',
        'margin-left': '60px'
      }).find('.outputs-panel').css({
        'left': '60px',
      });
    } else {
      let lastWidth = $sidebar.data('last-width') || '225px';
      $sidebar.css('width', lastWidth);
      $scriptPanel.css('width', 'calc(100% - ' + lastWidth + ')');
      $main.css({
        'width': 'calc(100% - ' + lastWidth + ')',
        'margin-left': lastWidth
      }).find('.outputs-panel').css({
        'left': lastWidth,
      });
    }
  });

let displayWorkunitResults = (opts) => {
  let $datasetContent = $('.dataset-content'),
      $scopeDefn = $outputsPanel.find('.scopename'),
      $activeWorkspace = $('.workspaces .active'),
      query = $('.datasets .active').data('query'),
      scopeRegex = /\~([-a-zA-Z0-9_]+::)+[-a-zA-Z0-9_]+\.[a-zA-Z]+_thor/,
      $loader = $datasetContent.siblings('.loader'),
      $tableWrapper = $datasetContent.find('.table-wrapper'),
      $table = null,
      defaultOpts = {
        wuid: null,
        name: null,
        sequence: 0,
        hideScope: false
      };

  opts = { ...defaultOpts, ...opts };

  $datasetContent.addClass('d-none');
  if (opts.logicalfile) {
    $outputsList.addClass('d-none');
    $outputsPanel.find('.wu-link').addClass('d-none');
  }
  $scopeDefn.addClass('d-none');
  $loader.removeClass('d-none');

  checkWorkunitStatus(opts.wuid)
  .then(response => response.json())
  .then(async (status) => {
    // console.log(status);

    if (status.state == 'unknown') {
      let defaultClusterTarget = await getDefaultTargetCluster(
        '/WsTopology/TpListTargetClusters.json',
        $activeWorkspace.data('clusterUsername'),
        $activeWorkspace.data('clusterPassword')
      );
      await submitWorkunit(opts.wuid, defaultClusterTarget);

      let statusResp = await checkWorkunitStatus(opts.wuid);
      status = await statusResp.json();

      while (status.state != 'completed') {
        if (status.state == 'failed') break;
        statusResp = await checkWorkunitStatus(opts.wuid);
        status = await statusResp.json();
      }
    }

    getWorkunitResults({
      wuid: opts.wuid,
      logicalfile: opts.logicalfile,
      count: 1000,
      sequence: opts.sequence
    })
    .then(response => response.json())
    .then((wuResult) => {
      if (!wuResult.WUResultResponse) {
        throw 'No Workunit Response available for ' + opts.wuid;
      }

      let results = wuResult.WUResultResponse.Result.Row,
          schema = comms.parseXSD(wuResult.WUResultResponse.Result.XmlSchema.xml).root;

      if (results.length < 1) {
        throw 'No results for Workunit ' + opts.wuid;
      }

      $tableWrapper.html(
        '<table class="table data-table" style="width: 100%;">' +
        '<thead><tr></tr></thead><tbody></tbody>' +
        '<tfoot><tr></tr></tfoot></table>'
      );
      $table = $tableWrapper.find('.data-table');

      let jsonSchema = {}, trsArr = [], trs = '';

      // this function does two things... while iterating over the xml schema
      // one: it generates the data-table's header rows
      // two: it creates a more normal json object that representing the schema
      let createHeaders = (cols, count, _schema) => {
        if (!trsArr[count]) trsArr[count] = [];
        // iterate through the columns of the workunit's xml schema
        cols.forEach(column => {
          // if the node has children, it will span multiple columns
          // if not, it will likely span multiple rows, assuming any node has children
          trsArr[count].push('<th rowspan="' + ((column.children().length > 0 || count > 0) ? "1" : "2") +
            '" colspan="' + ((column.children().length > 0) ? column.children().length : "1") + '">' +
            column.name + '</th>');
          if (column.children().length > 0) {
            _schema[column.name] = {};
            createHeaders(column.children(), count + 1, _schema[column.name]);
          } else {
            _schema[column.name] = column.type;
          }
        });
      };
      createHeaders(schema.children(), 0, jsonSchema);

      trsArr.forEach(arr => {
        trs += '<tr>' + arr.join('') + '</tr>';
      });
      // if there was only one row of headers added to the array, then
      // make all rowspans == 1, otherwise jQ DataTable will throw an exception
      if (trsArr.length < 2) {
        trs = trs.replace(/rowspan="2"/g, 'rowspan="1"');
      }

      $table.find('thead').html(trs);
      $table.find('tfoot').html(trs);

      let docFrag = document.createDocumentFragment();
      results.forEach((row) => {
        let _tr = document.createElement('tr');
        schema.children().forEach((attr) => {
          // if this element in the results has a child record
          if (typeof jsonSchema[attr.name] == 'object') {
            if (row[attr.name].Row) {
              if (row[attr.name].Row.length > 0) {
                // iterate over the schema-defined keys
                for (var _attr in jsonSchema[attr.name]) {
                  let _td = document.createElement('td');
                  _td.setAttribute('scope', 'row');
                  // in order to reference the values while iterating
                  // over each child row. creating multiple spans inside
                  // of a single td
                  for (var i = 0; i < row[attr.name].Row.length; i++) {
                    let _span = document.createElement('span');
                    _span.textContent = row[attr.name].Row[i][_attr];
                    _td.appendChild(_span);
                  }
                  _tr.appendChild(_td);
                }
              } else {
                for (var _attr in jsonSchema[attr.name]) {
                  let _td = document.createElement('td');
                  _td.setAttribute('scope', 'row');
                  _td.textContent = '';
                  _tr.appendChild(_td);
                }
              }
            } else {
              for (var _attr in jsonSchema[attr.name]) {
                let _td = document.createElement('td');
                _td.setAttribute('scope', 'row');
                _td.textContent = row[attr.name][_attr];
                _tr.appendChild(_td);
              }
            }
          } else {
            let _td = document.createElement('td');
            _td.setAttribute('scope', 'row');
            _td.textContent = row[attr.name];
            _tr.appendChild(_td);
          }
        });
        docFrag.appendChild(_tr);
      });
      $table.find('tbody')[0].appendChild(docFrag);

      if (dataTable !== null) {
        dataTable.destroy();
      }
      dataTable = $table.DataTable({
        order: [],
        pageLength: 25,
        scrollX: true,
        scrollY: parseInt(window.innerHeight - 405, 10)
      });

      let _t = window.setTimeout(function() {
        dataTable.columns.adjust().draw();
        $('.dataTables_scrollBody').css({
          'max-height': $('.dataTables_scrollBody').css('height'),
          'height': ''
        });
        window.clearTimeout(_t);
      }, 100);

      $loader.addClass('d-none');
      $datasetContent.removeClass('d-none');
      if (query && query.match(scopeRegex) !== null && !opts.hideScope) {
        $scopeDefn.text('(' + query.match(scopeRegex)[0] + ')');
        $scopeDefn.removeClass('d-none');
      }
    })
    .catch((err) => {
      $loader.addClass('d-none');
      alert(err);
    });

  });
};

  $('#tour-link').on('click', function() {
    tour.start();
  });

  if ($('#editor').length > 0) {
    editor = CodeMirror($('#editor')[0], {
      mode: "ecl",
      lineNumbers: true,
      // extraKeys: {"Ctrl-Space": "autocomplete"},
      keyMap: "sublime",
      autoCloseBrackets: true,
      matchBrackets: true,
      showCursorWhenSelecting: true,
      styleActiveLine: true,
      viewPortMargin: 10,
      scrollbarStyle: 'overlay',
      theme: "darcula",
      tabSize: 2,
      gutters: ['CodeMirror-linenumbers', 'cm-errors']
    });
  }

  if ($('#editor2').length > 0) {
    editor2 = CodeMirror($('#editor2')[0], {
      mode: "ecl",
      lineNumbers: true,
      // extraKeys: {"Ctrl-Space": "autocomplete"},
      keyMap: "sublime",
      autoCloseBrackets: true,
      matchBrackets: true,
      showCursorWhenSelecting: true,
      styleActiveLine: true,
      viewPortMargin: 10,
      scrollbarStyle: 'overlay',
      theme: "darcula",
      tabSize: 2,
      gutters: ['CodeMirror-linenumbers', 'cm-errors']
    });
  }

  if ($('.workspaces').length > 0 &&
      ($('.datasets').length > 0 && $('.scripts').length > 0)) {
    populateWorkspaces();
  }

  $('[data-toggle="popover"]').popover();

  $('.js-collapser').on('click', function(evt) {
    let $this = $(this),
        $chevron = $this.find('.fa');

    if (!$sidebar.hasClass('MD')) {
      $('.sidebar-collapser').trigger('click');
      if ($chevron.hasClass('fa-chevron-down')) return false;
    }

    if ($chevron.hasClass('fa-chevron-right')) {
      $chevron.removeClass('fa-chevron-right');
      $chevron.addClass('fa-chevron-down');
    } else {
      $chevron.removeClass('fa-chevron-down');
      $chevron.addClass('fa-chevron-right');
    }
  });

  $('.modal').on('shown.bs.modal', function(evt) {
    $(evt.target).find('input:first').focus();
  });

  $('body').on('animationend', '.shake', function(evt) {
    $(this).removeClass('shake');
  });

  let clearLoadMsgTimeout = window.setTimeout(function() {
    $(".workspace-load-msg").find('.close').trigger('click');
    window.clearTimeout(clearLoadMsgTimeout);
  }, 5000);

  /*==========================================================================*
   *  WORKSPACES                                                              *
   *==========================================================================*/

  /* CREATE NEW WORKSPACE */
  $('#newWorkspaceModal').on('click', '.btn-primary', function(evt) {
    let $modal = $('#newWorkspaceModal'),
        $workspaces = $('.workspaces'),
        $tip = $('.workspace-tip'),
        $newWorkspace = $workspaces.find('.cloner').clone(),
        $workspaceName = $modal.find('#workspace-name'),
        $workspaceUrl = $modal.find('#workspace-url'),
        $deleteWorkspace = $('.delete-workspace').parent(),
        $form = $modal.find('.tab-pane.active form');

    if ($form.data('type') == 'create') {
      if ($form[0].checkValidity() === false) {
        evt.preventDefault();
        evt.stopPropagation();
        $form.addClass('was-validated');
        return false;
      }

      fetch('/workspaces/', {
        method: 'POST',
        body: JSON.stringify(getFormData($form)),
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken
        }
      })
      .then(response => response.json())
      .then((workspace) => {
        $modal.modal('hide');

        $newWorkspace.removeClass('d-none cloner');
        $newWorkspace.data('name', workspace.name);
        $newWorkspace.data('cluster', workspace.cluster);
        $newWorkspace.data('id', workspace.id);
        $newWorkspace.data('directoryTree', workspace.directoryTree);
        $newWorkspace.text($newWorkspace.data('name'));
        $workspaces.append($newWorkspace);

        $workspaceName.val('');

        $form.removeClass('was-validated');
        $tip.addClass('d-none');
        $deleteWorkspace.removeClass('d-none');

        $workspaces.find('.dropdown-item').filter((idx, el) => {
          return $(el).text() === $newWorkspace.data('name')
        }).trigger('click');

        toggleNewScriptPopover();
      });
    } else if ($form.data('type') == 'import-url') {
      window.location = '/workspaces/share/' + $workspaceUrl.data('id');
    } else if ($form.data('type') == 'import-zip') {
      let formData = new FormData(),
          _workspaceName = $('#zip-workspace-name').val(),
          _cluster = $('#zip-workspace-cluster').val(),
          _clusterUser = $('#zip-cluster-username').val(),
          _clusterPass = $('#zip-cluster-password').val(),
          file = $('#workspace-zip')[0].files[0];

      formData.append('workspaceName', _workspaceName);
      formData.append('workspaceCluster', _cluster);
      formData.append('clusterUsername', _clusterUser);
      formData.append('clusterPassword', _clusterPass);
      formData.append('file', file);

      fetch('/workspaces/import/zip', {
        method: 'POST',
        body: formData,
        headers: {
          'CSRF-Token': csrfToken
        }
      })
      .then(response => response.json())
      .then((workspace) => {
        $modal.modal('hide');

        $newWorkspace.removeClass('d-none cloner');
        $newWorkspace.data('name', workspace.name);
        $newWorkspace.data('cluster', workspace.cluster);
        $newWorkspace.data('id', workspace.id);
        $newWorkspace.data('directoryTree', workspace.directoryTree);
        $newWorkspace.text($newWorkspace.data('name'));
        $workspaces.append($newWorkspace);

        $workspaceName.val('');

        $form.removeClass('was-validated');
        $tip.addClass('d-none');
        $deleteWorkspace.removeClass('d-none');

        $workspaces.find('.dropdown-item').filter((idx, el) => {
          return $(el).text() === $newWorkspace.data('name')
        }).trigger('click');

        toggleNewScriptPopover();
      });
    }
  });

  $('#newWorkspaceModal').on('keyup', '#workspace-url', _.debounce(function(evt) {
    let url = evt.target.value,
        re = new RegExp(/.*\/workspaces\/share\/([0-9a-f]{8}\-([0-9a-f]{4}\-){3}[0-9a-f]{12})/),
        matches = url.match(re),
        guid = null,
        $workspaceSummary = $('.workspace-summary'),
        $workspaceUrl = $('#workspace-url'),
        $workspaceName = $workspaceSummary.find('.workspace-name'),
        $workspaceCreator = $workspaceSummary.find('.workspace-creator'),
        $workspaceCreated = $workspaceSummary.find('.workspace-created');
    if (!matches) {
      // console.log('no match');
    } else {
      guid = (matches[1]) ? matches[1] : guid;
      $workspaceUrl.data('id', guid);
      fetch('/workspaces/summary/' + guid)
        .then(response => response.json())
        .then(json => {
          $workspaceName.find('span').text(json.data.name);
          $workspaceCreator.find('span').text(json.data.Users[0].username);
          $workspaceCreated.find('span').text(new Date(json.data.createdAt).toLocaleDateString());
          $workspaceSummary.removeClass('d-none');
        });
    }
  }, 500));

  /* RESET NEW WORKSPACE FORM ON MODAL HIDE */
  $('#newWorkspaceModal').on('hide.bs.modal', function(evt) {
    $('#newWorkspaceModal form').removeClass('was-validated');
    $('#newWorkspaceModal form').each((idx, form) => { form.reset(); });
    $('#cluster-password').data('changed', false);
    $('.workspace-summary').addClass('d-none');
    $('#nav-create-workspace-tab').addClass('active show').siblings().removeClass('active show');
    $('#create-workspace').addClass('active show').siblings().removeClass('active show');
  });

  /* CHANGE SELECTED WORKSPACE */
  let changeWorkspace = async function($workspace) {
    let $this = $workspace,
        directoryTree = JSON.parse($this.data('directoryTree')),
        $previousWorkspace = $('.workspaces .active'),
        $options = $('.workspaces .dropdown-item'),
        $selected = $('#workspaceSelect'),
        $scriptPanel = $('.script-panel'),
        $scriptPanelClose = $('.js-close'),
        $scripts = $('.scripts .script'),
        $deleteWorkspace = $('.delete-workspace').parent(),
        $datasetContent = $('.dataset-content'),
        $main = $datasetContent.parents('main'),
        $mainScriptTabs = $('.main-script-tabs'),
        $mainTabList = $mainScriptTabs.find('.tab-list'),
        $secondScriptTabs = $('.secondary-script-tabs'),
        $secondTabList = $secondScriptTabs.find('.tab-list'),
        $editor = $('#editor'),
        $editor2 = $('#editor2'),
        editors = [ editor, editor2 ],
        $tableWrapper = $datasetContent.find('.table-wrapper');

    if ($previousWorkspace.length > 0) {
      fetch('/workspaces/', {
        method: 'PUT',
        body: JSON.stringify({
          id: $previousWorkspace.data('id'),
          directoryTree: JSON.parse($previousWorkspace.data('directoryTree'))
        }),
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken
        }
      });
    }

    $datasetContent.addClass('d-none');
    $tableWrapper.html('');

    $mainScriptTabs.find('li:not(.cloner)').remove();
    $secondScriptTabs.find('li:not(.cloner)').remove();

    $options.removeClass('active');
    $this.addClass('active');
    $main.removeClass('show-outputs');
    $selected.text($this.text());
    $deleteWorkspace.removeClass('d-none');
    $selected.append(
      '<i class="fa fa-file-archive-o zip float-right" title="Export Workspace..."></i>' +
      '<i class="fa fa-pencil-square-o edit float-right" title="Edit Workspace..."></i>' +
      '<i class="fa fa-share-alt share float-right ml-2" title="Share Workspace..."></i>'
    );

    $scriptPanelClose.trigger('click');

    populateWorkspaceDirectoryTree(JSON.parse($this.data('directoryTree')));
    await populateDatasets();
    await populateScripts();

    $scripts = $('.scripts .script:not(.cloner)');

    if (directoryTree.openTabs && directoryTree.openTabs['main-script-tabs'].length > 0) {
      directoryTree.openTabs['main-script-tabs'].forEach((id, idx) => {
        let $script = $scripts.filter((idx, el) => {
          return $(el).data('id') == id;
        });
        // console.log($script.data());
        let $newTab = $mainTabList.find('.cloner').clone();
        $mainTabList.append($newTab);
        $newTab.find('span').text($script.data('name'));
        $('.script-controls-row-one').find('li').removeClass('active');
        $newTab.removeClass('cloner d-none').addClass('active');
        $newTab.data($script.data());
        if (idx == 0) {
          editor.getDoc().setValue($script.data('content') ? $script.data('content') : '');
          $editor.addClass('cmReady');
        }
      });
      $editor.removeClass('w-50').css('width', 'calc(100% - 20px)');

      if (directoryTree.openTabs['secondary-script-tabs'].length > 0) {
        directoryTree.openTabs['secondary-script-tabs'].forEach((id, idx) => {
          let $script = $scripts.filter((idx, el) => {
            return $(el).data('id') == id;
          });
          let $newTab = $secondTabList.find('.cloner').clone();
          $secondTabList.append($newTab);
          $newTab.find('span').text($script.data('name'));
          $('.script-controls-row-one').find('li').removeClass('active');
          $newTab.removeClass('cloner d-none').addClass('active');
          $newTab.data($script.data());
          if (idx == 0) {
            editor2.getDoc().setValue($script.data('content'));
            $editor2.addClass('cmReady');
          }
        });
        $editor.addClass('w-50').css('width', '');
        $mainScriptTabs.addClass('w-50 border-right');
        $secondScriptTabs.addClass('w-50').removeClass('empty');
        $editor2.removeClass('d-none');
      } else {
        $editor.removeClass('w-50').css('width', 'calc(100% - 20px)');
        editors[1].getDoc().setValue('');
        $editor2.addClass('d-none');
        $mainScriptTabs.removeClass('w-50').removeClass('border-right');
        $secondScriptTabs.removeClass('w-50').addClass('empty');
      }

      $scriptPanel.removeClass('d-none');
      let _t = window.setTimeout(function() {
        if (!$editor2.hasClass('d-none')) {
          $secondScriptTabs.find('li:not(.cloner)').first().trigger('click');
        }
        $mainScriptTabs.find('li:not(.cloner)').first().trigger('click');
        window.clearTimeout(_t);
      }, 200);
    } else {
      $('.script-tabs .tab-list').find('li:not(.cloner)').remove();
      $editor.removeClass('w-50').css('width', 'calc(100% - 20px)');
      editors[1].getDoc().setValue('');
      $editor2.addClass('d-none');
      $mainScriptTabs.removeClass('w-50').removeClass('border-right');
      $secondScriptTabs.removeClass('w-50').addClass('empty');
    }

    if ($this.data('cluster')) {
      if ($this.data('cluster').lastIndexOf(':') > 4) {
        setClusterHost($this.data('cluster').substring(0, $this.data('cluster').lastIndexOf(':')));
        setClusterPort($this.data('cluster').substring($this.data('cluster').lastIndexOf(':') + 1));
      } else {
        setClusterHost($this.data('cluster'));
        setClusterPort(null);
      }
    } else {
      setClusterHost(null);
      setClusterPort(null);
    }

    if ($this.data('clusterUsername') && $this.data('clusterUsername') !== '') {
      setClusterUser($this.data('clusterUsername'));
    }

    if ($this.data('clusterPassword') && $this.data('clusterPassword') !== '') {
      setClusterPass($this.data('clusterPassword'));
    }

    toggleNewScriptPopover();
    populateScriptTargets();
  };

  $('.workspaces').on('click', '.dropdown-item', function(evt) {
    let $this = $(this);
    evt.preventDefault();
    changeWorkspace($this);

    if (localStorage.getItem('_lastUsedWorkspace') != $('.workspaces .active').data('id')) {
      localStorage.setItem('_lastUsedWorkspace', $('.workspaces .active').data('id'));
      history.pushState(null, null, '?w=' + $('.workspaces .active').data('id'));
    }
  });

  window.addEventListener('popstate', () => {
    let qs = queryString.parse(window.location.search);
    let workspaceId = '';
    if (qs.w) {
      workspaceId = qs.w;
    }
    // console.log(workspaceId, localStorage.getItem('_lastUsedWorkspace'));
      if (workspaceId !== '' && workspaceId != localStorage.getItem('_lastUsedWorkspace')) {
      changeWorkspace($('.workspaces .dropdown-item').filter((idx, el) => {
        return $(el).data('id') == workspaceId;
      }));
      localStorage.setItem('_lastUsedWorkspace', workspaceId);
    }
  });

  /* SHOW WORKSPACE MEMBERS MODAL */
  $('#workspaceSelect').on('click', '.share', function(evt) {
    let $this = $(this),
        $workspace = $('.workspaces .active'),
        $shareUrl = $('#shareUrl'),
        $modal = $('#shareWorkspaceModal');

    evt.stopPropagation();

    //link.parentElement.removeChild(link);

    $shareUrl.val(hostname + '/workspaces/share/' + $workspace.data('id'));

    $modal.modal('show');
  });

  /* SHOW EDIT WORKSPACE MODAL */
  $('#workspaceSelect').on('click', '.edit', function(evt) {
    let $this = $(this),
        $workspace = $('.workspaces .active'),
        $modal = $('#editWorkspaceModal');

    evt.stopPropagation();

    //link.parentElement.removeChild(link);
    $modal.find('#edit-workspace-name').val($workspace.data('name'));
    $modal.find('#edit-workspace-cluster')
          .find('[value="' + $workspace.data('cluster') + '"]')
          .attr('selected', true);
    $modal.find('#edit-cluster-username').val($workspace.data('clusterUsername'));
    $modal.find('#edit-cluster-password').val($workspace.data('clusterPassword'));
    $modal.modal('show');
  });

  $('.toggle-password').on('click', function(evt) {
    let $this = $(this), $password = $this.prev();
    if ($this.hasClass('fa-eye-slash')) {
      $this.removeClass('fa-eye-slash').addClass('fa-eye').attr('title', 'Hide Password');
      $password.attr('type', 'text');
    } else {
      $this.removeClass('fa-eye').addClass('fa-eye-slash').attr('title', 'Show Password');
      $password.attr('type', 'password');
    }
  });

  $('#edit-cluster-password, #cluster-password').on('keyup', _.debounce(function(evt) {
    $(this).data('changed', true);
  }, 500));

  /* EDIT WORKSPACE */
  $('#editWorkspaceModal').on('click', '.btn-primary', function(evt) {
    let $modal = $('#editWorkspaceModal'),
        $selected = $('#workspaceSelect'),
        $workspace = $('.workspaces .active'),
        $workspaceId = $workspace.data('id'),
        $form = $modal.find('form'),
        $saveBtn = $(this),
        $saveBtnStatus = $saveBtn.find('.fa-pulse'),
        $cluster = $('#edit-workspace-cluster'),
        $password = $('#edit-cluster-password'),
        data = getFormData($form);

    if ($form[0].checkValidity() === false) {
      evt.preventDefault();
      evt.stopPropagation();
      $form.addClass('was-validated');
      return false;
    }

    if (false === $password.data('changed')) {
      delete data.clusterPassword;
    }

    data.id = $workspace.data('id');
    // console.log('submitting PUT with: ', JSON.stringify(data));

    fetch('/workspaces/', {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': csrfToken
      }
    })
    .then(response => response.json())
    .then(async (json) => {
      if (json.success === false) {
        $cluster.siblings('.invalid-feedback').text(json.message);
        $cluster.addClass('is-invalid');

        $saveBtnStatus.addClass('d-none');
        $saveBtn.removeAttr('disabled').removeClass('disabled');
      } else {
        if (false !== await populateScriptTargets()) {
          $modal.modal('hide');
          $password.removeClass('is-invalid');
          $workspace.data('name', json.data.name);
          $workspace.text($workspace.data('name'));
          $selected.text($workspace.data('name'));
          $selected.append(
            '<i class="fa fa-file-archive-o zip float-right" title="Export Workspace..."></i>' +
            '<i class="fa fa-pencil-square-o edit float-right" title="Edit Workspace..."></i>' +
            '<i class="fa fa-share-alt share float-right ml-2" title="Share Workspace..."></i>'
          );
          $workspace.data('cluster', json.data.cluster);
          $workspace.data('clusterUsername', json.data.clusterUser);
          $modal.find('#edit-workspace-name').val('');
          $form.removeClass('was-validated');
        } else {
          $password.addClass('is-invalid');
        }
      }
    });
  });

  /* RESET EDIT WORKSPACE FORM ON MODAL HIDE */
  $('#editWorkspaceModal').on('hide.bs.modal', function(evt) {
    $('#editWorkspaceModal form').removeClass('was-validated');
    $('#editWorkspaceModal form')[0].reset();
    $('#edit-workspace-cluster').removeClass('is-invalid')
      .find('option').attr('selected', false);
    $('#edit-cluster-password').val('').data('changed', false);
  });

  $('#shareWorkspaceModal').on('click', '.share-url-btn', function(evt) {
    let $this = $(this),
        $shareUrl = $('#shareUrl');

    evt.preventDefault();
    try {
      $shareUrl.select();
      document.execCommand('copy');
      $shareUrl.blur();
      $this.attr('title', 'Copied');
      $this.tooltip('enable');
      $this.tooltip('show', {
        placement: 'top'
      });

      let t = window.setTimeout(function() {
        $this.tooltip('disable');
        $this.attr('title', 'Copy Url');
        window.clearTimeout(t);
      }, 500);
    } catch(err) {
      alert('This browser doesn\'t support programmatic copy/paste. Please select the url and copy manually.');
    }
  });

  /* EXPORT WORKSPACE AS ZIP */
  $('#workspaceSelect').on('click', '.zip', function(evt) {
    let $activeWorkspace = $('.workspaces .active'),
        workspaceId = $activeWorkspace.data('id');

    evt.stopPropagation();

    fetch('/workspaces/export/zip/' + workspaceId)
      .then(function(resp) {
        // console.log(resp);
        return resp.blob();
      }).then(function(blob) {
        downloadjs(blob, $activeWorkspace.data('name') + '.zip', 'application/zip');
      })
      .catch(err => {
        alert('The current workspace couldn\'t be downloaded as an archive.')
        // console.log(err);
      });
  });

  /* SHOW DELETE WORKSPACE CONFIRMATION */
  $('.navbar-nav').on('click', '.delete-workspace', function(evt) {
    let $this = $(this),
        $modal = $('#removeWorkspaceModal'),
        $workspaceSelect = $('#workspaceSelect');

    evt.stopPropagation();

    $modal.find('.workspacename').text($workspaceSelect.text());
    $modal.modal('show');
  });

  /* DELETE SELECTED WORKSPACE */
  $('#removeWorkspaceModal').on('click', '.btn-danger', function(evt) {
    let $modal = $('#removeWorkspaceModal'),
        $workspaces = $('.workspaces'),
        $selectedWorkspace = $workspaces.find('.active'),
        $scripts = $('.scripts .script:not(.cloner)'),
        $scriptsUl = $('.scripts ul').first(),
        $datasetContent = $('.dataset-content'),
        $datasets = $('.datasets .dataset:not(.cloner)'),
        $datasetsUl = $('.datasets ul').first(),
        $deleteWorkspace = $('.delete-workspace').parent(),
        $scriptPanelClose = $('.js-close'),
        $workspaceSelect = $('#workspaceSelect');

    fetch('/workspaces/', {
      method: 'DELETE',
      body: JSON.stringify({ workspaceId: $selectedWorkspace.data('id') }),
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': csrfToken
      }
    })
    .then(response => response.json())
    .then((json) => {
      $modal.modal('hide');
      $workspaces.find('.active').remove();
      $scripts.remove();
      $scriptsUl.children().remove();
      $datasets.remove();
      $datasetsUl.children().remove();
      $deleteWorkspace.addClass('d-none');
      $workspaceSelect.text(NO_WORKSPACE);

      if ($workspaces.find('.dropdown-item:not(.cloner)').length == 0) {
        $('.workspace-tip').removeClass('d-none');
      }

      $scriptPanelClose.trigger('click');

      toggleNewScriptPopover();
      $datasetContent.addClass('d-none');

      localStorage.removeItem('_lastUsedWorkspace');
    });
  });

  /*==========================================================================*
   *  DATASETS                                                                *
   *==========================================================================*/

  $('#newDatasetModal label[for="dataset-file"]').text('File (limit ' + (FILE_LIMIT / (1024 * 1024)) + 'MB):');

  /* ON NEW DATASET MODAL SHOWN */
  $('#newDatasetModal').on('shown.bs.modal', async function(evt) {
    let $modal = $('#newDatasetModal'),
        $dropzones = $modal.find('[name="dropzone"]'),
        workspaceId = $('.workspaces .active').data('id'),
        dropzones = await getDropzones(workspaceId);

    $dropzones.html('');

    for (var i in dropzones) {
      let optgroup = $('<optgroup label="' + i + '"></optgroup>');
      dropzones[i].forEach((addr) => {
        optgroup.append('<option value="' + addr + '">' + addr + '</option>');
      });
      $dropzones.append(optgroup);
    }
  });

  /* CREATE NEW DATASET */
  $('#newDatasetModal').on('click', '.btn-primary', async function(evt) {
    let $this = $(this),
        $saveBtn = $this,
        $saveBtnStatus = $this.find('.fa-pulse'),
        $modal = $('#newDatasetModal'),
        $datasets = $('.datasets'),
        $activeWorkspace = $('.workspaces .dropdown-item.active'),
        $workspaceId = $activeWorkspace.data('id'),
        $workspaceName = $activeWorkspace.data('name'),
        parentPath = $this.data('parentPath'),
        directoryTree = JSON.parse($activeWorkspace.data('directoryTree')),
        $parentEl = $this.data('parentToReceiveChild'),
        $newDatasetLi = null,
        $newDataset = null,
        $datasetStatus = null,
        $form = $modal.find('.tab-pane.active').find('form'),
        $file = $('#dataset-file'),
        $datasetSearch = $('#dataset-search'),
        $fileDetails = $('.file-details'),
        $fileFeedback = $file.siblings('.invalid-feedback'),
        file = $('#dataset-file')[0].files[0],
        dropzone = $('#dataset-dropzone').val(),
        $datasetName = $('#dataset-name').val(),
        $rowPath = $('#dataset-row-path').val(),
        data = getFormData($form),
        keys = Object.keys(currentDatasetFile),
        values = Object.values(currentDatasetFile),
        subRecords = false,
        dataset = {
          name: $datasetName,
          workspaceId: $workspaceId,
          workspaceName: $workspaceName
        };

    // console.log(currentDatasetFile, keys, values);
    dataset.layout = '';
    dataset.rowpath = $rowPath;

    let generateRecord = (record, key, childRecs) => {
      let keys = Object.keys(record),
          name = (key) ? key.toUpperCase() + '_' : '',
          layout = name + 'LAYOUT := RECORD\n';

      if (!file) {
        return '';
      }

      if (_.isEqual(['_type', '_length', '_path'], keys)) {
        layout += '\t' + record._type + (record._length > -1 ? record._length : '') + ' ' + key;
        if (file.name.substr(file.name.lastIndexOf('.') + 1) == 'json') {
          layout += ((record._path != '') ? ' ' + record._path : '');
        }
        layout += ';\n';
      } else {
        if (keys.indexOf('isDataset') > -1) {
          keys.splice(keys.indexOf('isDataset'), 1);
        }
        keys.forEach((_key) => {
          let fieldKey = _key;
          if (ECL_KEYWORDS.indexOf(_key) > -1) {
            fieldKey = '_' + fieldKey;
          }
          if (record[_key]._type != undefined && record[_key]._length != null) {
            layout += '\t' + record[_key]._type + (record[_key]._length > -1 ? record[_key]._length : '') + ' ' + fieldKey;
            if (file.name.substr(file.name.lastIndexOf('.') + 1) == 'json') {
              layout += ((record[_key]._path != '') ? ' ' + record[_key]._path : '');
            }
            layout += ';\n';
          } else {
            if (childRecs.indexOf(_key) > -1) {
              layout += '\tDATASET(' + _key.toUpperCase() + '_LAYOUT) ' + fieldKey;
            } else {
              layout += '\t' + _key.toUpperCase() + '_LAYOUT ' + fieldKey;
            }
            if (file.name.substr(file.name.lastIndexOf('.') + 1) == 'json') {
              layout += ' {xpath(\'' + _key + '\')}';
            }
            layout += ';\n';
          }
        })
      }
      layout += 'END;\n\n';
      return layout;
    };

    let parseRecords = (schema, keys) => {
      let childRecs = [];
      keys.forEach((key, idx) => {
        let record = schema[key];
        if (!_.isEqual(['_type', '_length', '_path'], Object.keys(record))) {
          if (true === record.isDataset) {
            childRecs.push(key);
          }
          dataset.layout += generateRecord(record, key, childRecs);
        }
      });
      dataset.layout += generateRecord(schema, null, childRecs);
    };

    values.forEach((val) => {
      if (!val._type) subRecords = true;
      return;
    })

    if (subRecords) {
      parseRecords(currentDatasetFile, keys);
    } else {
      dataset.layout = generateRecord(currentDatasetFile);
    }

    // console.log(currentDatasetFile, dataset.layout);
    // return false;

    if (!$parentEl) $parentEl = $('.datasets ul').first();

    $saveBtnStatus.removeClass('d-none');
    $saveBtn.attr('disabled', 'disabled').addClass('disabled');

    if ($form[0].checkValidity() === false) {
      evt.preventDefault();
      evt.stopPropagation();
      $form.addClass('was-validated');

      $saveBtnStatus.addClass('d-none');
      $saveBtn.removeAttr('disabled').removeClass('disabled');

      return false;
    }

    if ($form.data('type') == 'upload') {
      if (file === undefined) {
        $file.siblings('.invalid-feedback').text(DEFAULT_FILE_FEEDBACK);
        $file.addClass('is-invalid');

        $saveBtnStatus.addClass('d-none');
        $saveBtn.removeAttr('disabled').removeClass('disabled');

        return false;
      }

      dataset.filename = file.name;

      let datasetResp = await fetch('/datasets/', {
        method: 'POST',
        body: JSON.stringify(dataset),
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken
        }
      });
      let datasetJson = await datasetResp.json();

      if (datasetJson.success === false) {
        $file.siblings('.invalid-feedback').text(datasetJson.message);
        $file.addClass('is-invalid');

        $saveBtnStatus.addClass('d-none');
        $saveBtn.removeAttr('disabled').removeClass('disabled');

        return false;
      }

      dataset.id = datasetJson.data.id;

      let uploadResp = await sendFileToLandingZone(file, dropzone);
      let uploadJson = await uploadResp.json();

      // console.log(uploadJson);
      dataset.file = uploadJson.file;

      let sprayResp = await sprayFile(uploadJson.file, $workspaceName, $workspaceId, dropzone);
      let sprayJson = await sprayResp.json();

      // console.log('sprayed file', sprayJson.wuid);
      await saveWorkunit(dataset.id, sprayJson.wuid);

      let wuResp = await createWorkunit();
      let wuJson = await wuResp.json();

      let _wuid = wuJson.wuid;
      await saveWorkunit(dataset.id, _wuid);

      let response = await createWorkunit();
      let dpJson = await response.json();
      let dpWuid = dpJson.wuid;
      let defaultClusterTarget = await getDefaultTargetCluster(
        '/WsTopology/TpListTargetClusters.json',
        $activeWorkspace.data('clusterUsername'),
        $activeWorkspace.data('clusterPassword')
      );

      await updateWorkunit(dpWuid, null, dataset.name + '-profile.ecl', null, dataset.id, $workspaceId);
      await submitWorkunit(dpWuid, defaultClusterTarget);

      // console.log('check status of DataPatterns workunit');

      let dpWorkunitStatusResp = await checkWorkunitStatus(dpWuid);
      let dpWorkunitStatusJson = await dpWorkunitStatusResp.json();

      while (['completed', 'failed'].indexOf(dpWorkunitStatusJson.state) < 0) {
        dpWorkunitStatusResp = await checkWorkunitStatus(dpWuid);
        dpWorkunitStatusJson = await dpWorkunitStatusResp.json();
      }

      if (dpWorkunitStatusJson.state == 'failed') {
        alert('Workunit failed - ' + dpWuid);

        await fetch('/datasets/', {
          method: 'DELETE',
          body: JSON.stringify({ datasetId: dataset.id }),
          headers: {
            'Content-Type': 'application/json',
            'CSRF-Token': csrfToken
          }
        });

        $saveBtnStatus.addClass('d-none');
        $saveBtn.removeAttr('disabled').removeClass('disabled');

        return false;
      }

      let dpWuResultsResp = await getWorkunitResults({ wuid: dpWuid });
      let dpWuResultsJson = await dpWuResultsResp.json();

      if (!dpWuResultsJson.WUResultResponse) {
        throw 'No Workunit Response available for ' + dpWuid;
      }
      let dpResults = dpWuResultsJson.WUResultResponse.Result.Row;
      if (dpResults.length < 1) {
        throw 'No results for Workunit ' + dpWuid;
      }
      // console.log(dpResults);

      let _query = dataset.layout;

      dpResults.forEach((result, idx) => {
        let attrName = result.attribute.substr(result.attribute.lastIndexOf('.') + 1),
            search = result.given_attribute_type + ' ' + attrName,
            replacement = result.best_attribute_type + ' ' + attrName;

        _query = _query.replace(search, replacement);
      });

      _query = _query.replace(/[^_]LAYOUT|^LAYOUT/, dataset.name);

      let dsType = '',
          fileExtension = dataset.filename.substr(dataset.filename.lastIndexOf('.') + 1).toLowerCase();

      switch (fileExtension) {
        case 'json':
          dsType = "JSON('" + ($rowPath ? $rowPath : "/") + "')";
          break;
        case 'csv':
        default:
          dsType = "CSV(HEADING(1))";
          break;
      }

      _query += "DS := DATASET('~#USERNAME#::" + $workspaceName + "::" +
        dataset.filename + "'," + dataset.name + "," + dsType + ");\nOUTPUT(DS,," +
        "'~#USERNAME#::" + $workspaceName + "::" + dataset.filename + "_thor'" +
        ",'thor',OVERWRITE);";

      // console.log(_query);

      await updateWorkunit(_wuid, _query, null, null, null, $workspaceId);
      await submitWorkunit(_wuid, defaultClusterTarget);

      dataset.wuid = _wuid;

      let workunitStatusResp = await checkWorkunitStatus(_wuid);
      let workunitStatusJson = await workunitStatusResp.json();

      while (['completed', 'failed'].indexOf(workunitStatusJson.state) < 0) {
        workunitStatusResp = await checkWorkunitStatus(_wuid);
        workunitStatusJson = await workunitStatusResp.json();
      }

      if (workunitStatusJson.state == 'failed') {
        alert('Workunit failed - ' + _wuid);

        await fetch('/datasets/', {
          method: 'DELETE',
          body: JSON.stringify({ datasetId: dataset.id }),
          headers: {
            'Content-Type': 'application/json',
            'CSRF-Token': csrfToken
          }
        });

        $saveBtnStatus.addClass('d-none');
        $saveBtn.removeAttr('disabled').removeClass('disabled');
        return false;
      }
      dataset.eclQuery = workunitStatusJson.query;

      if (workunitStatusJson.results[0].logicalFile) {
        dataset.logicalfile = workunitStatusJson.results[0].logicalFile;
      }

      if (workunitStatusJson.results[0].schema) {
        dataset.rowCount = workunitStatusJson.results[0].rows;
        dataset.columnCount = workunitStatusJson.results[0].columns;
        dataset.eclSchema = JSON.stringify(workunitStatusJson.results[0].schema);
      }
    } else if ($form.data('type') == 'import') {
      dataset.wuid = $datasetSearch.data('wuid');
      dataset.rowCount = $datasetSearch.data('rows');
      dataset.columnCount = $datasetSearch.data('query').split('\n').length - 3;
      dataset.eclQuery = $datasetSearch.data('query');
      dataset.name = $datasetSearch.data('name');
      dataset.filename = $datasetSearch.data('filename');
      dataset.logicalfile = $datasetSearch.data('filename');

      let datasetResp = await fetch('/datasets/', {
        method: 'POST',
        body: JSON.stringify(dataset),
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken
        }
      });
      let datasetJson = await datasetResp.json();

      if (datasetJson.success === false) {
        $datasetSearch.siblings('.invalid-feedback').text(datasetJson.message);
        $datasetSearch.addClass('is-invalid');

        $saveBtnStatus.addClass('d-none');
        $saveBtn.removeAttr('disabled').removeClass('disabled');

        return false;
      }

      dataset.id = datasetJson.data.id;

      await saveWorkunit(dataset.id, dataset.wuid);
    } //end if $form.data('type')

    await fetch('/datasets/', {
      method: 'PUT',
      body: JSON.stringify(dataset),
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': csrfToken
      }
    });

    // console.log(dataset, parentPath, directoryTree);

    let rootId = null,
        nextId = null,
        element = directoryTree['datasets'],
        newFile = null;

    if (parentPath && parentPath.length > 0) {
      rootId = parentPath.shift();
      element = element[rootId];

      while (parentPath.length > 0) {
        nextId = parentPath.shift();
        if (element.children[nextId]) {
          element = element.children[nextId];
        }
      }

      if (!element.children) {
        element.children = {};
      }

      element.children[dataset.id] = {
        name: dataset.name,
        id: dataset.id,
        children: {},
        type: 'file'
      };
      newFile = element.children[dataset.id];
    } else {
      element[dataset.id] = {
        name: dataset.name,
        id: dataset.id,
        children: {},
        type: 'file'
      }
      newFile = element[dataset.id];
    }

    // console.log(directoryTree);

    let workspaceResp = await fetch('/workspaces/', {
      method: 'PUT',
      body: JSON.stringify({
        id: $activeWorkspace.data('id'),
        directoryTree: directoryTree
      }),
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': csrfToken
      }
    });
    let workspaceJson = await workspaceResp.json();

    $activeWorkspace.data('directoryTree', JSON.stringify(directoryTree));

    newFile.workunitId = dataset.wuid;
    newFile.logicalfile = dataset.logicalfile;
    $newDatasetLi = addDataset(newFile);
    $newDataset = $newDatasetLi.find('.dataset');

    if ($parentEl[0].nodeName.toLowerCase() == 'ul') {
      $parentEl.append($newDatasetLi);
    } else {
      if ($parentEl.find('ul').first().length == 0) {
        $parentEl.append('<ul>');
      }
      $parentEl.find('ul').first().append($newDatasetLi);
    }

    showDatasets();
    //$newDataset.trigger('click');

    $saveBtnStatus.addClass('d-none');
    $saveBtn.removeAttr('disabled').removeClass('disabled');

    $modal.find('#dataset-name').val('');
    $form.removeClass('was-validated');
    $modal.modal('hide');

    $newDataset.find('.rows').text('Rows: ' + dataset.rowCount);
    $newDataset.find('.cols').text('Columns: ' + dataset.columnCount);
    $newDataset.data('eclSchema', dataset.eclSchema);
    $newDataset.data('query', dataset.eclQuery);

  }); //end #newDatasetModal.btn-primary click listener

  if ($('#dataset-search').length > 0) {
    let datasetSearchAuto = new autoComplete({
      selector: '#dataset-search',
      delay: 400,
      source: function(term, callback) {
        dfuQuery(term)
          .then(response => response.json())
          .then((data) => {
            callback(data);
          })
      },
      onSelect: function(evt, term, item) {
        getWorkunitResults({ wuid: '', count: 5, sequence: 0, logicalfile: term })
          .then(response => response.json())
          .then((wuResult) => {
            let results = wuResult.WUResultResponse.Result.Row,
                $tableWrapper = $('.file-preview'),
                $noDataMsg = $tableWrapper.find('p'),
                $table = $tableWrapper.find('.table');

            if (results.length > 0) {
              $tableWrapper.siblings('form-group').addClass('mb-0');
              $tableWrapper.addClass('d-none');
              $table.removeClass('d-none');
              $noDataMsg.addClass('d-none');
              $table.find('thead tr').html('');
              $table.find('tbody').html('');

              Object.keys(results[0]).forEach((key) => {
                $table.find('thead tr').append('<th scope="col">' + key + '</th>');
              });
              let docFrag = document.createDocumentFragment();
              results.forEach((row) => {
                let _tr = document.createElement('tr');
                for (var x in row) {
                  let _td = document.createElement('td');
                  _td.setAttribute('scope', 'row');
                  _td.textContent = row[x];
                  _tr.appendChild(_td);
                }
                docFrag.appendChild(_tr);
              });
              $table.find('tbody')[0].appendChild(docFrag);

              $tableWrapper.removeClass('d-none');
            } else {
              $tableWrapper.removeClass('d-none');
              $noDataMsg.removeClass('d-none');
              $table.addClass('d-none');
            }

            dfuInfo(term)
              .then(response => response.json())
              .then((json) => {
                $('#dataset-search').data({
                  filename: term,
                  wuid: json.wuid,
                  query: json.query,
                  name: json.name,
                  rows: json.rows
                })
              });
          });
      }
    });
  }

  let parseDataset = () => {
    let $file = $('#dataset-file'),
        $rowPath = $('#dataset-row-path'),
        $rowPathFormRow = $rowPath.parents('.form-group'),
        $rowInvalidMsg = $rowPath.siblings('.invalid-feedback'),
        $saveBtn = $file.parents('.modal').find('.btn-primary'),
        $fileFeedback = $file.siblings('.invalid-feedback'),
        $fileDetails = $('.file-details'),
        file = $file[0].files[0],
        fileName = '',
        fileExtension = '',
        rowPath = $rowPath.val().trim().replace('/', '').split('/'),
        parseResults = null;

    let appendRows = (labels, values) => {
      labels.forEach((label, idx) => {
        let $newFormRow = $('<div class="form-group"></div>'),
            headingsEl = '<label data-toggle="popover" data-placement="right" ' +
              'title="Headings" data-content="This is the first row from your file, ' +
              'which are being shown here as column headings. If you would like to ' +
              'override these column headings, change the values below.">Headings' +
              '<i class="fa fa-question-circle ml-1 text-secondary"></i></label>',
            valuesEl = '<label data-toggle="popover" data-placement="right" ' +
              'title="Sample Row" data-content="This is the second row from your file, ' +
              'which are being shown as an example for the fields that correspond to ' +
              'the column headings to the left. Changing these values will have no impact ' +
              'on the import process of your file.">Values' +
              '<i class="fa fa-question-circle ml-1 text-secondary"></i></label>';

        if (idx == 0) {
          $newFormRow.append('<span>' + headingsEl + '</span>');
          $newFormRow.append('<span>' + valuesEl + '</span>');
          $fileDetails.append('<hr />');
        }

        $newFormRow.append('<input type="text" class="form-control" value="' + label.replace(/ /g, '') + '" />');
        $newFormRow.append('<input type="text" class="form-control" value="' + values[idx] + '" disabled="disabled" />');

        $fileDetails.append($newFormRow);
      });

      $('[data-toggle="popover"]').popover({
        trigger: 'hover'
      });
    };

    $file.removeClass('is-invalid');
    $fileFeedback.text(DEFAULT_FILE_FEEDBACK);

    $rowInvalidMsg.text(DEFAULT_FILE_ROW_PATH_FEEDBACK);
    $rowPath.removeClass('is-invalid');

    $fileDetails.html('');

    if (!file) {
      $file.siblings('.invalid-feedback').text(DEFAULT_FILE_FEEDBACK);
      $file.addClass('is-invalid');
      $saveBtn.attr('disabled', 'disabled').addClass('disabled');
      return false;
    } else if (file.size > FILE_LIMIT) {
      $file.siblings('.invalid-feedback').text('Please select a file less than "' + (FILE_LIMIT / (1024 * 1024)) + 'MB" to upload.');
      $file.addClass('is-invalid');
      $saveBtn.attr('disabled', 'disabled').addClass('disabled');
      return false;
    }

    file.name.substr(0, file.name.lastIndexOf('.')).replace(/-|_|\s/g, '_').split('_').map((word) => {
      fileName += word.substr(0, 1).toUpperCase() + word.substr(1).toLowerCase();
    });
    fileName.trim();
    fileExtension = file.name.substr(file.name.lastIndexOf('.') + 1).toLowerCase();

    // console.log(file, fileName);

    $('#dataset-name').val(fileName);

    if (fileExtension != 'csv') {
      $rowPathFormRow.removeClass('d-none');
    } else {
      $rowPathFormRow.addClass('d-none');
    }

    parseDatasetFile(file, Papa, rowPath).then((parseResults) => {
      if (parseResults.success) {
        setCurrentDatasetFile(parseResults.schema);
        appendRows(Object.keys(parseResults.schema), parseResults.data);
      } else {
        $fileFeedback.text(parseResults.errorMsg);
        $file.addClass('is-invalid');
      }
    }).catch((parseResults) => {
      $fileFeedback.text(parseResults.errorMsg);
      $file.addClass('is-invalid');
    });

    $saveBtn.removeAttr('disabled').removeClass('disabled');
  };

  /* WHEN FILE IS SELECTED FOR NEW DATASET FORM */
  $('#dataset-file').on('change', function(evt) {
    parseDataset();
  });

  /* WHEN JSON DATASET ROW PATH CHANGES IN NEW DATASET FORM */
  $('#dataset-row-path').on('keyup', _.debounce(async (evt) => {
    parseDataset();
  }, 500));

  /* RESET NEW DATASET FORM ON MODAL HIDE */
  $('#newDatasetModal').on('hide.bs.modal', function(evt) {
    $('#newDatasetModal form').removeClass('was-validated');
    $('#newDatasetModal form')[0].reset();
    $('.file-details').html('');
    $('#dataset-file + .invalid-feedback').text(DEFAULT_FILE_FEEDBACK);
    $('#dataset-file').removeClass('is-invalid');
    $('#newDatasetModal .btn-primary .fa-pulse').addClass('d-none');
    $('#newDatasetModal .btn-primary').removeAttr('disabled').removeClass('disabled');
    $('#nav-upload-tab').addClass('active show').siblings().removeClass('active show');
    $('#nav-upload').addClass('active show').siblings().removeClass('active show');
    $('#dataset-search').val('').removeClass('is-invalid');
    $('#dataset-row-path + .invalid-feedback').text(DEFAULT_FILE_ROW_PATH_FEEDBACK);
    $('#dataset-row-path').removeClass('is-invalid');
    $('#dataset-row-path').parents('.form-group').addClass('d-none');
    $('#nav-import').find('.file-preview .table thead tr').html('')
      .end().find('.file-preview').addClass('d-none');
    $('#nav-import').find('.file-preview .table tbody').html('');
  });

  /* SHOW EDIT DATASET MODAL */
  $('.datasets').on('click', '.dataset .edit', function(evt) {
    let $this = $(this),
        $dataset = $this.parents('.dataset'),
        $modal = $('#editDatasetModal'),
        $saveBtn = $modal.find('.btn-primary');

    evt.stopPropagation();

    //link.parentElement.removeChild(link);
    $modal.find('#edit-dataset-name').val($dataset.find('.datasetname').text());
    $modal.modal('show');
    // console.log($dataset.index());
    $saveBtn.data('dataset', $dataset.data('id'));
    $saveBtn.data('elementToUpdate', $dataset);
    // console.log($modal.find('.btn-primary').data('dataset'));
  });

  /* EDIT DATASET */
  $('#editDatasetModal').on('click', '.btn-primary', function(evt) {
    let $this = $(this),
        $modal = $('#editDatasetModal'),
        $datasets = $('.datasets ul'),
        $dataset = $this.data('elementToUpdate'),
        $workspaceId = $('.workspaces .dropdown-item.active').data('id'),
        $form = $modal.find('form'),
        data = getFormData($form);

    if ($form[0].checkValidity() === false) {
      evt.preventDefault();
      evt.stopPropagation();
      $form.addClass('was-validated');
      return false;
    }

    data.id = $dataset.data('id');
    data.prevName = $dataset.data('name');
    data.workspaceId = $workspaceId;
    // console.log('submitting PUT with: ', JSON.stringify(data));

    fetch('/datasets/', {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': csrfToken
      }
    })
    .then(response => response.json())
    .then((dataset) => {
      $modal.modal('hide');
      $dataset.data('name', dataset.data.name);
      $dataset.find('.datasetname').text($dataset.data('name'));
      $modal.find('#edit-dataset-name').val('');
      $form.removeClass('was-validated');
      let dirTree = JSON.parse($('.workspaces .dropdown-item.active').data('directoryTree'));
      dirTree.datasets[$dataset.data('id')].name = dataset.data.name;
      $('.workspaces .active').data('directoryTree', JSON.stringify(dirTree));
      fetch('/workspaces/', {
        method: 'PUT',
        body: JSON.stringify({
          id: $workspaceId,
          directoryTree: dirTree
        }),
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken
        }
      })
      .then(response => response.json())
    });
  });

  /* RESET EDIT DATASET FORM ON MODAL HIDE */
  $('#editDatasetModal').on('hide.bs.modal', function(evt) {
    $('#editDatasetModal form').removeClass('was-validated');
    $('#editDatasetModal form')[0].reset();
  });

  /* CHANGE SELECTED DATASET */
  $('.datasets').on('click', '.dataset', function(evt) {
    let $this = $(this),
        $main = $('.dataset-content').parents('main');

    $('#datasets').find('.dataset').removeClass('active');
    $this.addClass('active');
    $main.removeClass('show-outputs');

    displayWorkunitResults({
      wuid: $this.data('wuid'),
      logicalfile: $this.data('logicalfile'),
      name: $this.data('name')
    });
  });

  /* SHOW DELETE DATASET CONFIRMATION */
  $('.datasets').on('click', '.dataset .delete', function(evt) {
    let $this = $(this),
        $dataset = $this.parents('.dataset'),
        $folder = $this.parents('li').first(),
        $modal = $('#removeDatasetModal'),
        $wrapper = $this.parents('.nav'),
        parentPath = [],
        $deleteBtn = $modal.find('.btn-danger');

    evt.stopPropagation();

    if ($folder.data('id')) {
      parentPath.unshift($folder.data('id'));
    }
    let $parent = $folder.parents('li');
    do {
      if ($parent.data('id')) {
        parentPath.unshift($parent.data('id'));
      }
      $parent = $parent.parents('li');
    } while ($parent.length > 0);

    //link.parentElement.removeChild(link);
    $modal.find('.dataset-name').text($dataset.find('.datasetname').text().trim());
    $modal.modal('show');
    // console.log($dataset.data());
    $deleteBtn.data('dataset', $dataset.data('id'));
    $deleteBtn.data('parentPath', parentPath);
    $deleteBtn.data('elementToRemove', $folder);
    // console.log($modal.find('.btn-danger').data('dataset'));
  });

  /* DELETE SELECTED DATASET */
  $('#removeDatasetModal').on('click', '.btn-danger', function(evt) {
    let $this = $(this),
        $modal = $('#removeDatasetModal'),
        $datasets = $('.datasets'),
        $activeWorkspace = $('.workspaces .active'),
        parentPath = $this.data('parentPath'),
        directoryTree = JSON.parse($activeWorkspace.data('directoryTree')),
        $elementToRemove = $this.data('elementToRemove'),
        $datasetCollapser = $('#dataset-collapser'),
        $targetDataset = $elementToRemove.find('.dataset'),
        targetId = $this.data('dataset');

    fetch('/datasets/', {
      method: 'DELETE',
      body: JSON.stringify({ datasetId: targetId }),
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': csrfToken
      }
    })
    .then(response => response.json())
    .then((json) => {
      let rootId = null,
          nextId = null,
          element = directoryTree['datasets'];

      if (parentPath.length > 0) {
        element = element[parentPath.shift()];

        while (parentPath.length > 0) {
          nextId = parentPath.shift();
          if (element.children[nextId]) {
            element = element.children[nextId];
          }
        }

        delete element.children[targetId];
      } else {
        delete element[targetId];
      }

      fetch('/workspaces/', {
        method: 'PUT',
        body: JSON.stringify({
          id: $activeWorkspace.data('id'),
          directoryTree: directoryTree
        }),
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken
        }
      })
      .then(response => response.json())
      .then((json) => {
        $activeWorkspace.data('directoryTree', JSON.stringify(directoryTree));
        $elementToRemove.remove();

        $modal.modal('hide');

        if ($datasets.children(':not(.cloner)').length < 1) {
          $datasetCollapser.trigger('click');
        }

        $('.dataset-content').addClass('d-none');
      });
    });
  });

  /*==========================================================================*
   *  SCRIPTS                                                                 *
   *==========================================================================*/

  let sortableTabs1 = null, sortableTabs2 = null;

  $('.scripts').on('click', '.script', function(evt) {
    let $this = $(this),
        _wuid = $this.data('wuid') ? $this.data('wuid') : '',
        _cluster = $this.data('cluster') ? $this.data('cluster') : '',
        $workspace = $('.workspaces .active'),
        directoryTree = JSON.parse($workspace.data('directoryTree')),
        $scriptControls = $('.script-controls'),
        $mainScriptTabs = $('.main-script-tabs'),
        $mainTabList = $mainScriptTabs.find('.tab-list'),
        $secondScriptTabs = $('.secondary-script-tabs'),
        $secondTabList = $secondScriptTabs.find('.tab-list'),
        $scriptPanel = $('.script-panel'),
        $neighbor = null,
        editors = [ editor, editor2 ],
        $editor = $('#editor'),
        $editor2 = $('#editor2'),
        $editors = [ $editor, $editor2 ],
        $activeEditor = $editor,
        $origTabs = null,
        $activeTabs = $mainScriptTabs,
        $activeTabsList = $activeTabs.find('ul'),
        $clusters = $('.thors'),
        $selectedCluster = $('#selectTarget');

    if ($this.data('name').indexOf('.hsql') > -1) {
      editors[$activeEditor.index()].setOption('mode', 'sql');
    } else {
      editors[$activeEditor.index()].setOption('mode', 'ecl');
    }

    if (!directoryTree.openTabs) {
      directoryTree.openTabs = {
        'main-script-tabs': [ $this.data('id') ],
        'secondary-script-tabs': []
      };
    } else {
      if (directoryTree.openTabs['main-script-tabs'].indexOf($this.data('id')) < 0 &&
        directoryTree.openTabs['secondary-script-tabs'].indexOf($this.data('id')) < 0) {
          directoryTree.openTabs['main-script-tabs'].push($this.data('id'));
      }
    }

    $workspace.data('directoryTree', JSON.stringify(directoryTree));

    fetch('/workspaces/', {
      method: 'PUT',
      body: JSON.stringify({
        id: $workspace.data('id'),
        directoryTree: JSON.parse($workspace.data('directoryTree'))
      }),
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': csrfToken
      }
    });

    // console.log(directoryTree);

    $('#scripts').find('.script').removeClass('active');
    $this.addClass('active');

    $scriptPanel.removeClass('d-none');
    $('#editor').removeClass('cmReady');
    $('.save-script').removeClass('badge-info').addClass('badge-secondary');

    if (_wuid == '') {
      $scriptControls.find('.show-results').addClass('d-none');
    } else {
      $scriptControls.find('.show-results').removeClass('d-none');
    }

    $clusters.find('.dropdown-item').removeClass('active');
    if (_cluster == '') {
      $selectedCluster.text('Select...');
    } else {
      $selectedCluster.text(_cluster);
      $clusters.find('.dropdown-item').filter((idx, el) => {
        return $(el).data('name') == _cluster;
      }).addClass('active');
    }

    let tabExists = $('.script-controls-row-one').find('li').filter((idx, li) => {
      return $(li).data('id') == $this.data('id');
    });

    if (tabExists.length === 0) {
      $activeTabs = $mainScriptTabs;
      $activeTabsList = $activeTabs.children('ul');
      $activeEditor = $editor;
      let $newTab = $activeTabsList.find('.cloner').clone();
      $activeTabsList.append($newTab);
      $newTab.find('span').text($this.data('name'));
      $('.script-controls-row-one').find('li').removeClass('active');
      $newTab.removeClass('cloner d-none').addClass('active');
      $newTab.data($this.data());
    } else {
      $activeTabs = $(tabExists).parents('.script-tabs');
      $activeTabsList = $activeTabs.children('ul');
      $activeEditor = $editors[$activeTabs.index()];
      $('.script-controls-row-one').find('li').removeClass('active');
      $(tabExists).addClass('active');
    }
    $('.editor').removeClass('active');
    $editors[$activeEditor.index()].addClass('active');
    $activeEditor.data('id', $this.data('id'));

    changeRunButtonState($('.run-script'), 'ready');
    if ($secondTabList.find('li:not(.cloner)').length == 0) {
      $editor.removeClass('w-50').css('width', 'calc(100% - 20px)');
    } else {
      $editor.addClass('w-50')
    }
    editors[$activeEditor.index()].refresh();

    if ($this.data('content')) {
      editors[$activeEditor.index()].getDoc().setValue($this.data('content'));
    } else {
      editors[$activeEditor.index()].getDoc().setValue('');
    }
    let _t = window.setTimeout(function() {
      $('#editor').addClass('cmReady');
      $('#editor2').addClass('cmReady');
      window.clearTimeout(_t);
    }, 100);

    if ($scriptPanel.hasClass('minimized')) {
      $('.js-restore').trigger('click');
    }

    if (sortableTabs1) sortableTabs1.destroy();
    if (sortableTabs2) sortableTabs2.destroy();

    sortableTabs1 = Sortable.create($mainTabList[0], {
      group: 'scriptTabs',
      dragClass: 'ghost',
      ghostClass: 'ghost',
      onStart: function(evt) {
        if ($secondTabList.parent().hasClass('empty')) {
          $mainScriptTabs.addClass('w-50');
          $mainScriptTabs.addClass('border-right');
          $secondScriptTabs.addClass('w-50').removeClass('empty');
        }

        $origTabs = $(evt.item).parents('.script-tabs');
        $neighbor = $(evt.item).next(':not(.cloner)');
        if ($neighbor.length === 0) {
          $neighbor = $(evt.item).prev(':not(.cloner)');
        }
      },
      onEnd: function(evt) {
        let $tab = $(evt.item);
        $tab.parents('.script-controls-row-one').find('li').removeClass('active');
        if ($secondTabList.find('li:not(.cloner)').length == 0) {
          $mainScriptTabs.removeClass('w-50');
          $mainScriptTabs.removeClass('border-right');
          $secondScriptTabs.removeClass('w-50').addClass('empty');
          $editor.removeClass('w-50').css('width', 'calc(100% - 20px)');
          $editor2.addClass('d-none');
          $tab.trigger('click');
        } else {
          //$editor.css('width', $mainScriptTabs.css('width'));
          //$editor2.css('width', 'calc(100% - ' + (parseFloat($editor.css('width')) + 20) + 'px').removeClass('d-none');
          $editor.addClass('w-50');
          $editor2.removeClass('d-none');
          if ($tab.data('content')) {
            editors[$tab.parents('.script-tabs').index()].getDoc().setValue($tab.data('content'));
            $tab.addClass('active').siblings().removeClass('active');
          } else {
            editors[$tab.parents('.script-tabs').index()].getDoc().setValue('');
          }
          if ($neighbor.data('content')) {
            editors[$neighbor.parents('.script-tabs').index()].getDoc().setValue($neighbor.data('content'));
          } else {
            editors[$origTabs.index()].getDoc().setValue('');
          }
        }
        if ($(evt.from).parents('div').hasClass('main-script-tabs')) {
          directoryTree.openTabs['main-script-tabs'].splice(evt.oldIndex - 1, 1);
        } else {
          directoryTree.openTabs['secondary-script-tabs'].splice(evt.oldIndex - 1, 1);
        }
        if ($(evt.to).parents('div').hasClass('main-script-tabs')) {
          directoryTree.openTabs['main-script-tabs'].splice(evt.newIndex - 1, 0, $tab.data('id'));
        } else {
          directoryTree.openTabs['secondary-script-tabs'].splice(evt.newIndex - 1, 0, $tab.data('id'));
        }
        $workspace.data('directoryTree', JSON.stringify(directoryTree));
        $('.editor').removeClass('active');
        $editors[$tab.parents('.script-tabs').index()].addClass('active').data('id', $tab.data('id'));
        if ($neighbor.data('id')) {
          $editors[$neighbor.parents('.script-tabs').index()].data('id', $neighbor.data('id'));
        } else {
          $editors[$origTabs.index()].data('id', '');
        }
      }
    });

    sortableTabs2 = Sortable.create($secondTabList[0], {
      group: 'scriptTabs',
      dragClass: 'ghost',
      ghostClass: 'ghost',
      onStart: function(evt) {
        if ($secondTabList.parent().hasClass('empty')) {
          $mainScriptTabs.addClass('w-50');
          $mainScriptTabs.addClass('border-right');
          $secondScriptTabs.addClass('w-50').removeClass('empty');
        }

        $origTabs = $(evt.item).parents('.script-tabs');
        $neighbor = $(evt.item).next(':not(.cloner)');
        if ($neighbor.length === 0) {
          $neighbor = $(evt.item).prev(':not(.cloner)');
        }
      },
      onEnd: function(evt) {
        let $tab = $(evt.item);
        $tab.parents('.script-controls-row-one').find('li').removeClass('active');
        if ($secondTabList.find('li:not(.cloner)').length == 0) {
          $mainScriptTabs.removeClass('border-right');
          $secondScriptTabs.removeClass('w-50').addClass('empty');
          $editor.removeClass('w-50').css('width', 'calc(100% - 20px)');
          $editor2.addClass('d-none');
          $tab.trigger('click');
        } else {
          //$editor.css('width', $mainScriptTabs.css('width'));
          //$editor2.css('width', 'calc(100% - ' + (parseFloat($editor.css('width')) + 20) + 'px').removeClass('d-none');
          $editor.addClass('w-50');
          $editor2.removeClass('d-none');
          if ($tab.data('content')) {
            editors[$tab.parents('.script-tabs').index()].getDoc().setValue($tab.data('content'));
            $tab.addClass('active').siblings().removeClass('active');
          } else {
            editor2.getDoc().setValue('');
          }
          if ($neighbor.data('content')) {
            editors[$neighbor.parents('.script-tabs').index()].getDoc().setValue($neighbor.data('content'));
          } else {
            editors[$origTabs.index()].getDoc().setValue('');
          }
        }
        if ($(evt.from).parents('div').hasClass('main-script-tabs')) {
          directoryTree.openTabs['main-script-tabs'].splice(evt.oldIndex - 1, 1);
        } else {
          directoryTree.openTabs['secondary-script-tabs'].splice(evt.oldIndex - 1, 1);
        }
        if ($(evt.to).parents('div').hasClass('main-script-tabs')) {
          directoryTree.openTabs['main-script-tabs'].splice(evt.newIndex - 1, 0, $tab.data('id'));
        } else {
          directoryTree.openTabs['secondary-script-tabs'].splice(evt.newIndex - 1, 0, $tab.data('id'));
        }
        $workspace.data('directoryTree', JSON.stringify(directoryTree));
        $('.editor').removeClass('active');
        $editors[$tab.parents('.script-tabs').index()].addClass('active').data('id', $tab.data('id'));
        if ($neighbor.data('id')) {
          $editors[$neighbor.parents('.script-tabs').index()].data('id', $neighbor.data('id'));
        } else {
          $editors[$origTabs.index()].data('id', '');
        }
      }
    });
  });

  $('.editor').on('click', function(evt) {
    let $this = $(this);
    $this.siblings().removeClass('active');
    $('.script-controls-row-one li').removeClass('active');
    $this.addClass('active');
    $('.scripts .script').removeClass('active');
    $('.scripts').find('.script:not(.cloner)').filter((idx, el) => {
      if ($(el).data('id') == $this.data('id')) {
        $(el).addClass('active');
      }
    });
    $('.script-controls-row-one').find('li:not(.cloner)').filter((idx, el) => {
      if ($(el).data('id') == $this.data('id')) {
        $(el).addClass('active');
      }
    });
  });

  toggleNewScriptPopover();

  /* CREATE NEW SCRIPT */
  $('#newScriptModal').on('click', '.btn-primary', function(evt) {
    let $saveBtn = $(this),
        $modal = $('#newScriptModal'),
        $scripts = $('.scripts'),
        $activeWorkspace = $('.workspaces .active'),
        workspaceId = $activeWorkspace.data('id'),
        parentPath = $saveBtn.data('parentPath') || [],
        parentPathNames = $saveBtn.data('parentPathNames') || [],
        directoryTree = JSON.parse($activeWorkspace.data('directoryTree')),
        $parentEl = $saveBtn.data('parentToReceiveChild') || $('.scripts').children('ul').first(),
        newScriptId = null,
        $scriptName = $('#new-script-name'),
        $form = $modal.find('form'),
        data = getFormData($form);

    if ($form[0].checkValidity() === false) {
      evt.preventDefault();
      evt.stopPropagation();
      $form.addClass('was-validated');
      return false;
    }

    // console.log(data);
    data.workspaceId = workspaceId;
    data.parentPathNames = parentPathNames.join('/');
    $saveBtn.data('parentPathNames', data.parentPathNames);
    // console.log(JSON.stringify(data));

    fetch('/scripts/', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': csrfToken
      }
    })
    .then(response => response.json())
    .then((script) => {

      if (script.success === false) {
        $scriptName.siblings('.invalid-feedback').text(script.message);
        $scriptName.addClass('is-invalid');

        $saveBtn.removeAttr('disabled').removeClass('disabled');
        $saveBtn.data('parentPathNames', $saveBtn.data('parentPathNames').split('/'));
        return false;
      }

      // console.log(script, parentPath, directoryTree);

      newScriptId = script.data.id;

      let rootId = null,
          nextId = null,
          element = directoryTree['scripts'],
          newFile = null;

      if (parentPath.length > 0) {
        rootId = parentPath.shift();
        element = element[rootId];

        while (parentPath.length > 0) {
          nextId = parentPath.shift();
          if (element.children[nextId]) {
            element = element.children[nextId];
          }
        }

        element.children[script.data.id] = {
          name: script.data.name,
          id: script.data.id,
          children: {},
          type: 'file'
        };
        newFile = element.children[script.data.id];
      } else {
        element[script.data.id] = {
          name: script.data.name,
          id: script.data.id,
          children: {},
          type: 'file'
        }
        newFile = element[script.data.id];
      }

      // console.log(directoryTree);

      fetch('/workspaces/', {
        method: 'PUT',
        body: JSON.stringify({
          id: $activeWorkspace.data('id'),
          directoryTree: directoryTree
        }),
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken
        }
      })
      .then(response => response.json())
      .then((workspace) => {
        newFile.parentPathNames = data.parentPathNames;

        $activeWorkspace.data('directoryTree', JSON.stringify(directoryTree));
        populateWorkspaceDirectoryTree(directoryTree);

        toggleNewScriptPopover();

        $modal.modal('hide');

        $modal.find('#new-script-name').val('');
        $form.removeClass('was-validated');

        showScripts();

        $('.scripts')
          .find('.script')
          .filter((idx, el) => $(el).data('id') == newScriptId)
          .trigger('click');
      });
    });
  });

  /* RESET NEW SCRIPT FORM ON MODAL HIDE */
  $('#newScriptModal').on('hide.bs.modal', function(evt) {
    $('#newScriptModal form').removeClass('was-validated');
    $('#new-script-name').removeClass('is-invalid');
    $('#new-script-name').siblings('.invalid-feedback').text('Please provide a valid name for the script.');
    $('#newScriptModal .btn-primary').data({ parentPath: null, parentPathNames: null, parentToReceiveChild: null });
    $('#newScriptModal form')[0].reset();
  });

  /* SHOW EDIT SCRIPT MODAL */
  $('.scripts').on('click', '.script .edit', function(evt) {
    let $this = $(this),
        $script = $this.parents('.script'),
        $folder = $script.parents('li').first(),
        $modal = $('#editScriptModal'),
        parentPath = [],
        $saveBtn = $modal.find('.btn-primary');

    evt.stopPropagation();

    if ($folder.data('id')) {
      parentPath.unshift($folder.data('id'));
    }
    let $parent = $folder.parents('li').first();
    do {
      if ($parent.data('id')) {
        parentPath.unshift($parent.data('id'));
      }
      $parent = $parent.parents('li').first();
    } while ($parent.length > 0);

    //link.parentElement.removeChild(link);
    $modal.find('#edit-script-name').val($script.find('.scriptname').text());
    $modal.modal('show');
    $saveBtn.data('elementToUpdate', $script);
    $saveBtn.data('parentPath', parentPath);
    // console.log($script.data('id'));
    $saveBtn.data('script', $script.data('id'));
    // console.log($modal.find('.btn-primary').data('script'));
  });

  /* EDIT SCRIPT */
  $('#editScriptModal').on('click', '.btn-primary', function(evt) {
    let $saveBtn = $(this),
        $modal = $('#editScriptModal'),
        $scriptName = $('#edit-script-name'),
        $script = $saveBtn.data('elementToUpdate'),
        $folder = $script.parents('li'),
        $activeWorkspace = $('.workspaces .active'),
        workspaceId = $activeWorkspace.data('id'),
        parentPath = [],
        parentPathNames = [],
        $scriptTabs = $('.script-controls-row-one').find('li:not(.cloner)'),
        directoryTree = JSON.parse($activeWorkspace.data('directoryTree')),
        $form = $modal.find('form'),
        scriptName = $scriptName.val(),
        data = getFormData($form);

    if ($form[0].checkValidity() === false) {
      evt.preventDefault();
      evt.stopPropagation();
      $form.addClass('was-validated');
      return false;
    }

    if ($folder.data('id')) {
      parentPath.unshift($folder.data('id'));
      parentPathNames.unshift($folder.data('name'));
    }
    let $parent = $folder.parents('li');
    do {
      if ($parent.data('id')) {
        parentPath.unshift($parent.data('id'));
        parentPathNames.unshift($parent.data('name'));
      }
      $parent = $parent.parents('li');
    } while ($parent.length > 0);

    data.id = $script.data('id');
    data.name = scriptName;
    data.prevName = $script.data('name');
    data.path = parentPathNames.join('/');
    data.workspaceId = workspaceId;
    // console.log('submitting PUT with: ', JSON.stringify(data));

    fetch('/scripts/', {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': csrfToken
      }
    })
    .then(response => response.json())
    .then((script) => {

      if (script.success === false) {
        $scriptName.siblings('.invalid-feedback').text(script.message);
        $scriptName.addClass('is-invalid');

        $saveBtn.removeAttr('disabled').removeClass('disabled');
        return false;
      }

      let rootId = null,
          nextId = null,
          element = directoryTree['scripts'];

      if (parentPath.length > 0) {
        rootId = parentPath.shift();
        element = element[rootId];

        while (parentPath.length > 0) {
          nextId = parentPath.shift();
          if (element.children[nextId]) {
            element = element.children[nextId];
          }
        }

        element.children[$script.data('id')] = {
          name: script.data.name,
          id: $script.data('id'),
          children: {},
          type: 'file'
        };
      } else {
        element[$script.data('id')] = {
          name: script.data.name,
          id: $script.data('id'),
          children: {},
          type: 'file'
        }
      }

      fetch('/workspaces/', {
        method: 'PUT',
        body: JSON.stringify({
          id: $activeWorkspace.data('id'),
          directoryTree: directoryTree
        }),
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken
        }
      })
      .then(response => response.json())
      .then((json) => {
        $modal.modal('hide');
        $script.data('name', script.data.name);
        $script.find('.scriptname').text(script.data.name);
        $scriptTabs.filter((idx, el) => {
          if ($(el).data('id') == $script.data('id')) {
            $(el).find('span').text(script.data.name);
          }
        });
        $modal.find('#edit-script-name').val('');
        $form.removeClass('was-validated');
      });
    });
  });

  /* RESET EDIT SCRIPT FORM ON MODAL HIDE */
  $('#editScriptModal').on('hide.bs.modal', function(evt) {
    $('#editScriptModal form').removeClass('was-validated');
    $('#edit-script-name').removeClass('is-invalid');
    $('#edit-script-name').siblings('.invalid-feedback').text('Please provide a valid name for the script.');
    $('#editScriptModal .btn-primary').data({ parentPath: null, parentPathNames: null, parentToReceiveChild: null });
    $('#editScriptModal form')[0].reset();
  });

  /* SHOW DELETE SCRIPT CONFIRMATION */
  $('.scripts').on('click', '.script .delete', function(evt) {
    let $this = $(this),
        $script = $this.parents('.script'),
        $folder = $this.parents('li').first(),
        $modal = $('#removeScriptModal'),
        $wrapper = $this.parents('.nav'),
        parentPath = [],
        parentPathNames = [],
        $deleteBtn = $modal.find('.btn-danger');

    evt.stopPropagation();

    if ($folder.data('id')) {
      parentPath.unshift($folder.data('id'));
      parentPathNames.unshift($folder.data('name'));
    }
    let $parent = $folder.parents('li');
    do {
      if ($parent.data('id')) {
        parentPath.unshift($parent.data('id'));
        parentPathNames.unshift($parent.data('name'));
      }
      $parent = $parent.parents('li');
    } while ($parent.length > 0);

    $modal.find('.script-name').text($script.find('.scriptname').text().trim());
    $modal.modal('show');
    // console.log($script.data('id'));
    $deleteBtn.data('script', $script.data('id'));
    $deleteBtn.data('parentPath', parentPath);
    $deleteBtn.data('parentPathNames', parentPathNames);
    $deleteBtn.data('elementToRemove', $folder);
    // console.log($modal.find('.btn-danger').data('script'));
  });

  /* DELETE SELECTED SCRIPT */
  $('#removeScriptModal').on('click', '.btn-danger', function(evt) {
    let $this = $(this),
        $modal = $('#removeScriptModal'),
        $activeWorkspace = $('.workspaces .active'),
        parentPath = $this.data('parentPath'),
        parentPathNames = $this.data('parentPathNames'),
        directoryTree = JSON.parse($activeWorkspace.data('directoryTree')),
        $elementToRemove = $this.data('elementToRemove'),
        $scriptPanelClose = $('.js-close'),
        $scriptTabs = $('.script-controls-row-one').find('li:not(.cloner)'),
        $targetScript = $elementToRemove.find('.script'),
        targetId = $targetScript.data('id');

    fetch('/scripts/', {
      method: 'DELETE',
      body: JSON.stringify({
        scriptId: targetId,
        path: parentPathNames.join('/')
      }),
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': csrfToken
      }
    })
    .then(response => response.json())
    .then((json) => {
      if ($targetScript.hasClass('active') && $scriptTabs.length == 0) {
        $scriptPanelClose.trigger('click');
      }

      let rootId = null,
          nextId = null,
          element = directoryTree['scripts'];

      if (parentPath.length > 0) {
        element = element[parentPath.shift()];

        while (parentPath.length > 0) {
          nextId = parentPath.shift();
          if (element.children[nextId]) {
            element = element.children[nextId];
          }
        }

        delete element.children[targetId];
      } else {
        delete element[targetId];
      }

      fetch('/workspaces/', {
        method: 'PUT',
        body: JSON.stringify({
          id: $activeWorkspace.data('id'),
          directoryTree: directoryTree
        }),
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken
        }
      })
      .then(response => response.json())
      .then((json) => {
        if ($targetScript.hasClass('active')) {
          $scriptPanelClose.trigger('click');
        }

        $activeWorkspace.data('directoryTree', JSON.stringify(directoryTree));
        $elementToRemove.remove();

        $scriptTabs.filter((idx, li) => {
          if ($(li).data('id') == targetId) {
            let $neighbor = $(li).next();
            if ($neighbor.length === 0) {
              $neighbor = $(li).prev();
            }
            $(li).find('.fa-close').trigger('click');
            $(li).remove();
            $neighbor.trigger('click');
          }
        });

        $modal.modal('hide');
      });
    });
  });

  if ($('.data-table').length > 0) {
    $('.data-table').DataTable();
  }

  /*==========================================================================*
   *  CONTEXT MENU LEFT NAV                                                   *
   *==========================================================================*/


  $('#datasets-wrapper, #scripts-wrapper').on('contextmenu', function(evt) {
    let $this = $(this),
        $target = $(evt.target),
        $folder = $target.parents('li').first(),
        parentPath = [],
        parentPathNames = [],
        $contextMenu = $('#scripts-context-menu'),
        $datasetModal = $('#newDatasetModal'),
        $scriptModal = $('#newScriptModal'),
        $folderModal = $('#newFolderModal');

    if ($this.attr('id') == 'datasets-wrapper') {
      $contextMenu = $('#datasets-context-menu');
    }

    evt.preventDefault();
    $('.context-menu').hide();

    if ($folder.data('id')) {
      parentPath.unshift($folder.data('id'));
      parentPathNames.unshift($folder.data('name'));
    }
    let $parent = $folder.parents('li');
    do {
      if ($parent.data('id')) {
        parentPath.unshift($parent.data('id'));
        parentPathNames.unshift($parent.data('name'));
      }
      $parent = $parent.parents('li');
    } while ($parent.length > 0);

    $datasetModal.find('.btn-primary').data('parentPath', parentPath);
    $scriptModal.find('.btn-primary').data('parentPath', parentPath);
    $scriptModal.find('.btn-primary').data('parentPathNames', parentPathNames);
    $folderModal.find('.btn-primary').data('parentPath', parentPath);

    if ($this.attr('id') == 'datasets-wrapper') {
      $folderModal.find('.btn-primary').data('folderType', 'datasets');
      if ($folder.length == 0) {
        $folder = $('.datasets').find('ul').first();
      }
    } else {
      $folderModal.find('.btn-primary').data('folderType', 'scripts');
      if ($folder.length == 0) {
        $folder = $('.scripts').find('ul').first();
      }
    }

    $datasetModal.find('.btn-primary').data('parentToReceiveChild', $folder);
    $scriptModal.find('.btn-primary').data('parentToReceiveChild', $folder);
    $folderModal.find('.btn-primary').data('parentToReceiveChild', $folder);

    // console.log('this: ', $this, 'folder: ', $folder, 'data: ', $folder.data(),
      // 'parentPath: ', parentPath, 'x: ' + evt.pageX + ', y: ' + evt.pageY);
    $contextMenu.css({
      'left': evt.pageX,
      'top': evt.pageY
    });
    $contextMenu.fadeIn(200);
  });

  $('#datasets-wrapper, #scripts-wrapper').on('click', function(evt) {
    let $this = $(this),
        $target = $(evt.target),
        $folder = $target.parents('li').first(),
        parentPath = [],
        parentPathNames = [],
        $contextMenu = $('#scripts-context-menu'),
        $datasetModal = $('#newDatasetModal'),
        $scriptModal = $('#newScriptModal'),
        $folderModal = $('#newFolderModal');

    if ($this.attr('id') == 'datasets-wrapper') {
      $contextMenu = $('#datasets-context-menu');
    }

    if ($target.hasClass('scriptname')) {
      $target = $target.parents('.script');

      if (!$target.data('parentPathNames')) {
        if ($folder.data('id')) {
          parentPath.unshift($folder.data('id'));
          parentPathNames.unshift($folder.data('name'));
        }
        let $parent = $folder.parents('li');
        do {
          if ($parent.data('id')) {
            parentPath.unshift($parent.data('id'));
            parentPathNames.unshift($parent.data('name'));
          }
          $parent = $parent.parents('li');
        } while ($parent.length > 0);

        $target.data('parentPathNames', parentPathNames.join('/'));
      }

      // console.log($target);
    }
  });

  $('#datasets-context-menu, #scripts-context-menu').on('click', 'li', function(evt) {
    let $this = $(this),
        $newDataset = $('#new-dataset'),
        $newScript = $('#new-script'),
        $newFolder = $('#new-folder'),
        $datasetModal = $('#newDatasetModal'),
        $scriptModal = $('#newScriptModal'),
        $folderModal = $('#newFolderModal');

    switch ($this.data('action')) {
      case 'create_dataset':
        $newDataset.trigger('click');
        break;
      case 'create_script':
        $newScript.trigger('click');
        break;
      case 'create_folder':
        $newFolder.trigger('click');
        break;
      default:
        break;
    }
    $('#datasets-context-menu').hide();
  });

  $(document).on('click', function(evt) {
    let $target = $(evt.target),
        $scriptsContextMenu = $('#scripts-context-menu'),
        $datasetsContextMenu = $('#datasets-context-menu');
    if (evt.button < 2) {
      if ($scriptsContextMenu.css('display') == 'block') {
        $scriptsContextMenu.hide();
      }
      if ($datasetsContextMenu.css('display') == 'block') {
        $datasetsContextMenu.hide();
      }
    } else {
      if (($target[0].id == 'scripts-wrapper' || $target.parents('#scripts-wrapper').length > 0) && $datasetsContextMenu.css('display') == 'block') {
        $datasetsContextMenu.hide();
      }
      if (($target[0].id == 'datasets-wrapper' || $target.parents('#datasets-wrapper').length > 0) && $scriptsContextMenu.css('display') == 'block') {
        $scriptsContextMenu.hide();
      }
    }
  });

  $('.sidebar-sticky').on('click', '.folder', function(evt) {
    let $this = $(this),
        $li = $this.parents('li').first(),
        $parent = $li.parents('li'),
        path = [$li.data('id')],
        $workspaces = $('.workspaces'),
        $activeWorkspace = $workspaces.find('.active'),
        directoryTree = JSON.parse($activeWorkspace.data('directoryTree')),
        node = directoryTree[$li.data('type')];

    if ($parent.length > 0) {
      path.unshift($parent.data('id'));
      $parent = $parent.parents('li');
    }

    while ($parent.length > 0) {
      path.unshift($parent.data('id'));
      $parent = $parent.parents('li');
    }

    while (path.length > 0) {
      let id = path.shift();
      if (node[id]) {
        node = node[id];
      } else if (node.children[id]) {
        node = node.children[id];
      }
    }

    if ($this.hasClass('open')) {
      $this.removeClass('open');
      node.open = false;
    } else {
      $this.addClass('open');
      node.open = true;
    }
    $activeWorkspace.data('directoryTree', JSON.stringify(directoryTree));
  });

  /*==========================================================================*
   *  FOLDER / FILE CONTROLS                                                  *
   *==========================================================================*/

  /* CREATE NEW FOLDER */
  $('#newFolderModal').on('click', '.btn-primary', function(evt) {
    let $modal = $('#newFolderModal'),
        $workspaces = $('.workspaces'),
        $activeWorkspace = $workspaces.find('.active'),
        $folderName = $modal.find('#new-folder-name'),
        $form = $modal.find('form'),
        $saveBtn = $modal.find('.btn-primary'),
        folderType = $saveBtn.data('folderType'),
        parentPath = $saveBtn.data('parentPath'),
        $parentEl = $saveBtn.data('parentToReceiveChild'),
        directoryTree = JSON.parse($activeWorkspace.data('directoryTree'));

    if ($form[0].checkValidity() === false) {
      evt.preventDefault();
      evt.stopPropagation();
      $form.addClass('was-validated');
      return false;
    }

    // console.log(JSON.stringify(getFormData($form)), parentPath, directoryTree);

    let rootId = null,
        nextId = null,
        element = directoryTree[folderType],
        newFolder = null,
        newUuid = generateUUIDv4();

    if (parentPath.length > 0) {
      rootId = parentPath.shift();
      element = element[rootId];

      if (!element.children) {
        element.children = {};
      }

      while (parentPath.length > 0) {
        nextId = parentPath.shift();
        if (element.children[nextId]) {
          element = element.children[nextId];
        }
      }

      element.children[newUuid] = {
        name: $folderName.val(),
        id: newUuid,
        children: {},
        type: 'folder'
      };
      newFolder = element.children[newUuid];
    } else {
      element[newUuid] = {
        name: $folderName.val(),
        id: newUuid,
        children: {},
        type: 'folder'
      }
      newFolder = element[newUuid];
    }

    // console.log(directoryTree);

    fetch('/workspaces/', {
      method: 'PUT',
      body: JSON.stringify({
        id: $activeWorkspace.data('id'),
        directoryTree: directoryTree
      }),
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': csrfToken
      }
    })
    .then(response => response.json())
    .then((workspace) => {
      $modal.modal('hide');

      $activeWorkspace.data('directoryTree', JSON.stringify(directoryTree));

      if ($parentEl[0].nodeName.toLowerCase() == 'ul') {
        $parentEl.append(addFolder(newFolder, folderType));
      } else {
        if ($parentEl.find('ul').first().length == 0) {
          $parentEl.append('<ul>');
        }
        $parentEl.find('ul').first().append(addFolder(newFolder, folderType));
      }

      let $folder = $parentEl.find('.folder').first();
      if (!$folder.hasClass('open')) {
        $folder.trigger('click');
      }

      $form.removeClass('was-validated');

      toggleNewScriptPopover();
    });
  });

  $('.datasets, .scripts').on('click', '.folder .edit', function(evt) {
    let $this = $(this),
        $folder = $this.parents('.folder'),
        $li = $folder.parents('li'),
        $modal = $('#editFolderModal'),
        $saveBtn = $modal.find('.btn-primary');

    evt.stopPropagation();

    //link.parentElement.removeChild(link);
    $modal.find('#edit-folder-name').val($folder.find('.foldername').text());
    $modal.modal('show');
    $saveBtn.data('folderId', $li.data('id'));
    $saveBtn.data('targetFolder', $folder);
    $saveBtn.data('folderType', $li.data('type'));
  });

  /* EDIT FOLDER */
  $('#editFolderModal').on('click', '.btn-primary', function(evt) {
    let $modal = $('#editFolderModal'),
        $workspaces = $('.workspaces'),
        $activeWorkspace = $workspaces.find('.active'),
        $folderName = $modal.find('#edit-folder-name'),
        $form = $modal.find('form'),
        $saveBtn = $modal.find('.btn-primary'),
        $targetFolder = $saveBtn.data('targetFolder'),
        parentPath = [],
        parentPathNames = [],
        folderType = $saveBtn.data('folderType'),
        folderId = $saveBtn.data('folderId'),
        directoryTree = JSON.parse($activeWorkspace.data('directoryTree'));

    if ($form[0].checkValidity() === false) {
      evt.preventDefault();
      evt.stopPropagation();
      $form.addClass('was-validated');
      return false;
    }

    if ($targetFolder.data('id')) {
      parentPath.unshift($targetFolder.data('id'));
      parentPathNames.unshift($targetFolder.data('name'));
    }
    let $parent = $targetFolder.parents('li');
    do {
      if ($parent.data('id')) {
        parentPath.unshift($parent.data('id'));
        parentPathNames.unshift($parent.data('name'));
      }
      $parent = $parent.parents('li');
    } while ($parent.length > 0);
    parentPath.pop();
    parentPathNames.pop();

    // console.log($folderName.val(), folderId, directoryTree);

    let changeFolderName = (root, id, name) => {
      for (var key in root) {
        let el = root[key];
        // console.log(el);
        if (el.id == id) {
          // console.log('changing ' + el.id);
          el.name = name;
          return false;
        }
        if (el.children) {
          // console.log('recursing to children of ' + el.id);
          changeFolderName(el.children, id, name);
        }
      }
    };

    changeFolderName(directoryTree[folderType], folderId, $folderName.val());

    // console.log(directoryTree);

    fetch('/workspaces/', {
      method: 'PUT',
      body: JSON.stringify({
        id: $activeWorkspace.data('id'),
        folderType: folderType,
        folderName: $folderName.val(),
        prevFolderName: $targetFolder.text(),
        path: parentPathNames.join('/'),
        directoryTree: directoryTree
      }),
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': csrfToken
      }
    })
    .then(response => response.json())
    .then((workspace) => {
      $modal.modal('hide');
      $activeWorkspace.data('directoryTree', JSON.stringify(directoryTree));
      $targetFolder.find('.foldername').text($folderName.val());
    });
  });

  /* RESET NEW WORKSPACE FORM ON MODAL HIDE */
  $('#newFolderModal').on('hide.bs.modal', function(evt) {
    $('#newFolderModal form').removeClass('was-validated');
    $('#newFolderModal form')[0].reset();
  });

  /* SHOW DELETE FOLDER CONFIRMATION */
  $('.scripts, .datasets').on('click', '.folder .delete', function(evt) {
    let $this = $(this),
        $folder = $this.parents('li').first(),
        $wrapper = $this.parents('.folder-root'),
        parentPath = [],
        parentPathNames = [],
        $modal = $('#removeFolderModal'),
        $deleteBtn = $modal.find('.btn-danger');

    evt.stopPropagation();

    if ($folder.data('id')) {
      parentPath.unshift($folder.data('id'));
      parentPathNames.unshift($folder.data('name'));
    }
    let $parent = $folder.parents('li');
    do {
      if ($parent.data('id')) {
        parentPath.unshift($parent.data('id'));
        parentPathNames.unshift($parent.data('name'));
      }
      $parent = $parent.parents('li');
    } while ($parent.length > 0);

    //link.parentElement.removeChild(link);
    $modal.find('.foldername').text($folder.find('.foldername').first().text().trim());
    $modal.modal('show');
    // console.log(parentPath);
    $deleteBtn.data('parentPath', parentPath);
    $deleteBtn.data('parentPathNames', parentPathNames);
    if ($wrapper.attr('id') == 'datasets') {
      $deleteBtn.data('folderType', 'datasets');
    } else {
      $deleteBtn.data('folderType', 'scripts');
    }
    $deleteBtn.data('elementToRemove', $folder);
    // console.log($deleteBtn.data('parentPath'));
  });

  /* DELETE SELECTED FOLDER */
  $('#removeFolderModal').on('click', '.btn-danger', function(evt) {
    let $this = $(this),
        $modal = $('#removeFolderModal'),
        $activeWorkspace = $('.workspaces .active'),
        $activeScript = $('.scripts').find('.active'),

        folderType = $this.data('folderType'),
        parentPath = $this.data('parentPath'),
        parentPathNames = $this.data('parentPathNames'),
        directoryTree = JSON.parse($activeWorkspace.data('directoryTree')),
        $elementToRemove = $this.data('elementToRemove'),
        $scriptPanelClose = $('.js-close'),

        targetId = parentPath.pop(),
        rootId = null,
        nextId = null,
        element = directoryTree[folderType],

        deleteUri = ((folderType == 'datasets') ? '/datasets/' : '/scripts/') + 'batch/',

        childrenToDelete = [],
        deleteChildren = (node) => {
          if (node.type == 'file') {
            // console.log(node);
            childrenToDelete.push(node.id);
          } else {
            // console.log(Object.entries(node.children));
            Object.entries(node.children).forEach((_node) => {
              deleteChildren(_node[1]);
            });
          }
        };

    if (parentPath.length > 0) {
      element = element[parentPath.shift()];

      while (parentPath.length > 0) {
        nextId = parentPath.shift();
        if (element.children[nextId]) {
          element = element.children[nextId];
        }
      }

      deleteChildren(element.children[targetId]);
      delete element.children[targetId];
    } else {
      deleteChildren(element[targetId]);
      delete element[targetId];
    }

    fetch(deleteUri, {
      method: 'DELETE',
      body: JSON.stringify({
        ids: childrenToDelete,
        workspaceId: $activeWorkspace.data('id'),
        path: parentPathNames.join('/')
      }),
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': csrfToken
      }
    })
    .then(response => response.json())
    .then((json) => {
      if (json.success) {
        fetch('/workspaces/', {
          method: 'PUT',
          body: JSON.stringify({
            id: $activeWorkspace.data('id'),
            directoryTree: directoryTree
          }),
          headers: {
            'Content-Type': 'application/json',
            'CSRF-Token': csrfToken
          }
        })
        .then(response => response.json())
        .then((json) => {
          if ($activeScript.hasClass('active')) {
            $scriptPanelClose.trigger('click');
          }
          // console.log(JSON.stringify(directoryTree));
          $activeWorkspace.data('directoryTree', JSON.stringify(directoryTree));
          $elementToRemove.remove();

          $modal.modal('hide');
        });
      }
    });
  });

  if ($('.data-table').length > 0) {
    $('.data-table').DataTable();
  }

  /*==========================================================================*
   *  SCRIPT PANEL CONTROLS                                                   *
   *==========================================================================*/

  let $scriptPanelControls = $('.script-panel-controls'),
      $scriptTabs = $('.script-tabs'),
      $scriptControls = $('.script-controls'),
      $runButton = $('.script-controls .run-script'),
      $outputsList = $('.outputs-list'),
      $wuLink = $('.wu-link');

  let changeRunButtonState = ($runButton, state) => {
    switch (state) {
      case 'ready':
        $runButton.removeClass('disabled badge-danger').addClass('badge-success')
          .find('.fa').removeClass('fa-refresh fa-spin').addClass('fa-play');
        $runButton.contents()[0].nodeValue = 'RUN';
        break;
      case 'failed':
        $runButton.removeClass('disabled badge-success').addClass('badge-danger')
          .find('.fa').removeClass('fa-refresh fa-spin').addClass('fa-close');
        $runButton.contents()[0].nodeValue = 'FAILED';
        break;
      default:
        $runButton.addClass('disabled')
          .find('.fa').removeClass('fa-play').addClass('fa-refresh fa-spin');
        $runButton.contents()[0].nodeValue = state.toUpperCase();
        break;
    }
  };

  let updateCodemirrorAnnotations = (errors, _editor) => {
    errors.forEach((err) => {
      // console.log(err);
      if (err.Message.indexOf('minor version number') > -1) return;
      let marker = document.createElement('div');
      let lineNum = (0 >= (err.LineNo - 1)) ? 0 : err.LineNo - 1;
      let markerClass = 'fa-exclamation-circle';
      switch (err.Severity.toLowerCase()) {
        case 'info':
          markerClass = 'fa-question-circle';
          marker.style.color = '#17a2b8';
          err.Message = 'INFO - ' + err.Message;
          break;
        case 'warning':
          markerClass = 'fa-exclamation-triangle';
          marker.style.color = '#ffc107';
          err.Message = 'WARNING - ' + err.Message;
          break;
        case 'error':
        default:
          markerClass = 'fa-exclamation-circle';
          marker.style.color = '#dc3545';
          err.Message = 'ERROR - ' + err.Message;
          break;
      }
      marker.innerHTML = '<i class="fa ' + markerClass + '" title="' + err.Message.replace(/\"/g, "'") + '"></i>';
      _editor.getDoc().setGutterMarker(lineNum, 'cm-errors', marker);
    });
  };

  $scriptControls.on('click', '.run-script', async function(evt) {
    let $script = $('.scripts .active'),
        editors = [ editor, editor2 ],
        activeEditor = editors[$('.editor.active').index()],
        _query = activeEditor.getValue(),
        _wuid = '',
        _filename = $script.data('name'),
        $activeWorkspace = $('.workspaces .active'),
        $selectCluster = $('#selectTarget'),
        $clusterPopoverTarget = $('.target-popover'),
        $cluster = $('.thors .active').data('name'),
        $main = $('.dataset-content').parents('main'),
        revisionId = 0,
        script = {
          id: $script.data('id'),
        };

    $(this).blur();
    evt.preventDefault();

    changeRunButtonState($runButton, 'running');

    let compilationResult = await compileScript($script, activeEditor);

    if (compilationResult.success == false) {
      changeRunButtonState($runButton, 'failed');
      updateCodemirrorAnnotations(compilationResult.errors, activeEditor);
      return false;
    }

    if (!$cluster) {
      $clusterPopoverTarget.trigger('focusin');
      let _t = window.setTimeout(() => {
        $clusterPopoverTarget.trigger('focusout');
        window.clearTimeout(_t);
      }, 2000);
      return false;
    }

    fetch('/scripts/revision/', {
      method: 'POST',
      body: JSON.stringify({
        scriptId: $script.data('id'),
        name: $script.data('name'),
        path: $script.data('parentPathNames'),
        content: activeEditor.getValue(),
        cluster: $cluster
      }),
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': csrfToken
      }
    })
    .then(response => response.json())
    .then((json) => {
      if (!json.success) {
        changeRunButtonState($runButton, 'failed');

        let _annotateTimeout = window.setTimeout(function() {
          updateCodemirrorAnnotations(json.errors, activeEditor);
          window.clearTimeout(_annotateTimeout);
        }, 500);

        return false;
      }

      $script.data('revisionId', json.data.id);
      $script.data('cluster', $cluster);

      createWorkunit()
      .then(response => response.json())
      .then((json) => {
        _wuid = json.wuid;
        saveWorkunit($script.data('revisionId'), _wuid);
        $script.data('wuid', _wuid);
        script.wuid = _wuid;
      })
      .then(() => {
        // console.log(_filename);
        updateWorkunit(_wuid, null, _filename, $script.data('parentPathNames'), null, $activeWorkspace.data('id')).then(() => {
          submitWorkunit(_wuid, $cluster).then(() => {
            // console.log('check status of workunit');

            let t = null;
            let awaitWorkunitStatusComplete = () => {
              checkWorkunitStatus(_wuid)
              .then(response => response.json())
              .then((json) => {

                activeEditor.getDoc().clearGutter('cm-errors');

                if (json.state == 'completed') {
                  // console.log(json);
                  window.clearTimeout(t);
                  changeRunButtonState($runButton, 'ready');
                  $main.addClass('show-outputs');
                  $outputsList.html('');
                  $outputsPanel.find('.scopename').addClass('d-none');
                  let $link = $wuLink.find('a')
                  $link.text(_wuid).attr({
                    href: $activeWorkspace.data('cluster') + '/?Wuid=' + _wuid + '&Widget=WUDetailsWidget',
                    target: '_blank'
                  }).addClass('text-light');
                  $wuLink.removeClass('d-none').append($link);
                  json.results.forEach((result, idx) => {
                    let classList = ['output', 'text-light', 'badge', 'ml-2'],
                        outputLabel = result.name;

                    if (idx == 0) classList.push('badge-primary');
                    else classList.push('badge-secondary');

                    if (isDataPatternProfile(result.schema)) {
                      if ($outputsList.find('.data-pattern').length > 0) return;
                      classList.push('data-pattern');
                      outputLabel = 'Data Patterns';
                    } else if (isVisualization(result.name)) {
                      if ($outputsList.find('.visualization').length > 0) return;
                      classList.push('visualization');
                      outputLabel = 'Visualizations';
                    } else if (isDashboard(result.name)) {
                      if ($outputsList.find('.dashboard').length > 0) return;
                      classList.push('dashboard');
                      outputLabel = 'Dashboard';
                    }

                    let $output = $('<a href="#" class="' + classList.join(' ') + '">' + outputLabel + '</a>');
                    $output.data('sequence', idx);
                    $output.data('resultname', result.name);
                    $outputsList.append($output);
                  });
                  $outputsList.removeClass('d-none');
                  $outputsList.children().eq(0).trigger('click');

                  let _annotateTimeout = window.setTimeout(function() {
                    updateCodemirrorAnnotations(json.errors, activeEditor);
                    window.clearTimeout(_annotateTimeout);
                  }, 500);
                } else if (json.state == 'failed') {
                  // console.log(json);
                  window.clearTimeout(t);
                  changeRunButtonState($runButton, 'failed');

                  let _annotateTimeout = window.setTimeout(function() {
                    updateCodemirrorAnnotations(json.errors, activeEditor);
                    window.clearTimeout(_annotateTimeout);
                  }, 500);
                } else {
                  let _status = json.state;
                  _status = (_status == 'unknown') ? 'running' : _status;
                  changeRunButtonState($runButton, _status);
                  t = window.setTimeout(function() {
                    awaitWorkunitStatusComplete();
                  }, 1500);
                }
              });
            };
            awaitWorkunitStatusComplete();
          });
        });
      });
    });
  });

  $('.thors').on('click', '.dropdown-item', function(evt) {
    let $this = $(this),
        $options = $('.thors .dropdown-item:not(.cloner)'),
        $selected = $('#selectTarget');

    $selected.text($this.text());
    $options.removeClass('active');
    $this.addClass('active');
  });

  $scriptControls.on('click', '.show-results', function(evt) {
    let $this = $(this),
        $activeWorkspace = $('.workspaces .active'),
        $script = $('.scripts .active'),
        $main = $('main'),
        _wuid = $script.data('wuid') ? $script.data('wuid') : '',
        editors = [ editor, editor2 ],
        activeEditor = editors[$('.editor.active').index()];

    $main.removeClass('show-outputs');
    $outputsPanel.find('.scopename').addClass('d-none');
    $outputsList.html('');

    if (_wuid !== '') {
      checkWorkunitStatus(_wuid)
        .then(response => response.json())
        .then((json) => {

          editor.getDoc().clearGutter('cm-errors');

          if (json.state == 'completed') {
            // console.log(json);
            changeRunButtonState($runButton, 'ready');
            $main.addClass('show-outputs');
            $outputsList.html('');
            let $link = $wuLink.find('a');
            $link.text(_wuid).attr({
              href: $activeWorkspace.data('cluster') + '/?Wuid=' + _wuid + '&Widget=WUDetailsWidget',
              target: '_blank',
            }).addClass('text-light');
            $wuLink.removeClass('d-none').append($link);
            json.results.forEach((result, idx) => {
              let classList = ['output', 'text-light', 'badge', 'ml-2'],
                  outputLabel = result.name;

              if (idx == 0) classList.push('badge-primary');
              else classList.push('badge-secondary');

              if (isDataPatternProfile(result.schema)) {
                if ($outputsList.find('.data-pattern').length > 0) return;
                classList.push('data-pattern');
                outputLabel = 'Data Patterns';
              } else if (isVisualization(result.name)) {
                if ($outputsList.find('.visualization').length > 0) return;
                classList.push('visualization');
                outputLabel = 'Visualizations';
              } else if (isDashboard(result.name)) {
                if ($outputsList.find('.dashboard').length > 0) return;
                classList.push('dashboard');
                outputLabel = 'Dashboard';
              }

              let $output = $('<a href="#" class="' + classList.join(' ') + '">' + outputLabel + '</a>');
              $output.data('sequence', idx);
              $output.data('resultname', result.name);
              $outputsList.removeClass('d-none');
              $outputsList.append($output);
            });
            $outputsList.children().eq(0).trigger('click');

            let _annotateTimeout = window.setTimeout(function() {
              updateCodemirrorAnnotations(json.errors, activeEditor);
              window.clearTimeout(_annotateTimeout);
            }, 500);
          } else if (json.state == 'failed') {
            changeRunButtonState($runButton, 'failed');

            let _annotateTimeout = window.setTimeout(function() {
              updateCodemirrorAnnotations(json.errors, activeEditor);
              window.clearTimeout(_annotateTimeout);
            }, 500);
          }
        });
    }
  });

  $scriptControls.on('click', '.save-script', function(evt) {
    let $script = $('.scripts .active'),
        $saveButton = $(this),
        $activeTab = $('.script-controls-row-one').find('li:not(.cloner)').filter((idx, el) => {
          return $(el).data('id') == $script.data('id');
        }),
        editors = [ editor, editor2 ],
        activeEditor = editors[$activeTab.parents('.script-tabs').index()],
        _query = activeEditor.getValue().replace(/\s+/g, ' '),
        _wuid = '',
        revisionId = 0,
        script = {
          id: $script.data('id'),
        };

    if ($saveButton.hasClass('badge-secondary')) {
      return false;
    }

    $saveButton.blur();
    evt.preventDefault();

    //$saveButton.contents()[0].nodeValue = 'SAVING';
    //$saveButton.removeClass('badge-info').addClass('badge-secondary');
    $script.data('content', activeEditor.getValue());

    fetch('/scripts/revision/', {
      method: 'POST',
      body: JSON.stringify({
        scriptId: $script.data('id'),
        path: $script.data('parentPathNames'),
        content: activeEditor.getValue()
      }),
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': csrfToken
      }
    })
    .then(response => response.json())
    .then((json) => {
      if (json.success) {
        $saveButton.contents()[0].nodeValue = 'SAVED';
        $script.data('revisionId', json.data.id);
        $script.data('content', json.data.content);
        $saveButton.attr('title', 'No Changes');
        activeEditor.getDoc().clearGutter('cm-errors');
      } else {
        let _annotateTimeout = window.setTimeout(function() {
          updateCodemirrorAnnotations(json.errors, activeEditor);
          window.clearTimeout(_annotateTimeout);
        }, 500);
      }
    });
  });

  let compileScript = async ($script, editor) => {
    let response = await fetch('/scripts/compile/', {
      method: 'POST',
      body: JSON.stringify({
        scriptId: $script.data('id'),
        path: $script.data('parentPathNames'),
        content: editor.getValue()
      }),
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': csrfToken
      }
    })
    let json = await response.json();
    return json;
  };

  $scriptControls.on('click', '.compile-script', async function(evt) {
    let $script = $('.scripts .active'),
        $button = $(this),
        $icon = $button.find('.fa'),
        $activeTab = $('.script-controls-row-one').find('li:not(.cloner)').filter((idx, el) => {
          return $(el).data('id') == $script.data('id');
        }),
        editors = [ editor, editor2 ],
        activeEditor = editors[$activeTab.parents('.script-tabs').index()],
        _query = editor.getValue().replace(/\s+/g, ' '),
        _wuid = '',
        revisionId = 0,
        script = {
          id: $script.data('id'),
        };

    evt.preventDefault();
    $script.data('content', editor.getValue());
    $button.removeClass('badge-danger badge-info').addClass('badge-secondary');
    $icon.removeClass('fa-question fa-close fa-check').addClass('fa-spin fa-spinner');

    let compilationResult = await compileScript($script, activeEditor);

    if (compilationResult.success) {
      $button.removeClass('badge-secondary').addClass('badge-info');
      $icon.removeClass('fa-spin fa-spinner').addClass('fa-check');
    } else {
      $button.removeClass('badge-secondary').addClass('badge-danger');
      $icon.removeClass('fa-spin fa-spinner').addClass('fa-close');
      updateCodemirrorAnnotations(compilationResult.errors, activeEditor);
    }
  });

  $scriptTabs.on('click', 'li', function(evt) {
    let $this = $(this);

    $('.scripts').find('.script:not(.cloner)').filter((idx, li) => {
      return $(li).data('id') == $this.data('id');
    }).trigger('click');

    if ($('.script-panel').hasClass('minimized')) {
      $('.js-restore').trigger('click');
    }
  });

  $scriptTabs.on('click', '.fa-close', function(evt) {
    let $this = $(this),
        $tab = $this.parents('li'),
        scriptId = $tab.data('id'),
        isActive = $tab.hasClass('active') ? true : false,
        $neighbor = $tab.next(':not(.cloner)'),
        $mainScriptTabs = $('.main-script-tabs'),
        $secondScriptTabs = $('.secondary-script-tabs'),
        $openTabs = null,
        $editor = $('#editor'),
        $editor2 = $('#editor2'),
        $editors = [ $editor, $editor2 ],
        editors = [ editor, editor2 ],
        $tabList = $this.parents('.tab-list'),
        $workspace = $('.workspaces .active'),
        directoryTree = JSON.parse($workspace.data('directoryTree')),
        $activeTabs = $tabList.parent(),
        $scriptPanelClose = $('.js-close');

    if ($neighbor.length === 0) {
      $neighbor = $tab.prev(':not(.cloner)');
    }
    $tab.remove();
    $openTabs = $('.script-controls-row-one').find('li:not(.cloner)');

    if ($tabList.find('li:not(.cloner)').length === 0) {
      $editors[$activeTabs.index()].removeClass('active');
      $editors[$activeTabs.index()].data('id', '');
      editors[$activeTabs.index()].getDoc().setValue('');
      if ($activeTabs.index() == 1) {
        $editor2.addClass('d-none');
        $editor.removeClass('w-50').css('width', 'calc(100% - 20px)');
        $mainScriptTabs.removeClass('w-50');
        $mainScriptTabs.removeClass('border-right');
        $secondScriptTabs.removeClass('w-50').addClass('empty');
      }
    }

    if ($openTabs.length === 0) {
      $scriptPanelClose.trigger('click');
      $editor2.addClass('d-none');
      $mainScriptTabs.removeClass('w-50');
      $mainScriptTabs.removeClass('border-right');
      $secondScriptTabs.removeClass('w-50').addClass('empty');
    } else {
      if ($neighbor.length > 0) {
        $editors[$activeTabs.index()].data('id', $neighbor.data('id'));
        editors[$activeTabs.index()].getDoc().setValue(
          $('.scripts .script').filter((idx, el) => {
            return $(el).data('id') == $neighbor.data('id');
          }).data('content') || ''
        );
      } else {
        $editors[$activeTabs.index()].data('id', '');
        editors[$activeTabs.index()].getDoc().setValue('');
      }
    }

    if (directoryTree.openTabs) {
      if (directoryTree.openTabs['main-script-tabs'].indexOf(scriptId) >= 0) {
        let index = directoryTree.openTabs['main-script-tabs'].indexOf(scriptId);
        directoryTree.openTabs['main-script-tabs'].splice(index, 1);
      } else if (directoryTree.openTabs['secondary-script-tabs'].indexOf(scriptId) >= 0) {
        let index = directoryTree.openTabs['secondary-script-tabs'].indexOf(scriptId);
        directoryTree.openTabs['secondary-script-tabs'].splice(index, 1);
      }
      $workspace.data('directoryTree', JSON.stringify(directoryTree));
    }

    fetch('/workspaces/', {
      method: 'PUT',
      body: JSON.stringify({
        id: $workspace.data('id'),
        directoryTree: directoryTree
      }),
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': csrfToken
      }
    })
  });

  $outputsList.on('click', '.output', function(evt) {
    let $output = $(this),
        $script = $('.scripts .active'),
        $datasetContent = $('.dataset-content'),
        $dashboardWrapper = $('.dashboard-wrapper'),
        $tableWrapper = $datasetContent.find('.table-wrapper');

    $output.addClass('badge-primary').removeClass('badge-secondary')
      .siblings().addClass('badge-secondary').removeClass('badge-primary');

    if ($output.hasClass('data-pattern')) {
      let dataPatternsReportUrl = ((cluster.host.indexOf('http') < 0) ? 'http://' : '') +
        cluster.host + ':' + cluster.port + '/WsWorkunits/res/' + $script.data('wuid') +
        '/report/res/index.html';
      fetch(dataPatternsReportUrl).then(response => response.text()).then(body => {
        if (body.indexOf('Cannot open resource') > -1) {
          displayWorkunitResults({
            wuid: $script.data('wuid'),
            name: $script.find('.scriptname').text(),
            sequence: $output.data('sequence'),
            hideScope: true
          });
        } else {
          $tableWrapper.html('<iframe src="' + dataPatternsReportUrl + '" />');
          $tableWrapper.css({ height: '770px' });
        }
      });
      $dashboardWrapper.addClass('d-none');
      $('body').css({ overflow: 'hidden' });
    } else if ($output.hasClass('visualization')) {
      let visualizationUrl = ((cluster.host.indexOf('http') < 0) ? 'http://' : '') +
        cluster.host + ':' + cluster.port + '/WsWorkunits/res/' + $script.data('wuid') +
        '/res/index.html';
      $tableWrapper.html('<iframe src="' + visualizationUrl + '" />');
      $tableWrapper.css({ height: '770px' });

      $datasetContent.removeClass('d-none');
      $dashboardWrapper.addClass('d-none');
      $('body').css({ overflow: 'inherit' });
    } else if ($output.hasClass('dashboard')) {
      getWorkunitResults({ wuid: $script.data('wuid'), resultname: $output.data('resultname') })
        .then(response => response.json())
        .then(async wuResult => {
          if (!wuResult.WUResultResponse) {
            throw 'No Workunit Response available for ' + wuid;
          }

          let results = wuResult.WUResultResponse.Result[$output.data('resultname')].Row,
              $datasetContent = $('.dataset-content');

          $dashboardWrapper.html('');
          $datasetContent.addClass('d-none');
          $dashboardWrapper.removeClass('d-none');

          for (var result of results) {
            console.log(result);
            let plot = null,
                resp = await getWorkunitResults({ wuid: $script.data('wuid'), resultname: result.data_source }),
                _result = await resp.json(),
                div = $('<div id="viz_' + result.data_source + '_' + result.chart_type.toLowerCase() + '"></div>');

            _result = _result.WUResultResponse.Result[result.data_source].Row;
            console.log(_result, JSON.parse(result.options));

            $dashboardWrapper.append(div);
            let chartOpts = { ...{
              padding: 'auto',
              title: {
                  visible: true,
                  text: result.title,
              },
              renderer: 'svg',
              forceFit: true,
              data: _result,
              yAxis: {title: {offset: 40}},
              xAxis: {title: {offset: 40}}
            }, ...JSON.parse(result.options) };
            console.log(chartOpts);
            switch (result.chart_type.toLowerCase()) {
              case 'column':
                plot = new g2plot.Column(div[0], chartOpts);
                break;
              case 'groupedcolumn':
                plot = new g2plot.GroupedColumn(div[0], chartOpts);
                break;
              case 'stackedcolumn':
                plot = new g2plot.StackedColumn(div[0], chartOpts);
                break;
              case 'rangecolumn':
                plot = new g2plot.RangeColumn(div[0], chartOpts);
                break;
              case 'line':
                plot = new g2plot.Line(div[0], chartOpts);
                break;
              case 'stepline':
                plot = new g2plot.StepLine(div[0], chartOpts);
                break;
              case 'area':
                plot = new g2plot.Area(div[0], chartOpts);
                break;
              case 'stackedarea':
                plot = new g2plot.StackArea(div[0], chartOpts);
                break;
              case 'bar':
                plot = new g2plot.Bar(div[0], chartOpts);
                break;
              case 'stackedbar':
                plot = new g2plot.StackBar(div[0], chartOpts);
                break;
              case 'groupedbar':
                plot = new g2plot.GroupBar(div[0], chartOpts);
                break;
              case 'rangebar':
                plot = new g2plot.RangeBar(div[0], chartOpts);
                break;
              case 'pie':
                plot = new g2plot.Pie(div[0], chartOpts);
                break;
              case 'donut':
                plot = new g2plot.Ring(div[0], chartOpts);
                break;
              case 'rose':
                plot = new g2plot.Rose(div[0], chartOpts);
                break;
              case 'radar':
                plot = new g2plot.Radar(div[0], chartOpts);
                break;
              case 'scatter':
                plot = new g2plot.Scatter(div[0], chartOpts);
                break;
              default:
                break;
            }
            if (plot) {
              plot.render();
            }
          }
        });
        $('body').css({ overflow: 'inherit' });
    } else {
      displayWorkunitResults({
        wuid: $script.data('wuid'),
        name: $script.find('.scriptname').text(),
        sequence: $output.data('sequence'),
        hideScope: true
      });
      $tableWrapper.css({ height: '' });
      $dashboardWrapper.addClass('d-none');
      $('body').css({ overflow: 'hidden' });
    }
  });

  $scriptPanelControls.on('click', '.js-close', function() {
    $('.script-panel-placeholder').addClass('d-none');
    $('.script-panel').addClass('d-none');
    $('.script-panel-controls .js-restore').removeClass('fa-window-restore').addClass('fa-window-maximize');
    $('.script-panel').removeClass('maximized').removeClass('minimized');
    $('.script-panel-placeholder').removeClass('minimized');
    $('#editor').removeClass('cmReady');
    $('.save-script').removeClass('badge-info').addClass('badge-secondary');
  });

  $scriptPanelControls.on('click', '.js-minimize', function() {
    if ($('.script-panel').hasClass('minimized') || $('.script-panel').hasClass('maximized')) return;

    $('.script-panel').addClass('minimized');
    $('.script-panel-placeholder').addClass('minimized');
    if ($('.js-restore').hasClass('fa-window-maximize')) {
      $('.script-panel-controls .js-restore').removeClass('fa-window-maximize').addClass('fa-window-restore');
    } else {
      $('.script-panel-controls .js-restore').removeClass('fa-window-restore').addClass('fa-window-maximize');
    }
  });

  $scriptPanelControls.on('click', '.js-restore', function() {
    if ($('.script-panel').hasClass('minimized')) {
      $('.script-panel').removeClass('minimized');
      $('.script-panel-placeholder').removeClass('minimized');
      $('.script-panel-controls .js-restore').removeClass('fa-window-restore').addClass('fa-window-maximize');
    } else if ($('.script-panel').hasClass('maximized')) {
      $('.script-panel').removeClass('maximized');
      $('.script-panel-controls .js-restore').removeClass('fa-window-restore').addClass('fa-window-maximize');
    } else {
      $('.script-panel').addClass('maximized');
      $('.script-panel-controls .js-restore').removeClass('fa-window-maximize').addClass('fa-window-restore');
      editor.layout();
      editor2.layout();
    }
  });

  /*==========================================================================*
   *  EDITOR EVENT HANDLERS                                                   *
   *==========================================================================*/

  let editorChangeHandler = (instance, changeObj) => {
    let $saveButton = $('.save-script'),
        $compileButton = $('.compile-script');

    if ($('#editor').hasClass('cmReady')) {
      $saveButton.attr('title', 'Save Script').removeClass('badge-secondary').addClass('badge-info');
      $compileButton.removeClass('badge-secondary badge-danger').addClass('badge-info')
        .find('.fa').removeClass('fa-close fa-check').addClass('fa-question');
      if (['+input', '+delete', 'cut', 'paste', 'drop', 'undo'].indexOf(changeObj.origin) > -1) {
        // console.log('autosave script...');
        $saveButton.trigger('click');
      }
    }

    if (changeObj.origin == 'setValue') {
      $saveButton.contents()[0].nodeValue = 'SAVE';
    }

    // console.log(instance, changeObj);
    changeRunButtonState($('.run-script'), 'ready');
  };

  if (editor) {
    editor.on('change', _.debounce((instance, changeObj) => { editorChangeHandler(instance, changeObj) }, 500));
    editor2.on('change', _.debounce((instance, changeObj) => { editorChangeHandler(instance, changeObj) }, 500));

    editor.on('focus', (instance, evt) => {
      if (false == $('#editor').hasClass('cmReady')) {
        $('#editor').addClass('cmReady');
      }
    });

    editor.on('drop', (instance, evt) => {
      // console.log(instance, evt);
      let doc = instance.getDoc();
      let content = '';

      if ($draggedObject) {
        if ($draggedObject.data('query')) content = $draggedObject.data('query');
        else if ($draggedObject.data('content')) content = $draggedObject.data('content');
        doc.replaceRange(content, doc.getCursor(), null, 'drop');
        $draggedObject = null;
        evt.preventDefault();
      }
    });
  }

  $(document).on('dragstart', (evt) => {
    let $target = $(evt.target);
    // console.log($target);
    if ($target.hasClass('dataset') || $target.hasClass('script')) {
      $draggedObject = $(evt.target);
      // console.log($draggedObject.data());
    }
  });

  $(document).on('keydown', function(evt) {
    //console.log(evt.keyCode);
    let $target = $(evt.target);
    if (evt.ctrlKey) {
      switch (evt.keyCode) {
        case 80: // P
          evt.preventDefault();
          $('.ctrl-p').toggleClass('d-none').find('input').focus();
          break;
        case 118: // F7
        case 83: // S
          if (!$('.script-panel').hasClass('d-none') && $('.CodeMirror').hasClass('CodeMirror-focused')) {
            window.onhelp = function() { return false; }
            evt.preventDefault();
            $('.compile-script').trigger('click');
          }
          break;
        case 13: // Enter
          if (!$('.script-panel').hasClass('d-none') && $('.CodeMirror').hasClass('CodeMirror-focused')) {
            evt.preventDefault();
            $('.run-script').trigger('click');
          }
          break;
        case 192: // ~
          let $scriptPanel = $('.script-panel');
          if (!$scriptPanel.hasClass('d-none')) {
            if (!$scriptPanel.hasClass('minimized')) {
              $scriptPanel.find('.js-minimize').trigger('click');
            } else {
              $scriptPanel.find('.js-restore').trigger('click');
            }
          }
          break;
      }
    } else {
      switch (evt.keyCode) {
        case 13: // Enter
          evt.preventDefault();
          if ($target.hasClass('form-control')) {
            let $btn = $target.parents('.modal-content').find('.btn-primary');
            if (!$btn || $btn.length < 1) {
              $btn = $target.parents('form').find('.btn-primary');
            }
            $btn.trigger('click');
          }
          break;
        case 27:
          if (!$('.ctrl-p').hasClass('d-none')) {
            $('.ctrl-p').find('input').val('');
            $('.ctrl-p').addClass('d-none');
          }
          break;
      }
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/service-worker.js', { scope: '/' })
      .then(function() { console.log('Service Worker Registered'); });
  }

});