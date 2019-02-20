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
        let $newScript = $scripts.find('.cloner').clone();

        $newScript.removeClass('d-none cloner');
        $newScript.data('id', script.id);
        $newScript.data('name', script.name);
        $newScript.find('.scriptname').text(script.name);
        $scripts.append($newScript);
      });

      if (scripts.length > 0) {
        showScripts();
      }
    });
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

    populateWorkspaces();

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

      populateScripts();
      toggleNewScriptPopover();
    });

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

    $('.datasets').on('click', '.dataset', function(evt) {
      let $this = $(this);
      console.log($this);
    });

    $('#dataset-file').on('change', function(evt) {
      let file = evt.target.files[0],
          fileName = '',
          ln = new LineNavigator(file);

      if (!file) {
        alert('Please select a file');
        return false;
      }

      file.name.substr(0, file.name.lastIndexOf('.')).replace(/-_\s/g, '_').split('_').map((word) => {
        fileName += word.substr(0, 1).toUpperCase() + word.substr(1).toLowerCase();
      });
      fileName.trim();

      console.log(file, fileName);

      $('#dataset-name').val(fileName);

      ln.readLines(0, 2, (err, idx, lines, isEof, progress) => {
        console.log(lines);
        let labels = lines[0].split(','),
            values = lines[1].split(',');
      });
    });

    $('.datasets').on('click', '.dataset .delete', function(evt) {
      let $this = $(this),
          $dataset = $this.parents('.dataset'),
          $modal = $('#removeDatasetModal');

      //link.parentElement.removeChild(link);
      $modal.find('.datasetname').text($dataset.find('.datasetname').text());
      $modal.modal('show');
      console.log($dataset.index());
      $modal.find('.btn-danger').data('dataset', $dataset.index());
      console.log($modal.find('.btn-danger').data('dataset'));
    });

    $('#removeDatasetModal').on('click', '.btn-danger', function(evt) {
      let $this = $(this),
          $modal = $('#removeDatasetModal'),
          $datasets = $('.datasets');

      $datasets.children().eq($this.data('dataset')).remove();
      $modal.modal('hide');
    });

    $('.scripts').on('click', '.script', function(evt) {
      let $this = $(this);
      $this.siblings().removeClass('active');
      $this.addClass('active');
    });

    toggleNewScriptPopover();

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

  });

});
