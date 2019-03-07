'use strict';

require.config({
  paths: {
    'vs': '/javascripts/monaco-editor/min/vs',
    'ln': '/javascripts/line-navigator',
  }
});

let hostname = 'http://localhost:3000';

const NO_WORKSPACE = 'Select Workspace...';
const NEW_SCRIPT = 'New Script...';
const NEW_DATASET = 'New Dataset...';

const FILE_FEEDBACK = 'Please select a CSV file to upload.';

let currentDatasetFile = {};

let populateWorkspaces = () => {
  fetch('/users/workspaces')
    .then(response => response.json())
    .then((workspaces) => {
      if (workspaces.length == 0) {
        $('.workspace-tip').removeClass('d-none');
      } else {
        let $workspaces = $('.workspaces');

        workspaces.forEach((workspace) => {
          console.log(workspace);
          let $newWorkspace = $workspaces.find('.cloner').clone();
          $newWorkspace.removeClass('d-none cloner');
          $newWorkspace.data('name', workspace.name);
          $newWorkspace.data('id', workspace.id);
          $newWorkspace.text($newWorkspace.data('name'));
          $workspaces.append($newWorkspace);
        });
      }
    });
};

let populateDatasets = () => {
  let url = new URL(hostname + '/datasets'),
      $activeWorkspace = $('.workspaces .active'),
      $datasets = $('.datasets'),
      params = { workspaceId: $activeWorkspace.data('id') };

  url.search = new URLSearchParams(params);

  $datasets.find('.dataset:not(.cloner)').remove();

  fetch(url)
    .then(response => response.json())
    .then((datasets) => {
      console.log(datasets);
      datasets.forEach((dataset) => {
        addDataset(dataset);
        if (!dataset.logicalfile) {
          $datasets.children().last().find('.status').removeClass('d-none');
        }
      });

      if (datasets.length > 0) {
        showDatasets();
      }
    });
};

let addDataset = (dataset) => {
  let $datasets = $('.datasets'),
      $newDataset = $datasets.find('.cloner').clone();

  $newDataset.removeClass('d-none cloner');
  $newDataset.data('id', dataset.id);
  $newDataset.data('name', dataset.name);
  $newDataset.find('.datasetname').contents()[0].nodeValue = dataset.name;
  $datasets.append($newDataset);
};

let showDatasets = () => {
  let $datasets = $('.datasets'),
      $datasetCollapser = $('#dataset-collapser');

  if (!$datasets.hasClass('show')) {
    $datasetCollapser.trigger('click');
  }
};

let populateScripts = () => {
  let url = new URL(hostname + '/scripts'),
      $activeWorkspace = $('.workspaces .active'),
      $scripts = $('.scripts'),
      params = { workspaceId: $activeWorkspace.data('id') };

  url.search = new URLSearchParams(params);

  $scripts.find('.script:not(.cloner)').remove();

  fetch(url)
    .then(response => response.json())
    .then((scripts) => {
      console.log(scripts);
      scripts.forEach((script) => {
        addScript(script);
      });

      if (scripts.length > 0) {
        showScripts();
      }
    });
};

let addScript = (script) => {
  let $scripts = $('.scripts'),
      $newScript = $scripts.find('.cloner').clone();

  $newScript.removeClass('d-none cloner');
  $newScript.data('id', script.id);
  $newScript.data('name', script.name);
  $newScript.find('.scriptname').contents()[0].nodeValue = script.name;
  $scripts.append($newScript);
};

let showScripts = () => {
  let $scripts = $('.scripts'),
      $scriptCollapser = $('#script-collapser');

  if (!$scripts.hasClass('show')) {
    $scriptCollapser.trigger('click');
  }
};

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
      clusterAddr: 'http://10.173.147.1',
      clusterPort: '8010'
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  });
};

