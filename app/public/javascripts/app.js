'use strict';

import {
  hostname, NO_WORKSPACE, NEW_SCRIPT, NEW_DATASET, FILE_LIMIT,
  DEFAULT_FILE_FEEDBACK, currentDatasetFile, cluster,
  setClusterHost, setClusterPort,
} from './modules/consts.mjs';

import { tour } from './modules/featureTour.mjs';

import {
  renderTree, addScript, addDataset, addFolder, populateWorkspaces,
  populateWorkspaceDirectoryTree, populateDatasets, showDatasets,
  populateScripts, showScripts,
} from './modules/directoryTree.mjs';


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

let getDropzones = () => {

};

let getFormData = ($form) => {
  let arr = $form.serializeArray(),
      result = {};

  $.map(arr, (el, idx) => { result[el['name']] = el['value'] });

  return result;
};

let createWorkunit = () => {
  return fetch('/hpcc/workunits', {
    method: 'POST',
    body: JSON.stringify({
      clusterAddr: cluster.host,
      clusterPort: cluster.port
    }),
    headers: {
      'Content-Type': 'application/json'
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
      'Content-Type': 'application/json'
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
      'Content-Type': 'application/json'
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
    body: formData
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
    body: formData
  });
};

let getDfuWorkunit = (wuid) => {
  let formData = new FormData();
  formData.append('wuid', wuid);
  formData.append('clusterAddr', cluster.host);
  formData.append('clusterPort', cluster.port);

  return fetch('/hpcc/filespray/getDfuWorkunit', {
    method: 'POST',
    body: formData
  });
};

let saveWorkunit = (objectId, workunitId) => {
  return fetch('/workunits/', {
    method: 'POST',
    body: JSON.stringify({
      objectId: objectId,
      workunitId: workunitId
    }),
    headers:{
      'Content-Type': 'application/json'
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
      'Content-Type': 'application/json'
    }
  });
};

let displayWorkunitResults = (wuid, title, sequence = 0, hideScope = false) => {
  let $datasetContent = $('.dataset-content'),
      $title = $datasetContent.find('h4'),
      $scopeDefn = $title.find('.scopename'),
      query = $('.datasets .active').data('query'),
      scopeRegex = /\~([-a-zA-Z0-9_]+::)+[-a-zA-Z0-9_]+\.csv_thor/,
      $loader = $datasetContent.siblings('.loader'),
      $tableWrapper = $datasetContent.find('.table-wrapper'),
      $table = null;

  $title.contents()[0].nodeValue = title;

  $datasetContent.addClass('d-none');
  $scopeDefn.addClass('d-none');
  $loader.removeClass('d-none');

  checkWorkunitStatus(wuid).then(() => {

    getWorkunitResults(wuid, 1000, sequence)
    .then(response => response.json())
    .then((wuResult) => {
      if (!wuResult.WUResultResponse) {
        throw 'No Workunit Response available for ' + wuid;
      }
      let results = wuResult.WUResultResponse.Result.Row;
      if (results.length < 1) {
        throw 'No results for Workunit ' + wuid;
      }
      console.log(wuResult);
      $tableWrapper.html(
        '<table class="table data-table" style="width: 100%;">' +
        '<thead><tr></tr></thead><tbody></tbody>' +
        '<tfoot><tr></tr></tfoot></table>'
      );
      $table = $tableWrapper.find('.data-table');
      Object.keys(results[0]).forEach((key) => {
        $table.find('thead tr').append('<th scope="col">' + key + '</th>');
        $table.find('tfoot tr').append('<th scope="col">' + key + '</th>');
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

      if (dataTable !== null) {
        dataTable.destroy();
      }
      dataTable = $table.DataTable({
        order: [],
        pageLength: 25
      });
      $loader.addClass('d-none');
      $datasetContent.removeClass('d-none');
      if (query && query.match(scopeRegex) !== null && !hideScope) {
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

require.config({
  paths: {
    'ln': '/javascripts/line-navigator',
    '_': '/javascripts/lodash',
  },
  packages: [{
    name: 'codemirror',
    location: '/javascripts/codemirror/',
    main: 'lib/codemirror'
  }]
});

require([
  'ln/line-navigator.min', 'codemirror', '_/lodash.min',
  'codemirror/mode/ecl/ecl',
  'codemirror/addon/selection/active-line',
  'codemirror/addon/scroll/simplescrollbars'
], function(LineNavigator, CodeMirror, _) {
  let editor = null,
      $draggedObject = null,
      $scriptPanel = $('.script-panel'),
      $main = $('[role="main"]'),
      $sidebar = $('.sidebar'),
      $outputsPanel = $('.outputs-panel');

  $scriptPanel.resizable({ handles: 'n' });
  $main.css('margin-left', $sidebar.css('width'));
  $outputsPanel.css('left', $sidebar.css('width'));
  $outputsPanel.css('width', 'calc(100% - ' + $sidebar.css('width') + ')');
  $scriptPanel.css('width', 'calc(100% - ' + $sidebar.css('width') + ')');

  $sidebar.resizable({
    handles: 'e',
    resize: function(evt, ui) {
      $main.css('margin-left', $sidebar.css('width'));
      $outputsPanel.css('left', $sidebar.css('width'));
      $outputsPanel.css('width', 'calc(100% - ' + $sidebar.css('width') + ')');
      $scriptPanel.css('width', 'calc(100% - ' + $sidebar.css('width') + ')');
    }
  });

  $('#tour-link').on('click', function() {
    tour.start();
  });

  if ($('#editor').length > 0) {
    editor = CodeMirror($('#editor')[0], {
      mode: "ecl",
      lineNumbers: true,
      extraKeys: {"Ctrl-Space": "autocomplete"},
      // keyMap: "sublime",
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

  let autocomplete = null, $workspaceMembersUserSearch = $('#search-for-users');

  if ($workspaceMembersUserSearch.length > 0) {
    let $workspace = $('.workspaces .active'),
        $modal = $('#shareWorkspaceModal'),
        $userListTable = $modal.find('.user-list tbody');

    autocomplete = new autoComplete({
      selector: '#search-for-users',
      minChars: 3,
      delay: 300,
      source: function(term, suggest) {
        let url = new URL(hostname + '/users/search'),
            params = { username: term },
            choices = [],
            suggestions = [];

        term = term.toLowerCase();
        url.search = new URLSearchParams(params);

        fetch(url)
          .then(response => response.json())
          .then((users) => {
            users.forEach((user) => {
              choices.push([ user.username, user.id ]);
            });
          })
          .then(() => {
            for (var i = 0; i < choices.length; i++) {
              if (~choices[i][0].toLowerCase().indexOf(term)) suggestions.push(choices[i]);
            }
            suggest(suggestions);
          });
      },
      renderItem: function(item, search) {
        search = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&amp;');
        var re = new RegExp("(" + search.split(' ').join('|') + ")", "gi");
        return '<div class="autocomplete-suggestion" data-name="' + item[0] +
          '" data-id="' + item[1] + '" data-val="' + search + '">' +
          item[0].replace(re, "<b>$1</b>") + '</div>';
      },
      onSelect: function(e, term, item) {
        let $newUserPermissionSet = $userListTable.find('.cloner').clone(),
            $item = $(item),
            $userName = $item.data('name'),
            $userId = $item.data('id');

        $newUserPermissionSet.removeClass('d-none cloner').find('.username').text($userName);
        $newUserPermissionSet.data('id', $userId);
        $newUserPermissionSet.data('name', $userName);
        $userListTable.append($newUserPermissionSet);

        $workspaceMembersUserSearch.val('');
      }
    });
  }

  if ($('.workspaces').length > 0 &&
      ($('.datasets').length > 0 && $('.scripts').length > 0)) {
    populateWorkspaces();
  }

  $('.js-collapser').on('click', function(evt) {
    let $this = $(this),
        $chevron = $this.find('.fa');

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
        $deleteWorkspace = $('.delete-workspace').parent(),
        $form = $modal.find('form');

    if ($form[0].checkValidity() === false) {
      evt.preventDefault();
      evt.stopPropagation();
      $form.addClass('was-validated');
      return false;
    }

    fetch('/workspaces/', {
      method: 'POST',
      body: JSON.stringify(getFormData($form)),
      headers:{
        'Content-Type': 'application/json'
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
  });

  /* RESET NEW WORKSPACE FORM ON MODAL HIDE */
  $('#newWorkspaceModal').on('hide.bs.modal', function(evt) {
    $('#newWorkspaceModal form').removeClass('was-validated');
    $('#newWorkspaceModal form')[0].reset();
  });

  /* CHANGE SELECTED WORKSPACE */
  $('.workspaces').on('click', '.dropdown-item', function(evt) {
    let $this = $(this),
        $options = $('.workspaces .dropdown-item'),
        $selected = $('#workspaceSelect'),
        $scriptPanelClose = $('.js-close'),
        $deleteWorkspace = $('.delete-workspace').parent(),
        $datasetContent = $('.dataset-content'),
        $main = $datasetContent.parents('main'),
        $tableWrapper = $datasetContent.find('.table-wrapper');

    evt.preventDefault();

    $datasetContent.addClass('d-none');
    $tableWrapper.html('');

    $options.removeClass('active');
    $this.addClass('active');
    $main.removeClass('show-outputs');
    $selected.text($this.text());
    $deleteWorkspace.removeClass('d-none');
    $selected.append(
      '<i class="fa fa-pencil-square-o edit float-right d-none" title="Edit Workspace..."></i>' +
      '<i class="fa fa-share-alt share float-right d-none" title="Share Workspace..."></i>'
    );

    $scriptPanelClose.trigger('click');

    populateWorkspaceDirectoryTree(JSON.parse($this.data('directoryTree')));
    populateDatasets();
    populateScripts();

    if ($this.data('cluster').lastIndexOf(':') > 4) {
      cluster.host = $this.data('cluster').substring(0, $this.data('cluster').lastIndexOf(':'));
      cluster.port = $this.data('cluster').substring($this.data('cluster').lastIndexOf(':') + 1);
    } else {
      cluster.host = $this.data('cluster');
      cluster.port = null;
    }

    toggleNewScriptPopover();
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

  /* DELETE A WORKSPACE MEMBER */
  $('#shareWorkspaceModal').on('click', '.btn-danger', function(evt) {
    let $this = $(this),
        $user = $this.parents('tr'),
        $modal = $('#shareWorkspaceModal');

    evt.stopPropagation();

    //link.parentElement.removeChild(link);
    $user.remove();
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

  /* SHARE WORKSPACE WITH MEMBERS */
  $('#shareWorkspaceModal').on('click', '.btn-primary', function(evt) {
    let $this = $(this),
        $workspace = $('.workspaces .active'),
        $modal = $('#shareWorkspaceModal'),
        $users = $modal.find('.user-list').find('tr:not(.header):not(.cloner)'),
        users = [];

    $users.each((idx, user) => {
      users.push({ id: $(user).data('id'), name: $(user).data('name') });
    });

    fetch('/workspaces/share', {
      method: 'POST',
      body: JSON.stringify({
        workspaceId: $workspace.data('id'),
        users: users
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then((json) => {
      if (json.success) {
        $modal.modal('hide');
      }
    });
  });

  /* RESET EDIT WORKSPACE FORM ON MODAL HIDE */
  $('#shareWorkspaceModal').on('hide.bs.modal', function(evt) {
    let $modal = $('#shareWorkspaceModal'),
        $userListTable = $modal.find('.user-list tbody'),
        $form = $modal.find('form');

    $userListTable.find('tr:not(.cloner)').remove();
    $form.removeClass('was-validated');
    $form[0].reset();
  });

  /* SHOW EDIT WORKSPACE MODAL */
  $('#workspaceSelect').on('click', '.edit', function(evt) {
    let $this = $(this),
        $workspace = $('.workspaces .active'),
        $modal = $('#editWorkspaceModal');

    evt.stopPropagation();

    //link.parentElement.removeChild(link);
    $modal.find('#edit-workspace-name').val($workspace.data('name'));
    $modal.find('#edit-workspace-cluster').val($workspace.data('cluster'));
    $modal.modal('show');
  });

  /* EDIT WORKSPACE */
  $('#editWorkspaceModal').on('click', '.btn-primary', function(evt) {
    let $modal = $('#editWorkspaceModal'),
        $selected = $('#workspaceSelect'),
        $workspace = $('.workspaces .active'),
        $workspaceId = $workspace.data('id'),
        $form = $modal.find('form'),
        data = getFormData($form);

    if ($form[0].checkValidity() === false) {
      evt.preventDefault();
      evt.stopPropagation();
      $form.addClass('was-validated');
      return false;
    }

    data.id = $workspace.data('id');
    console.log('submitting PUT with: ', JSON.stringify(data));

    fetch('/workspaces/', {
      method: 'PUT',
      body: JSON.stringify(data),
      headers:{
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then((workspace) => {
      $modal.modal('hide');
      $workspace.data('name', workspace.data.name);
      $selected.text($workspace.data('name'));
      $selected.append(
        '<i class="fa fa-pencil-square-o edit float-right d-none" title="Edit Workspace..."></i>' +
        '<i class="fa fa-share-alt share float-right d-none" title="Share Workspace..."></i>'
      );
      $modal.find('#edit-workspace-name').val('');
      $form.removeClass('was-validated');
    });
  });

  /* RESET EDIT WORKSPACE FORM ON MODAL HIDE */
  $('#editWorkspaceModal').on('hide.bs.modal', function(evt) {
    $('#editWorkspaceModal form').removeClass('was-validated');
    $('#editWorkspaceModal form')[0].reset();
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
        $datasets = $('.datasets .dataset:not(.cloner)'),
        $datasetsUl = $('.datasets ul').first(),
        $deleteWorkspace = $('.delete-workspace').parent(),
        $scriptPanelClose = $('.js-close'),
        $workspaceSelect = $('#workspaceSelect');

    fetch('/workspaces/', {
      method: 'DELETE',
      body: JSON.stringify({ workspaceId: $selectedWorkspace.data('id') }),
      headers:{
        'Content-Type': 'application/json'
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
    });
  });

  /*==========================================================================*
   *  DATASETS                                                                *
   *==========================================================================*/

  $('#newDatasetModal label[for="dataset-file"]').text('File (limit ' + (FILE_LIMIT / (1024 * 1024)) + 'MB):');

  /* CREATE NEW DATASET */
  $('#newDatasetModal').on('click', '.btn-primary', function(evt) {
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
        $form = $modal.find('form'),
        $file = $('#dataset-file'),
        $fileDetails = $('.file-details'),
        $fileFeedback = $file.siblings('.invalid-feedback'),
        file = $('#dataset-file')[0].files[0],
        $datasetName = $('#dataset-name').val(),
        data = getFormData($form),
        dataset = {
          name: $datasetName,
          workspaceId: $workspaceId,
          workspaceName: $workspaceName
        };

    if (!$parentEl) $parentEl = $('.datasets ul').first();

    $saveBtnStatus.removeClass('d-none');
    $saveBtn.attr('disabled', 'disabled').addClass('disabled');

    if (file === undefined) {
      $file.siblings('.invalid-feedback').text(DEFAULT_FILE_FEEDBACK);
      $file.addClass('is-invalid');

      $saveBtnStatus.addClass('d-none');
      $saveBtn.removeAttr('disabled').removeClass('disabled');

      return false;
    } else {
      dataset.filename = file.name
    }

    if ($form[0].checkValidity() === false) {
      evt.preventDefault();
      evt.stopPropagation();
      $form.addClass('was-validated');

      $saveBtnStatus.addClass('d-none');
      $saveBtn.removeAttr('disabled').removeClass('disabled');

      return false;
    }
    fetch('/datasets/', {
      method: 'POST',
      body: JSON.stringify(dataset),
      headers:{
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then((json) => {
      console.log('in .then() of POST dataset', json);
      if (json.success === false) {
        $file.siblings('.invalid-feedback').text(json.message);
        $file.addClass('is-invalid');

        $saveBtnStatus.addClass('d-none');
        $saveBtn.removeAttr('disabled').removeClass('disabled');
      } else {
        dataset.id = json.data.id;
        sendFileToLandingZone(file)
        .then(response => response.json(), (err) => { console.log(err) })
        .then(json => {
          console.log(json);
          dataset.file = json.file;
          sprayFile(json.file, $workspaceName)
          .then(response => response.json(), (err) => { console.log(err) })
          .then((json) => {
            console.log('sprayed file', json.wuid);
            saveWorkunit(dataset.id, json.wuid);
          }).then(() => {
            let _wuid = '';

            createWorkunit()
            .then(response => response.json())
            .then((json) => {
              _wuid = json.wuid;
              saveWorkunit(dataset.id, _wuid);
            }).then(() => {
              console.log(dataset, parentPath, directoryTree);

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

              console.log(directoryTree);

              fetch('/workspaces/', {
                method: 'PUT',
                body: JSON.stringify({
                  id: $activeWorkspace.data('id'),
                  directoryTree: directoryTree
                }),
                headers: {
                  'Content-Type': 'application/json'
                }
              })
              .then(response => response.json())
              .then((workspace) => {
                $activeWorkspace.data('directoryTree', JSON.stringify(directoryTree));

                $newDatasetLi = addDataset(newFile);
                $newDataset = $newDatasetLi.find('.dataset');
                console.log($newDataset.data());
                $newDataset.data('wuid', _wuid);
                console.log($newDataset.data());

                if ($parentEl[0].nodeName.toLowerCase() == 'ul') {
                  $parentEl.append($newDatasetLi);
                } else {
                  if ($parentEl.find('ul').first().length == 0) {
                    $parentEl.append('<ul>');
                  }
                  $parentEl.find('ul').first().append($newDatasetLi);
                }

                $datasetStatus = $newDataset.find('.status');
                $newDataset.data('wuid', _wuid);

                showDatasets();
                //$newDataset.trigger('click');

                let t = null;
                let awaitWorkunitStatusComplete = (wuid, callback) => {
                  checkWorkunitStatus(wuid)
                  .then(response => response.json())
                  .then((json) => {
                    if (json.state == 'completed') {
                      if (typeof callback === 'function') {
                        callback(json);
                      }
                    } else {
                      window.clearTimeout(t);
                      t = window.setTimeout(function() {
                        awaitWorkunitStatusComplete(wuid, callback);
                      }, 1500);
                    }
                  });
                };

                (async () => {
                  let response = await createWorkunit();
                  let dpJson = await response.json();
                  let dpWuid = dpJson.wuid;

                  updateWorkunit(dpWuid, null, dataset.name + '-profile.ecl', null, dataset.id, $workspaceId).then(() => {
                    submitWorkunit(dpWuid).then(() => {
                      console.log('check status of DataPatterns workunit');
                      $datasetStatus.addClass('fa-spin');
                      awaitWorkunitStatusComplete(dpWuid, function(json) {
                        getWorkunitResults(dpWuid)
                        .then(response => response.json())
                        .then((wuResult) => {
                          if (!wuResult.WUResultResponse) {
                            throw 'No Workunit Response available for ' + wuid;
                          }
                          let dpResults = wuResult.WUResultResponse.Result.Row;
                          if (dpResults.length < 1) {
                            throw 'No results for Workunit ' + wuid;
                          }
                          console.log(dpResults);

                          let _query = dataset.name + ":=RECORD\n",
                              _keys = Object.keys(currentDatasetFile),
                              _avgs = Object.values(currentDatasetFile),
                              _type =

                          $fileDetails.find('.form-group').each((idx, group) => {
                            let _type = "STRING" + _avgs[idx];
                            if (dpResults[idx].best_attribute_type) {
                              _type = dpResults[idx].best_attribute_type;
                            }
                            _query += "\t" + _type + " " + $(group).children('input:eq(0)').val() + ";\n";
                          });

                          $modal.modal('hide');
                          $saveBtnStatus.addClass('d-none');
                          $saveBtn.removeAttr('disabled').removeClass('disabled');

                          $modal.find('#dataset-name').val('');
                          $form.removeClass('was-validated');

                          _query += "END;\nDS := DATASET('~#USERNAME#::" + $workspaceName + "::" +
                            dataset.filename + "'," + dataset.name + ",CSV(HEADING(1)));\nOUTPUT(DS,," +
                            "'~#USERNAME#::" + $workspaceName + "::" + dataset.filename + "_thor'" +
                            ",'thor',OVERWRITE);";

                          console.log(_query);

                          updateWorkunit(_wuid, _query, null, null, null, null).then(() => {
                            submitWorkunit(_wuid).then(() => {
                              dataset.wuid = _wuid;
                              console.log('check status of workunit');
                              $datasetStatus.addClass('fa-spin');
                              awaitWorkunitStatusComplete(_wuid, function(json) {
                                $datasetStatus.removeClass('fa-spin');

                                dataset.eclQuery = json.query;

                                if (json.results[0].logicalFile) {
                                  dataset.logicalfile = json.results[0].logicalFile;
                                }

                                if (json.results[0].schema) {
                                  dataset.rowCount = json.results[0].rows;
                                  dataset.columnCount = json.results[0].columns;
                                  dataset.eclSchema = JSON.stringify(json.results[0].schema);
                                }

                                fetch('/datasets/', {
                                  method: 'PUT',
                                  body: JSON.stringify(dataset),
                                  headers: {
                                    'Content-Type': 'application/json'
                                  }
                                }).then(() => {
                                  $newDataset.data('wuid', _wuid);
                                  $newDataset.find('.rows').text('Rows: ' + dataset.rowCount);
                                  $newDataset.find('.cols').text('Columns: ' + dataset.columnCount);
                                  $newDataset.data('eclSchema', dataset.eclSchema);
                                  $newDataset.data('query', dataset.eclQuery);
                                  window.clearTimeout(t);
                                });
                              });
                            });
                          });
                        });
                      });
                    });
                  });

                })(); //end async IFFE
              });
            });
          });
        });
      }
    });
  });

  /* UPDATE DATASET INFO */
  $('.datasets').on('click', '.dataset .status', function(evt) {
    let $dataset = $(evt.target).parents('.dataset'),
        dataset = { id: $dataset.data('id') },
        $datasetStatus = $dataset.find('.status');

    evt.stopPropagation();
    $datasetStatus.addClass('fa-spin');
    let t = window.setTimeout(function() {
      checkWorkunitStatus($dataset.data('wuid'))
      .then(response => response.json())
      .then((json) => {
        console.log(json);
        if (json.state == 'completed') {

          $datasetStatus.removeClass('fa-spin');

          dataset.eclQuery = json.query;

          if (json.results[0].logicalFile) {
            dataset.logicalfile = json.results[0].logicalFile;
          }

          if (json.results[0].schema) {
            dataset.rowCount = json.results[0].rows;
            dataset.columnCount = json.results[0].columns;
            dataset.eclSchema = JSON.stringify(json.results[0].schema);
          }

          if (dataset.rowCount && dataset.columnCount) {
            fetch('/datasets/', {
              method: 'PUT',
              body: JSON.stringify(dataset),
              headers:{
                'Content-Type': 'application/json'
              }
            }).then(() => {
              $dataset.find('.rows').text('Rows: ' + dataset.rowCount);
              $dataset.find('.cols').text('Columns: ' + dataset.columnCount);
              $dataset.data('eclSchema', dataset.eclSchema);
              $dataset.data('eclQuery', dataset.eclQuery);
            });
          }
        }
        window.clearTimeout(t);
      });
    }, 1000);
  });

  /* WHEN FILE IS SELECTED FOR NEW DATASET FORM */
  $('#dataset-file').on('change', function(evt) {
    let $file = $(evt.target),
        $saveBtn = $file.parents('.modal').find('.btn-primary'),
        $fileFeedback = $file.siblings('.invalid-feedback'),
        file = evt.target.files[0],
        fileName = '',
        ln = new LineNavigator(file);

    $file.removeClass('is-invalid');
    $fileFeedback.text(DEFAULT_FILE_FEEDBACK);

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

    console.log(file, fileName);

    $('#dataset-name').val(fileName);

    ln.readLines(0, 2, (err, idx, lines, isEOF, progress) => {
      console.log(lines);
      let labels = lines[0].split(','),
          values = lines[1].split(','),
          $fileDetails = $('.file-details');

      if (labels.length != values.length) {
        $file.siblings('.invalid-feedback').text(
          'There may be an issue with this file: the number of column headings doesn\'t match ' +
          'the number of columns in the first row of data.'
        );
        $file.addClass('is-invalid');
        $saveBtn.attr('disabled', 'disabled').addClass('disabled');
        return false;
      }

      $fileDetails.html('');

      labels.forEach((label, idx) => {
        let $newFormRow = $('<div class="form-group"></div>'),
            headingsEl = '<label data-toggle="popover" data-placement="right" ' +
              'title="Headings" data-content="This is the first row from your file, ' +
              'which are being shown here as column headings. If you would like to ' +
              'override these column headings, change the values below.">Headings</label>',
            valuesEl = '<label data-toggle="popover" data-placement="right" ' +
              'title="Sample Row" data-content="This is the second row from your file, ' +
              'which are being shown as an example for the fields that correspond to ' +
              'the column headings to the left. Changing these values will have no impact ' +
              'on the import process of your file.">Values</label>';

        if (idx == 0) {
          $newFormRow.append('<span>' + headingsEl + '</span>');
          $newFormRow.append('<span>' + valuesEl + '</span>');
          $fileDetails.append('<hr />');
        }

        $newFormRow.append('<input type="text" class="form-control" value="' + label.replace(/ /g, '') + '" />');
        $newFormRow.append('<input type="text" class="form-control" value="' + values[idx] + '" />');

        $fileDetails.append($newFormRow);

        console.log(label, values[idx]);
      });

      $('[data-toggle="popover"]').popover({
        trigger: 'hover'
      });
    });

    ln.readLines(0, 11, (err, idx, lines, isEOF, progress) => {
      let labels = lines[0].split(','),
          averages = {};

      for (var i = 1; i < 11; i++) {
        let values = lines[i].split(',');
        values.forEach((val, idx) => {
          if (!averages[labels[idx]]) averages[labels[idx]] = 0;
          averages[labels[idx]] += val.length;
        });
      }

      for (var i = 0; i < Object.keys(averages).length; i++) {
        averages[labels[i]] = averages[labels[i]] / 10;
        if (averages[labels[i]] > 10) {
          averages[labels[i]] = Math.floor((Math.log(averages[labels[i]]) / 1.5) * averages[labels[i]]);
        } else {
          averages[labels[i]] = Math.round((1 + Math.log(averages[labels[i]])) * averages[labels[i]]);
        }
      }

      currentDatasetFile = averages;
    });
    $saveBtn.removeAttr('disabled').removeClass('disabled');
  });

  /* RESET NEW DATASET FORM ON MODAL HIDE */
  $('#newDatasetModal').on('hide.bs.modal', function(evt) {
    $('#newDatasetModal form').removeClass('was-validated');
    $('#newDatasetModal form')[0].reset();
    $('.file-details').html('');
    $('#dataset-file + .invalid-feedback').text(DEFAULT_FILE_FEEDBACK);
    $('#dataset-file').removeClass('is-invalid');
    $('#newDatasetModal .btn-primary .fa-pulse').addClass('d-none');
    $('#newDatasetModal .btn-primary').removeAttr('disabled').removeClass('disabled');
  });

  /* SHOW EDIT DATASET MODAL */
  $('.datasets').on('click', '.dataset .edit', function(evt) {
    let $this = $(this),
        $dataset = $this.parents('.dataset'),
        $modal = $('#editDatasetModal');

    evt.stopPropagation();

    //link.parentElement.removeChild(link);
    $modal.find('#edit-dataset-name').val($dataset.find('.datasetname').text());
    $modal.modal('show');
    console.log($dataset.index());
    $modal.find('.btn-primary').data('dataset', $dataset.index());
    console.log($modal.find('.btn-primary').data('dataset'));
  });

  /* EDIT DATASET */
  $('#editDatasetModal').on('click', '.btn-primary', function(evt) {
    let $modal = $('#editDatasetModal'),
        $datasets = $('.datasets ul'),
        $dataset = $datasets.children().eq($(this).data('dataset')).find('.dataset'),
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
    console.log('submitting PUT with: ', JSON.stringify(data));

    fetch('/datasets/', {
      method: 'PUT',
      body: JSON.stringify(data),
      headers:{
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then((dataset) => {
      $modal.modal('hide');
      $dataset.data('name', dataset.data.name);
      $dataset.find('.datasetname').text($dataset.data('name'));
      $modal.find('#edit-dataset-name').val('');
      $form.removeClass('was-validated');
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

    displayWorkunitResults($this.data('wuid'), $this.data('name'));
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
    $modal.find('.dataset-name').text($dataset.find('.datasetname').text());
    $modal.modal('show');
    console.log($dataset.data());
    $deleteBtn.data('dataset', $dataset.data('id'));
    $deleteBtn.data('parentPath', parentPath);
    $deleteBtn.data('elementToRemove', $folder);
    console.log($modal.find('.btn-danger').data('dataset'));
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
      headers:{
        'Content-Type': 'application/json'
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
          'Content-Type': 'application/json'
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

  $('.scripts').on('click', '.script', function(evt) {
    let $this = $(this),
        _wuid = $this.data('wuid') ? $this.data('wuid') : '',
        $scriptControls = $('.script-controls');

    $('#scripts').find('.script').removeClass('active');
    $this.addClass('active');

    $('.script-panel-placeholder').removeClass('d-none');
    $('.script-panel').removeClass('d-none');
    $('#editor').removeClass('cmReady');
    $('.save-script').removeClass('badge-info').addClass('badge-secondary');
    changeRunButtonState($('.run-script'), 'ready');
    editor.refresh();

    if ($this.data('content')) {
      editor.getDoc().setValue($this.data('content'));
    } else {
      editor.getDoc().setValue('');
    }
    let _t = window.setTimeout(function() {
      $('#editor').addClass('cmReady');
      window.clearTimeout(_t);
    }, 100);

    if (_wuid == '') {
      $scriptControls.find('.show-results').addClass('d-none');
    } else {
      $scriptControls.find('.show-results').removeClass('d-none');
    }
  });

  toggleNewScriptPopover();

  /* CREATE NEW SCRIPT */
  $('#newScriptModal').on('click', '.btn-primary', function(evt) {
    let $this = $(this),
        $modal = $('#newScriptModal'),
        $scripts = $('.scripts'),
        $activeWorkspace = $('.workspaces .active'),
        workspaceId = $activeWorkspace.data('id'),
        parentPath = $this.data('parentPath') || [],
        parentPathNames = $this.data('parentPathNames') || [],
        directoryTree = JSON.parse($activeWorkspace.data('directoryTree')),
        $parentEl = $this.data('parentToReceiveChild') || $('.scripts').children('ul').first(),
        $newScript = $scripts.find('.cloner').clone(),
        $form = $modal.find('form'),
        data = getFormData($form);

    if ($form[0].checkValidity() === false) {
      evt.preventDefault();
      evt.stopPropagation();
      $form.addClass('was-validated');
      return false;
    }

    console.log(data);
    data.workspaceId = workspaceId;
    data.parentPathNames = parentPathNames.join('/');
    console.log(JSON.stringify(data));

    fetch('/scripts/', {
      method: 'POST',
      body: JSON.stringify(data),
      headers:{
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then((script) => {

      console.log(script, parentPath, directoryTree);

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

      console.log(directoryTree);

      $modal.modal('hide');

      fetch('/workspaces/', {
        method: 'PUT',
        body: JSON.stringify({
          id: $activeWorkspace.data('id'),
          directoryTree: directoryTree
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      .then(response => response.json())
      .then((workspace) => {
        newFile.parentPathNames = data.parentPathNames;
        $modal.modal('hide');

        $activeWorkspace.data('directoryTree', JSON.stringify(directoryTree));

        if ($parentEl[0].nodeName.toLowerCase() == 'ul') {
          $parentEl.append(addScript(newFile));
        } else {
          if ($parentEl.find('ul').first().length == 0) {
            $parentEl.append('<ul>');
          }
          $parentEl.find('ul').first().append(addScript(newFile));
        }

        $form.removeClass('was-validated');

        toggleNewScriptPopover();
      });

      $modal.modal('hide');

      $modal.find('#new-script-name').val('');
      $form.removeClass('was-validated');

      showScripts();

      $newScript.trigger('click');
    });
  });

  /* RESET NEW SCRIPT FORM ON MODAL HIDE */
  $('#newScriptModal').on('hide.bs.modal', function(evt) {
    $('#newScriptModal form').removeClass('was-validated');
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
    console.log($script.data('id'));
    $saveBtn.data('script', $script.data('id'));
    console.log($modal.find('.btn-primary').data('script'));
  });

  /* EDIT SCRIPT */
  $('#editScriptModal').on('click', '.btn-primary', function(evt) {
    let $this = $(this),
        $modal = $('#editScriptModal'),
        $script = $this.data('elementToUpdate'),
        $activeWorkspace = $('.workspaces .active'),
        workspaceId = $activeWorkspace.data('id'),
        parentPath = $this.data('parentPath'),
        directoryTree = JSON.parse($activeWorkspace.data('directoryTree')),
        $form = $modal.find('form'),
        scriptName = $form.find('#edit-script-name').val(),
        data = getFormData($form);

    if ($form[0].checkValidity() === false) {
      evt.preventDefault();
      evt.stopPropagation();
      $form.addClass('was-validated');
      return false;
    }

    data.id = $script.data('id');
    data.name = scriptName;
    data.prevName = $script.data('name');
    data.workspaceId = workspaceId;
    console.log('submitting PUT with: ', JSON.stringify(data));

    fetch('/scripts/', {
      method: 'PUT',
      body: JSON.stringify(data),
      headers:{
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then((script) => {

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
          'Content-Type': 'application/json'
        }
      })
      .then(response => response.json())
      .then((json) => {
        $modal.modal('hide');
        $script.data('name', script.data.name);
        $script.find('.scriptname').text(script.data.name);
        $modal.find('#edit-script-name').val('');
        $form.removeClass('was-validated');
      });
    });
  });

  /* RESET EDIT SCRIPT FORM ON MODAL HIDE */
  $('#editScriptModal').on('hide.bs.modal', function(evt) {
    $('#editScriptModal form').removeClass('was-validated');
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

    $modal.find('.script-name').text($script.find('.scriptname').text());
    $modal.modal('show');
    console.log($script.data('id'));
    $deleteBtn.data('script', $script.data('id'));
    $deleteBtn.data('parentPath', parentPath);
    $deleteBtn.data('elementToRemove', $folder);
    console.log($modal.find('.btn-danger').data('script'));
  });

  /* DELETE SELECTED SCRIPT */
  $('#removeScriptModal').on('click', '.btn-danger', function(evt) {
    let $this = $(this),
        $modal = $('#removeScriptModal'),
        $activeWorkspace = $('.workspaces .active'),
        parentPath = $this.data('parentPath'),
        directoryTree = JSON.parse($activeWorkspace.data('directoryTree')),
        $elementToRemove = $this.data('elementToRemove'),
        $scriptPanelClose = $('.js-close'),
        $targetScript = $elementToRemove.find('.script'),
        targetId = $targetScript.data('id');

    fetch('/scripts/', {
      method: 'DELETE',
      body: JSON.stringify({ scriptId: targetId }),
      headers:{
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then((json) => {
      if ($targetScript.hasClass('active')) {
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
          'Content-Type': 'application/json'
        }
      })
      .then(response => response.json())
      .then((json) => {
        if ($targetScript.hasClass('active')) {
          $scriptPanelClose.trigger('click');
        }

        $activeWorkspace.data('directoryTree', JSON.stringify(directoryTree));
        $elementToRemove.remove();

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

  $('#datasets-wrapper, #scripts-wrapper').on('mousedown', function(evt) {
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

    if (evt.button == 2) {
      evt.preventDefault();
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

      console.log('this: ', $this, 'folder: ', $folder, 'data: ', $folder.data(),
        'parentPath: ', parentPath, 'x: ' + evt.pageX + ', y: ' + evt.pageY);
      $contextMenu.css({
        'left': evt.pageX,
        'top': evt.pageY
      });
      $contextMenu.fadeIn(200);
    } else {
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

          $target.data('parentPathNames', parentPathNames);
        }

        console.log($target);
      }
    }
  });

  $('#datasets-wrapper, #scripts-wrapper').on('contextmenu', function(evt) {
    return false;
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
        $ul = $this.parents('li').first().children('ul').first();
    if ($this.hasClass('open')) { $this.removeClass('open'); } else { $this.addClass('open'); }
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

    console.log(JSON.stringify(getFormData($form)), parentPath, directoryTree);

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

    console.log(directoryTree);

    fetch('/workspaces/', {
      method: 'PUT',
      body: JSON.stringify({
        id: $activeWorkspace.data('id'),
        directoryTree: directoryTree
      }),
      headers: {
        'Content-Type': 'application/json'
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
        folderType = $saveBtn.data('folderType'),
        folderId = $saveBtn.data('folderId'),
        directoryTree = JSON.parse($activeWorkspace.data('directoryTree'));

    if ($form[0].checkValidity() === false) {
      evt.preventDefault();
      evt.stopPropagation();
      $form.addClass('was-validated');
      return false;
    }

    console.log($folderName.val(), folderId, directoryTree);

    let changeFolderName = (root, id, name) => {
      for (var key in root) {
        let el = root[key];
        console.log(el);
        if (el.id == id) {
          console.log('changing ' + el.id);
          el.name = name;
          return false;
        }
        if (el.children) {
          console.log('recursing to children of ' + el.id);
          changeFolderName(el.children, id, name);
        }
      }
    };

    changeFolderName(directoryTree[folderType], folderId, $folderName.val());

    console.log(directoryTree);

    fetch('/workspaces/', {
      method: 'PUT',
      body: JSON.stringify({
        id: $activeWorkspace.data('id'),
        directoryTree: directoryTree
      }),
      headers: {
        'Content-Type': 'application/json'
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
        $modal = $('#removeFolderModal'),
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
    $modal.find('.foldername').text($folder.find('.foldername').first().text());
    $modal.modal('show');
    console.log(parentPath);
    $deleteBtn.data('parentPath', parentPath);
    if ($wrapper.attr('id') == 'datasets') {
      $deleteBtn.data('folderType', 'datasets');
    } else {
      $deleteBtn.data('folderType', 'scripts');
    }
    $deleteBtn.data('elementToRemove', $folder);
    console.log($deleteBtn.data('parentPath'));
  });

  /* DELETE SELECTED FOLDER */
  $('#removeFolderModal').on('click', '.btn-danger', function(evt) {
    let $this = $(this),
        $modal = $('#removeFolderModal'),
        $activeWorkspace = $('.workspaces .active'),
        $activeScript = $('.scripts').find('.active'),

        folderType = $this.data('folderType'),
        parentPath = $this.data('parentPath'),
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
            console.log(node);
            childrenToDelete.push(node.id);
          } else {
            console.log(Object.entries(node.children));
            Object.entries(node.children).forEach((_node) => {
              deleteChildren(_node[1]);
            });
          }
        },

        elementsToDelete = null;

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
        ids: childrenToDelete
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then((json) => {
      fetch('/workspaces/', {
        method: 'PUT',
        body: JSON.stringify({
          id: $activeWorkspace.data('id'),
          directoryTree: directoryTree
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      .then(response => response.json())
      .then((json) => {
        if ($activeScript.hasClass('active')) {
          $scriptPanelClose.trigger('click');
        }
        console.log(JSON.stringify(directoryTree));
        $activeWorkspace.data('directoryTree', JSON.stringify(directoryTree));
        $elementToRemove.remove();

        $modal.modal('hide');
      });
    });
  });

  if ($('.data-table').length > 0) {
    $('.data-table').DataTable();
  }

  /*==========================================================================*
   *  SCRIPT PANEL CONTROLS                                                   *
   *==========================================================================*/

  let $scriptPanelControls = $('.script-panel-controls'),
      $scriptControls = $('.script-controls'),
      $runButton = $('.script-controls .run-script'),
      $outputsList = $('.outputs-list');

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

  $scriptControls.on('click', '.run-script', function(evt) {
    let $script = $('.scripts .active'),
        _query = editor.getValue(),
        _wuid = '',
        _filename = $script.data('name') + '.ecl',
        $activeWorkspace = $('.workspaces .active'),
        $main = $('.dataset-content').parents('main'),
        revisionId = 0,
        script = {
          id: $script.data('id'),
        };

    $(this).blur();
    evt.preventDefault();

    changeRunButtonState($runButton, 'running');

    fetch('/scripts/revision/', {
      method: 'POST',
      body: JSON.stringify({
        scriptId: $script.data('id'),
        name: $script.data('name'),
        path: $script.data('parentPathNames'),
        content: editor.getValue()
      }),
      headers:{
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then((json) => {
      if (!json.success) {
        changeRunButtonState($runButton, 'failed');

        let _annotateTimeout = window.setTimeout(function() {
          updateCodemirrorAnnotations(json.errors);
          window.clearTimeout(_annotateTimeout);
        }, 500);

        let updateCodemirrorAnnotations = (errors) => {
          errors.forEach((err) => {
            console.log(err);
            let marker = document.createElement('div');
            marker.style.color = '#dc3545';
            marker.innerHTML = '<i class="fa fa-exclamation-circle" title="' + err.Message.replace(/\"/g, "'") + '"></i>';
            editor.getDoc().setGutterMarker(err.LineNo - 1, 'cm-errors', marker);
          });
        };
        return false;
      }

      $script.data('revisionId', json.data.id);

      createWorkunit()
      .then(response => response.json())
      .then((json) => {
        _wuid = json.wuid;
        saveWorkunit($script.data('revisionId'), _wuid);
        $script.data('wuid', _wuid);
        script.wuid = _wuid;
      })
      .then(() => {
        console.log(_filename);
        updateWorkunit(_wuid, null, _filename, $script.data('parentPathNames'), null, $activeWorkspace.data('id')).then(() => {
          submitWorkunit(_wuid).then(() => {
            console.log('check status of workunit');

            let t = null;
            let awaitWorkunitStatusComplete = () => {
              checkWorkunitStatus(_wuid)
              .then(response => response.json())
              .then((json) => {

                editor.getDoc().clearGutter('cm-errors');

                if (json.state == 'completed') {
                  console.log(json);
                  window.clearTimeout(t);
                  changeRunButtonState($runButton, 'ready');
                  $main.addClass('show-outputs');
                  $outputsList.html('');
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
                    }

                    $outputsList.append('<a href="#" class="' + classList.join(' ') + '">' + outputLabel + '</a>');
                  });
                  $outputsList.children().eq(0).trigger('click');
                } else if (json.state == 'failed') {
                  console.log(json);
                  window.clearTimeout(t);
                  changeRunButtonState($runButton, 'failed');

                  let _annotateTimeout = window.setTimeout(function() {
                    updateCodemirrorAnnotations(json.errors);
                    window.clearTimeout(_annotateTimeout);
                  }, 500);

                  let updateCodemirrorAnnotations = (errors) => {
                    errors.forEach((err) => {
                      console.log(err);
                      let marker = document.createElement('div');
                      marker.style.color = '#dc3545';
                      marker.innerHTML = '<i class="fa fa-exclamation-circle" title="' + err.Message.replace(/\"/g, "'") + '"></i>';
                      editor.getDoc().setGutterMarker(err.LineNo - 1, 'cm-errors', marker);
                    });
                  };
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

  $scriptControls.on('click', '.show-results', function(evt) {
    let $this = $(this),
        $script = $('.scripts .active'),
        $main = $('main'),
        _wuid = $script.data('wuid') ? $script.data('wuid') : '';

    $main.removeClass('show-outputs');
    $outputsList.html('');

    if (_wuid !== '') {
      checkWorkunitStatus(_wuid)
        .then(response => response.json())
        .then((json) => {

          editor.getDoc().clearGutter('cm-errors');

          if (json.state == 'completed') {
            console.log(json);
            changeRunButtonState($runButton, 'ready');
            $main.addClass('show-outputs');
            $outputsList.html('');
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
              }

              $outputsList.append('<a href="#" class="' + classList.join(' ') + '">' + outputLabel + '</a>');
            });
            $outputsList.children().eq(0).trigger('click');
          }
        });
    }
  });

  $scriptControls.on('click', '.save-script', function(evt) {
    let $script = $('.scripts .active'),
        $saveButton = $(this),
        _query = editor.getValue().replace(/\s+/g, ' '),
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

    $saveButton.contents()[0].nodeValue = 'SAVING';
    $saveButton.removeClass('badge-info').addClass('badge-secondary');

    fetch('/scripts/revision/', {
      method: 'POST',
      body: JSON.stringify({
        scriptId: $script.data('id'),
        path: $script.data('parentPathNames'),
        content: editor.getValue()
      }),
      headers:{
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then((json) => {
      if (json.success) {
        $saveButton.contents()[0].nodeValue = 'SAVED';
        $script.data('revisionId', json.data.id);
        $script.data('content', json.data.content);
        $saveButton.attr('title', 'No Changes');
        editor.getDoc().clearGutter('cm-errors');
      } else {
        let _annotateTimeout = window.setTimeout(function() {
          updateCodemirrorAnnotations(json.errors);
          window.clearTimeout(_annotateTimeout);
        }, 500);

        let updateCodemirrorAnnotations = (errors) => {
          errors.forEach((err) => {
            console.log(err);
            let marker = document.createElement('div');
            marker.style.color = '#dc3545';
            marker.innerHTML = '<i class="fa fa-exclamation-circle" title="' + err.Message.replace(/\"/g, "'") + '"></i>';
            editor.getDoc().setGutterMarker(err.LineNo - 1, 'cm-errors', marker);
          });
        };
      }
    });
  });

  $outputsList.on('click', '.output', function(evt) {
    let $output = $(this),
        $script = $('.scripts .active'),
        $datasetContent = $('.dataset-content'),
        $tableWrapper = $datasetContent.find('.table-wrapper');

    $output.addClass('badge-primary').removeClass('badge-secondary')
      .siblings().addClass('badge-secondary').removeClass('badge-primary');

    if ($output.hasClass('data-pattern')) {
      let dataPatternsReportUrl = ((cluster.host.indexOf('http') < 0) ? 'http://' : '') +
        cluster.host + ':' + cluster.port + '/WsWorkunits/res/' + $script.data('wuid') +
        '/report/res/index.html';
      $tableWrapper.html('<iframe src="' + dataPatternsReportUrl + '" />');
      $tableWrapper.css({ height: '770px' });
    } else if ( $output.hasClass('visualization')) {
      let visualizationUrl = ((cluster.host.indexOf('http') < 0) ? 'http://' : '') +
        cluster.host + ':' + cluster.port + '/WsWorkunits/res/' + $script.data('wuid') +
        '/res/index.html';
      $tableWrapper.html('<iframe src="' + visualizationUrl + '" />');
      $tableWrapper.css({ height: '770px' });
    } else {
      displayWorkunitResults($script.data('wuid'), $script.find('.scriptname').text(), $output.index(), true);
      $tableWrapper.css({ height: '' });
    }

    $datasetContent.removeClass('d-none');
  });

  $scriptPanelControls.on('click', '.js-close', function() {
    $('.script-panel-placeholder').addClass('d-none');
    $('.script-panel').addClass('d-none');
    $('.scripts .script').removeClass('active');
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
    }
  });

  /*==========================================================================*
   *  EDITOR EVENT HANDLERS                                                   *
   *==========================================================================*/

  editor.on('change', _.debounce((instance, changeObj) => {
    let $saveButton = $('.save-script');

    if ($('#editor').hasClass('cmReady')) {
      $saveButton.attr('title', 'Save Script').removeClass('badge-secondary').addClass('badge-info');
      if (['+input', '+delete', 'cut', 'paste', 'drop', 'undo'].indexOf(changeObj.origin) > -1) {
        console.log('autosave script...');
        $saveButton.trigger('click');
      }
    }

    if (changeObj.origin == 'setValue') {
      $saveButton.contents()[0].nodeValue = 'SAVE';
    }

    console.log(instance, changeObj);
    changeRunButtonState($('.run-script'), 'ready');
  }, 500));

  editor.on('focus', (instance, evt) => {
    if (false == $('#editor').hasClass('cmReady')) {
      $('#editor').addClass('cmReady');
    }
  });

  $(document).on('dragstart', (evt) => {
    let $target = $(evt.target);
    console.log($target);
    if ($target.hasClass('dataset') || $target.hasClass('script')) {
      $draggedObject = $(evt.target);
      console.log($draggedObject.data());
    }
  });

  editor.on('drop', (instance, evt) => {
    console.log(instance, evt);
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
            alert('check syntax');
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
            $target.parents('.modal-content').find('.btn-primary').trigger('click');
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
