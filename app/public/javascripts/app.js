'use strict';

let hostname = 'http://' + window.location.hostname + ':3000';

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
      console.log('populateDatasets', datasets);
      datasets.forEach((dataset) => {
        addDataset(dataset);
        let $dataset = $datasets.children().last();
        if (!dataset.logicalfile) {
          $dataset.find('.status').removeClass('d-none');
        }
        if (dataset.rowCount) {
          $dataset.find('.rows').text('Rows: ' + dataset.rowCount);
        }
        if (dataset.columnCount) {
          $dataset.find('.cols').text('Columns: ' + dataset.columnCount);
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
  $newDataset.data('wuid', dataset.workunitId);
  $newDataset.data('rows', dataset.rowCount);
  $newDataset.data('cols', dataset.columnCount);
  $newDataset.data('query', dataset.eclQuery);
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
  $newScript.data('revisionId', script.revisionId);
  $newScript.data('content', script.content);
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

let checkWorkunitStatus = (wuid) => {
  return fetch('/hpcc/workunits?wuid=' + wuid +
    '&clusterAddr=http%3A%2F%2F10.173.147.1%3A8010');
};

let getWorkunitResults = (wuid, count, sequence) => {
  console.log('request /hpcc/workunits/results', wuid, count);

  return fetch('/hpcc/workunits/results', {
    method: 'POST',
    body: JSON.stringify({
      clusterAddr: 'http://10.173.147.1',
      clusterPort: '8010',
      wuid: wuid,
      count: ((count) ? count : 1000),
      sequence: ((sequence) ? sequence : 0)
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  });
};

let displayWorkunitResults = (wuid, title, sequence = 0) => {
  let $datasetContent = $('.dataset-content'),
      $title = $datasetContent.find('h4'),
      $loader = $datasetContent.siblings('.loader'),
      $tableWrapper = $datasetContent.find('.table-wrapper'),
      $table = null,
      dataTable = null;

  $title.text(title);

  $datasetContent.addClass('d-none');
  $loader.removeClass('d-none');

  getWorkunitResults(wuid, 1000, sequence)
  .then(response => response.json())
  .then((wuResult) => {
    let results = wuResult.WUResultResponse.Result.Row;
    console.log(wuResult);
    $tableWrapper.html(
      '<table class="table" style="width: 100%;">' +
      '<thead><tr></tr></thead><tbody></tbody>' +
      '<tfoot><tr></tr></tfoot></table>'
    );
    $table = $tableWrapper.find('.table');
    Object.keys(results[0]).forEach((key) => {
      $table.find('thead tr').append('<th scope="col">' + key + '</th>');
      $table.find('tfoot tr').append('<th scope="col">' + key + '</th>');
    });
    results.forEach((row) => {
      $table.find('tbody').append('<tr></tr>');
      let $row = $table.find('tbody tr:last-child');
      for (var x in row) {
        $row.append('<td scope="row">' + row[x] + '</td>');
      }
    });

    dataTable = $table.DataTable({
      order: [[Object.keys(results[0]).length - 1, 'asc']],
      pageLength: 25
    });
    $loader.addClass('d-none');
    $datasetContent.removeClass('d-none');
  });
};

require.config({
  paths: {
    'ln': '/javascripts/line-navigator',
  },
  packages: [{
    name: 'codemirror',
    location: '/javascripts/codemirror/',
    main: 'lib/codemirror'
  }]
});

require([
  'ln/line-navigator.min', 'codemirror',
  'codemirror/mode/ecl/ecl',
  'codemirror/addon/selection/active-line'
], function(LineNavigator, CodeMirror) {
  let editor = null, $draggedObject = null;

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
      scrollbarStyle: 'null',
      theme: "darcula",
      tabSize: 2,
      gutters: ['CodeMirror-linenumbers', 'cm-errors'],
      value: [
        "PersonLayout := RECORD",
        "\tUNSIGNED1 PersonID;",
        "\tSTRING15 FirstName;",
        "\tSTRING25 LastName;",
        "END;",
        "",
        "Person := DATASET([",
        "\t{1, 'Fred', 'Smith'},",
        "\t{2, 'Joe', 'Blow'},",
        "\t{3, 'Jane', 'Doe'}",
        "], PersonLayout);",
        "",
        "SortedPerson := SORT(Person, LastName, FirstName);",
        "",
        "SortedPerson;"
      ].join("\n")
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
          $deleteWorkspace = $('.delete-workspace').parent(),
          $datasetContent = $('.dataset-content'),
          $tableWrapper = $datasetContent.find('.table-wrapper');

      evt.preventDefault();

      $datasetContent.addClass('d-none');
      $tableWrapper.html('');

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
              console.log('sprayed file', json.wuid);
              saveWorkunit(dataset.id, json.wuid);
            }).then(() => {
              addDataset(dataset);
              $newDataset = $datasets.children().last();
              $datasetStatus = $newDataset.find('.status');
              $datasetStatus.removeClass('d-none');

              showDatasets();
            }).then(() => {
              let _wuid = '';

              createWorkunit()
              .then(response => response.json())
              .then((json) => {
                _wuid = json.wuid;
                saveWorkunit(dataset.id, _wuid);
                $newDataset.data('wuid', _wuid);
              }).then(() => {
                let _query = dataset.name + ":=RECORD\n",
                    _keys = Object.keys(currentDatasetFile),
                    _avgs = Object.values(currentDatasetFile);

                $fileDetails.find('.form-group').each((idx, group) => {
                  _query += "\tSTRING" + _avgs[idx] + " " + $(group).children('input:eq(0)').val() + ";\n";
                });

                _query += "END;\nDS := DATASET('~#USERNAME#::" + $workspaceName + "::" +
                  dataset.filename + "'," + dataset.name + ",CSV(HEADING(1)));\nOUTPUT(DS,," +
                  "'~#USERNAME#::" + $workspaceName + "::" + dataset.filename + "_thor'" +
                  ",CLUSTER('mythor'),OVERWRITE);";

                console.log(_query);
                updateWorkunit(_wuid, _query).then(() => {
                  submitWorkunit(_wuid).then(() => {
                    console.log('check status of workunit');

                    $datasetStatus.addClass('fa-spin');

                    let t = null;

                    let awaitWorkunitStatusComplete = () => {
                      checkWorkunitStatus(_wuid)
                      .then(response => response.json())
                      .then((json) => {
                        if (json.state == 'completed' && json.results[0].logicalFile) {
                          $datasetStatus.removeClass('fa-spin');
                          dataset.logicalfile = json.results[0].logicalFile;

                          if (json.results[0].schema) {
                            dataset.rowCount = json.results[0].rows;
                            dataset.columnCount = json.results[0].columns;
                            dataset.eclSchema = JSON.stringify(json.results[0].schema);
                          }

                          fetch('/datasets/', {
                            method: 'PUT',
                            body: JSON.stringify(dataset),
                            headers:{
                              'Content-Type': 'application/json'
                            }
                          }).then(() => {
                            let $dataset = $('.datasets').children().last();
                            $dataset.find('.rows').text('Rows: ' + dataset.rowCount);
                            $dataset.find('.cols').text('Columns: ' + dataset.columnCount);
                            window.clearTimeout(t);
                          });
                        } else {
                          window.clearTimeout(t);
                          t = window.setTimeout(function() {
                            awaitWorkunitStatusComplete();
                          }, 1500);
                        }
                      });
                    };
                    awaitWorkunitStatusComplete();
                  });
                });

                $modal.modal('hide');
                $modal.find('#dataset-name').val('');
                $form.removeClass('was-validated');
              });
            });
          });
        }
      });
    });

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
          if (json.state == 'completed' && json.logicalFile) {
            $datasetStatus.removeClass('fa-spin');
            dataset.logicalfile = json.logicalFile;

            if (json.schema) {
              dataset.rowCount = json.rows;
              dataset.columnCount = json.columns;
              dataset.eclSchema = JSON.stringify(json.schema);
              dataset.eclQuery = json.query;
            }

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
          window.clearTimeout(t);
        });
      }, 1000);
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

          $newFormRow.append('<input type="text" class="form-control" value="' + label + '" />');
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
      let $this = $(this),
          $main = $('.dataset-content').parents('main');

      $this.addClass('active').siblings().removeClass('active');
      $main.removeClass('show-outputs');

      displayWorkunitResults($this.data('wuid'), $this.data('name'));
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

      if ($this.data('content')) {
        editor.getDoc().setValue($this.data('content'));
      } else {
        editor.getDoc().setValue('');
      }
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
        $newScript.data('id', script.data.id);
        $newScript.data('name', script.data.name);
        $newScript.find('.scriptname').text($newScript.data('name'));
        $scripts.append($newScript);
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
          $modal = $('#editScriptModal');

      evt.stopPropagation();

      //link.parentElement.removeChild(link);
      $modal.find('#edit-script-name').val($script.find('.scriptname').text());
      $modal.modal('show');
      console.log($script.index());
      $modal.find('.btn-primary').data('script', $script.index());
      console.log($modal.find('.btn-primary').data('script'));
    });

    /* EDIT SCRIPT */
    $('#editScriptModal').on('click', '.btn-primary', function(evt) {
      let $modal = $('#editScriptModal'),
          $scripts = $('.scripts'),
          $script = $scripts.children().eq($(this).data('script')),
          $workspaceId = $('.workspaces .dropdown-item.active').data('id'),
          $form = $modal.find('form'),
          data = getFormData($form);

      if ($form[0].checkValidity() === false) {
        evt.preventDefault();
        evt.stopPropagation();
        $form.addClass('was-validated');
        return false;
      }

      data.id = $script.data('id');
      data.prevName = $script.data('name');
      data.workspaceId = $workspaceId;
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
        $modal.modal('hide');
        $script.data('name', script.data.name);
        $script.find('.scriptname').text($script.data('name'));
        $modal.find('#edit-script-name').val('');
        $form.removeClass('was-validated');
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
          content: editor.getValue()
        }),
        headers:{
          'Content-Type': 'application/json'
        }
      })
      .then(response => response.json())
      .then((json) => {
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
          console.log(_query);
          updateWorkunit(_wuid, _query).then(() => {
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
                      let classList = ['output', 'text-light', 'badge', 'ml-2'];
                      if (idx == 0) classList.push('badge-primary');
                      else classList.push('badge-secondary');

                      $outputsList.append('<a href="#" class="' + classList.join(' ') + '">' + result.name + '</a>');
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

      let t = window.setTimeout(function() {
        fetch('/scripts/revision/', {
          method: 'POST',
          body: JSON.stringify({
            scriptId: $script.data('id'),
            content: editor.getValue()
          }),
          headers:{
            'Content-Type': 'application/json'
          }
        })
        .then(response => response.json())
        .then((json) => {
          $saveButton.contents()[0].nodeValue = 'SAVED';
          $script.data('revisionId', json.data.id);
          $script.data('content', json.data.content);
          $saveButton.attr('title', 'No Changes');
          window.clearTimeout(t);
        });
      }, 1000);
    });

    $outputsList.on('click', '.output', function(evt) {
      let $output = $(this),
          $script = $('.scripts .active');

      $output.addClass('badge-primary').removeClass('badge-secondary')
        .siblings().addClass('badge-secondary').removeClass('badge-primary');
      displayWorkunitResults($script.data('wuid'), $output.text(), $output.index());
    });

    $scriptPanelControls.on('click', '.js-close', function() {
      $('.script-panel-placeholder').addClass('d-none');
      $('.script-panel').addClass('d-none');
      $('.scripts .script').removeClass('active');
      $('.script-panel-controls .js-restore').removeClass('fa-window-restore').addClass('fa-window-maximize');
      $('.script-panel').removeClass('maximized').removeClass('minimized');
      $('#editor').removeClass('cmReady');
      $('.save-script').removeClass('badge-info').addClass('badge-secondary');
    });

    $scriptPanelControls.on('click', '.js-minimize', function() {
      if ($('.script-panel').hasClass('minimized') || $('.script-panel').hasClass('maximized')) return;

      $('.script-panel').addClass('minimized');
      if ($('.js-restore').hasClass('fa-window-maximize')) {
        $('.script-panel-controls .js-restore').removeClass('fa-window-maximize').addClass('fa-window-restore');
      } else {
        $('.script-panel-controls .js-restore').removeClass('fa-window-restore').addClass('fa-window-maximize');
      }
    });

    $scriptPanelControls.on('click', '.js-restore', function() {
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
      $('#editor').removeClass('cmReady');
      $('.save-script').removeClass('badge-info').addClass('badge-secondary');
      changeRunButtonState($('.run-script'), 'ready');
      editor.refresh();
    });

    editor.on('change', (instance, changeObj) => {
      let $saveButton = $('.save-script');

      if ($('#editor').hasClass('cmReady')) {
        $saveButton.attr('title', 'Save Script').removeClass('badge-secondary').addClass('badge-info');
        $saveButton.contents()[0].nodeValue = 'SAVE';
      }

      console.log(instance, changeObj);
      changeRunButtonState($('.run-script'), 'ready');
    });

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

      if ($draggedObject.data('query')) content = $draggedObject.data('query');
      else if ($draggedObject.data('content')) content = $draggedObject.data('content');

      doc.replaceRange(content, doc.getCursor());
      evt.preventDefault();
    });

    $(document).on('keydown', function(evt) {
      if (evt.ctrlKey && evt.keyCode == 80) {
        evt.preventDefault();
        $('.ctrl-p').toggleClass('d-none');
      }
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js', { scope: '/' })
        .then(function() { console.log('Service Worker Registered'); });
    }

  });

});