let updateWorkunit = (wuid, query) => {
  return fetch('/hpcc/workunits', {
    method: 'PUT',
    body: JSON.stringify({
      clusterAddr: 'http://10.173.147.1',
      clusterPort: '8010',
      wuid: wuid,
      query: query
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
      clusterAddr: 'http://10.173.147.1',
      clusterPort: '8010',
      wuid: wuid,
      cluster: 'hthor'
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
  formData.append('clusterAddr', 'http://10.173.147.1');
  formData.append('clusterPort', '8010');

  return fetch('/hpcc/filespray/upload', {
    method: 'POST',
    body: formData
  });
};

let sprayFile = (clusterFilename, workspaceId) => {
  console.log(clusterFilename);
  let formData = new FormData();
  formData.append('filename', clusterFilename);
  formData.append('clusterAddr', 'http://10.173.147.1');
  formData.append('clusterPort', '8010');
  formData.append('workspaceId', workspaceId);

  return fetch('/hpcc/filespray/spray', {
    method: 'POST',
    body: formData
  });
};

let getDfuWorkunit = (wuid) => {
  let formData = new FormData();
  formData.append('wuid', wuid);
  formData.append('clusterAddr', 'http://10.173.147.1');
  formData.append('clusterPort', '8010');

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

let checkWorkunitStatus = async (wuid) => {
  let response = await fetch('/hpcc/workunits?wuid=' + wuid +
    '&clusterAddr=http%3A%2F%2F10.173.147.1%3A8010');

  let json = await response.json();
  console.log(json);
};

require([
  'vs/editor/editor.main',
  'ln/line-navigator.min'
], function(monaco, LineNavigator) {
  var editor;

  if ($('#editor').length > 0) {
    editor = monaco.editor.create($('#editor')[0], {
      value: [
        'function x() {',
        '\tconsole.log("Hello world!");',
        '}'
      ].join('\n'),
      language: 'javascript',
      automaticLayout: true,
    });
  }

  $(function() {

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

    /*==========================================================================*
     *  WORKSPACES                                                              *
     *==========================================================================*/

    populateWorkspaces();

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
        $newWorkspace.data('id', workspace.id);
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
          $deleteWorkspace = $('.delete-workspace').parent();

      evt.preventDefault();

      $options.removeClass('active');
      $this.addClass('active');
      $selected.text($this.text());
      $deleteWorkspace.removeClass('d-none');

      $scriptPanelClose.trigger('click');

      populateDatasets();
      populateScripts();
      toggleNewScriptPopover();
    });

    /* DELETE SELECTED WORKSPACE */
    $('#removeWorkspaceModal').on('click', '.btn-danger', function(evt) {
      let $modal = $('#removeWorkspaceModal'),
          $workspaces = $('.workspaces'),
          $scripts = $('.scripts .script:not(.cloner)'),
          $deleteWorkspace = $('.delete-workspace').parent(),
          $scriptPanelClose = $('.js-close'),
          $workspaceSelect = $('#workspaceSelect');

      fetch('/workspaces/', {
        method: 'DELETE',
        body: JSON.stringify({ workspaceName: $workspaceSelect.text() }),
        headers:{
          'Content-Type': 'application/json'
        }
      })
      .then(response => response.json())
      .then((json) => {
        $modal.modal('hide');
        $workspaces.find('.active').remove();
        $scripts.remove();
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

    /* CREATE NEW DATASET */
    $('#newDatasetModal').on('click', '.btn-primary', function(evt) {
      let $modal = $('#newDatasetModal'),
          $datasets = $('.datasets'),
          $activeWorkspace = $('.workspaces .dropdown-item.active'),
          $workspaceId = $activeWorkspace.data('id'),
          $workspaceName = $activeWorkspace.data('name'),
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
            workspaceId: $workspaceId
          };

      if (file === undefined) {
        $file.addClass('is-invalid');
        return false;
      } else {
        dataset.filename = file.name
      }

      if ($form[0].checkValidity() === false) {
        evt.preventDefault();
        evt.stopPropagation();
        $form.addClass('was-validated');
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
        } else {
          dataset.id = json.data.id;
          sendFileToLandingZone(file)
          .then(response => response.json())
          .then(json => {
            console.log(json);
            dataset.file = json.file;
            sprayFile(json.file, $workspaceName)
            .then(response => response.json())
            .then((json) => {
              dataset.wuid = json.wuid;
              console.log('sprayed file', dataset.wuid);
            }).then(() => {
              console.log('update dataset ' + dataset.id);

              addDataset(dataset);
              let $newDataset = $datasets.children().last();
              $newDataset.find('.status').removeClass('d-none');

              showDatasets();

              fetch('/workunits/', {
                method: 'POST',
                body: JSON.stringify({
                  objectId: dataset.id,
                  workunitId: dataset.wuid
                }),
                headers:{
                  'Content-Type': 'application/json'
                }
              });
            }).then(() => {
              $modal.modal('hide');
              $modal.find('#dataset-name').val('');
              $form.removeClass('was-validated');


            });
          });
        }
      });
    });

    /* WHEN FILE IS SELECTED FOR NEW DATASET FORM */
    $('#dataset-file').on('change', function(evt) {
      let $file = $(evt.target),
          $fileFeedback = $file.siblings('.invalid-feedback'),
          file = evt.target.files[0],
          fileName = '',
          ln = new LineNavigator(file);

      $file.removeClass('is-invalid');
      $fileFeedback.text(FILE_FEEDBACK);

      if (!file) {
        $file.addClass('is-invalid');
        return false;
      }

      file.name.substr(0, file.name.lastIndexOf('.')).replace(/-_\s/g, '_').split('_').map((word) => {
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

        $fileDetails.html('');

        labels.map((label, idx) => {
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

          $newFormRow.append('<input type="text" class="form-control" value="' + label + '" />');
          $newFormRow.append('<input type="text" class="form-control" value="' + values[idx] + '" />');

          $fileDetails.append($newFormRow);

          console.log(label, values[idx]);
        });

        $('[data-toggle="popover"]').popover({
          trigger: 'hover'
        });
      });
    });

    /* RESET NEW DATASET FORM ON MODAL HIDE */
    $('#newDatasetModal').on('hide.bs.modal', function(evt) {
      $('#newDatasetModal form').removeClass('was-validated');
      $('#newDatasetModal form')[0].reset();
      $('.file-details').html('');
      $('#dataset-file + .invalid-feedback').text(FILE_FEEDBACK);
      $('#dataset-file').removeClass('is-invalid');
    });

    /* CHANGE SELECTED DATASET */
    $('.datasets').on('click', '.dataset', function(evt) {
      let $this = $(this);
      $this.addClass('active');
      console.log($this);
    });

    /* SHOW DELETE DATASET CONFIRMATION */
    $('.datasets').on('click', '.dataset .delete', function(evt) {
      let $this = $(this),
          $dataset = $this.parents('.dataset'),
          $modal = $('#removeDatasetModal');

      evt.stopPropagation();

      //link.parentElement.removeChild(link);
      $modal.find('.datasetname').text($dataset.find('.datasetname').text());
      $modal.modal('show');
      console.log($dataset.index());
      $modal.find('.btn-danger').data('dataset', $dataset.index());
      console.log($modal.find('.btn-danger').data('dataset'));
    });

    /* DELETE SELECTED DATASET */
    $('#removeDatasetModal').on('click', '.btn-danger', function(evt) {
      let $this = $(this),
          $modal = $('#removeDatasetModal'),
          $datasets = $('.datasets'),
          $datasetCollapser = $('#dataset-collapser'),
          $activeDataset = $datasets.children().eq($this.data('dataset'));

      fetch('/datasets/', {
        method: 'DELETE',
        body: JSON.stringify({ datasetId: $activeDataset.data('id') }),
        headers:{
          'Content-Type': 'application/json'
        }
      })
      .then(response => response.json())
      .then((json) => {
        $activeDataset.remove();
        $modal.modal('hide');

        if ($datasets.children(':not(.cloner)').length < 1) {
          $datasetCollapser.trigger('click');
        }
      });
    });

    /*==========================================================================*
     *  SCRIPTS                                                                 *
     *==========================================================================*/

    $('.scripts').on('click', '.script', function(evt) {
      let $this = $(this);
      $this.siblings().removeClass('active');
      $this.addClass('active');
    });

    toggleNewScriptPopover();

    /* CREATE NEW SCRIPT */
    $('#newScriptModal').on('click', '.btn-primary', function(evt) {
      let $modal = $('#newScriptModal'),
          $scripts = $('.scripts'),
          $workspaceId = $('.workspaces .dropdown-item.active').data('id'),
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
      data.workspaceId = $workspaceId;
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
        $modal.modal('hide');
        $newScript.removeClass('d-none cloner');
        $newScript.data('id', script.id);
        $newScript.data('name', script.name);
        $newScript.find('.scriptname').text($newScript.data('name'));
        $scripts.append($newScript);
        $modal.find('#script-name').val('');
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

    /* SHOW DELETE SCRIPT CONFIRMATION */
    $('.scripts').on('click', '.script .delete', function(evt) {
      let $this = $(this),
          $script = $this.parents('.script'),
          $modal = $('#removeScriptModal');

      evt.stopPropagation();

      //link.parentElement.removeChild(link);
      $modal.find('.scriptname').text($script.find('.scriptname').text());
      $modal.modal('show');
      console.log($script.index());
      $modal.find('.btn-danger').data('script', $script.index());
      console.log($modal.find('.btn-danger').data('script'));
    });

    /* DELETE SELECTED SCRIPT */
    $('#removeScriptModal').on('click', '.btn-danger', function(evt) {
      let $this = $(this),
          $modal = $('#removeScriptModal'),
          $scriptPanelClose = $('.js-close'),
          $scripts = $('.scripts'),
          $activeScript = $scripts.children().eq($this.data('script'));

      fetch('/scripts/', {
        method: 'DELETE',
        body: JSON.stringify({ scriptId: $activeScript.data('id') }),
        headers:{
          'Content-Type': 'application/json'
        }
      })
      .then(response => response.json())
      .then((json) => {
        if ($activeScript.hasClass('active')) {
          $scriptPanelClose.trigger('click');
        }

        $activeScript.remove();
        $modal.modal('hide');
      });
    });

    if ($('.table').length > 0) {
      $('.table').DataTable();
    }

    $('.script-panel-controls').on('click', '.js-close', function() {
      $('.script-panel-placeholder').addClass('d-none');
      $('.script-panel').addClass('d-none');
      $('.scripts .script').removeClass('active');
      $('.script-panel-controls .js-restore').removeClass('fa-window-restore').addClass('fa-window-maximize');
      $('.script-panel').removeClass('maximized').removeClass('minimized');
    });

    $('.script-panel-controls').on('click', '.js-minimize', function() {
      if ($('.script-panel').hasClass('minimized') || $('.script-panel').hasClass('maximized')) return;

      $('.script-panel').addClass('minimized');
      if ($('.js-restore').hasClass('fa-window-maximize')) {
        $('.script-panel-controls .js-restore').removeClass('fa-window-maximize').addClass('fa-window-restore');
      } else {
        $('.script-panel-controls .js-restore').removeClass('fa-window-restore').addClass('fa-window-maximize');
      }
    });

    $('.script-panel-controls').on('click', '.js-restore', function() {
      if ($('.script-panel').hasClass('minimized')) {
        $('.script-panel').removeClass('minimized');
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

    $('#scripts').on('click', '.script', function() {
      $('.script-panel-placeholder').removeClass('d-none');
      $('.script-panel').removeClass('d-none');
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js', { scope: '/' })
        .then(function() { console.log('Service Worker Registered'); });
    }

  });

});
