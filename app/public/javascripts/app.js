'use strict';

require.config({
  paths: {
    'vs': '/javascripts/monaco-editor/min/vs',
  }
});

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

let toggleNewScriptPopover = () => {
   let $workspaceSelect = $('#workspaceSelect'),
       $newScript = $('#new-script');

    if ($workspaceSelect.text() == NO_WORKSPACE) {
      $newScript.attr('data-toggle', 'popover');
      $newScript.attr('title', 'Select a Workspace');
      $newScript.attr('data-content', 'Create a new Workspace or select one of your existing Workspaces');
      $newScript.attr('data-placement', 'right');
      $newScript.attr('data-boundary', 'window');

      $newScript.popover({ trigger: 'focus' });
      $newScript.popover('enable');
    } else {
      $newScript.attr('data-toggle', 'modal');
      $newScript.attr('title', 'New Script...');
      $newScript.removeAttr('data-content');
      $newScript.removeAttr('data-placement');
      $newScript.removeAttr('data-boundary');

      $newScript.popover('disable');
    }
};

const NO_WORKSPACE = 'Select Workspace...';

let getFormData = ($form) => {
  let arr = $form.serializeArray(),
      result = {};

  $.map(arr, (el, idx) => { result[el['name']] = el['value'] });

  return result;
};

require(['vs/editor/editor.main'], function(monaco) {
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
          $deleteWorkspace = $('.delete-workspace').parent();

      evt.preventDefault();

      $options.removeClass('active');
      $this.addClass('active');
      $selected.text($this.text());
      $deleteWorkspace.removeClass('d-none');

      toggleNewScriptPopover();
    });

    $('#removeWorkspaceModal').on('click', '.btn-danger', function(evt) {
      let $modal = $('#removeWorkspaceModal'),
          $workspaces = $('.workspaces'),
          $deleteWorkspace = $('.delete-workspace').parent(),
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
        $deleteWorkspace.addClass('d-none');
        $workspaceSelect.text(NO_WORKSPACE);

        if ($workspaces.find('.dropdown-item:not(.cloner)').length == 0) {
          $('.workspace-tip').removeClass('d-none');
        }

        toggleNewScriptPopover();
      });
    });

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

    $('.datasets').on('click', '.dataset', function(evt) {
      let $this = $(this);
      console.log($this);
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

    toggleNewScriptPopover();

    $('#newScriptModal').on('click', '.btn-primary', function(evt) {
      let $modal = $('#newScriptModal'),
          $scripts = $('.scripts'),
          $workspaceId = $('.workspaces .dropdown-item.active').data('id'),
          $newScript = $scripts.find('.cloner').clone(),
          $scriptCollapser = $('#script-collapser'),
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
        $newScript.find('.scriptname').text($modal.find('#script-name').val());
        $scripts.append($newScript);
        $modal.find('#script-name').val('');
        $form.removeClass('was-validated');

        if (!$scripts.hasClass('show')) {
          $scriptCollapser.trigger('click');
        }

        $newScript.trigger('click');
      });
    });

    $('#removeScriptModal').on('click', '.btn-danger', function(evt) {
      let $this = $(this),
          $modal = $('#removeScriptModal'),
          $scriptPanelClose = $('.js-close'),
          $scripts = $('.scripts');

      if ($scripts.children().eq($this.data('script')).hasClass('active')) {
        $scriptPanelClose.trigger('click');
      }

      $scripts.children().eq($this.data('script')).remove();
      $modal.modal('hide');
    });

    if ($('.table').length > 0) {
      $('.table').DataTable();
    }

    $('.script-panel-controls').on('click', '.js-close', function() {
      $('.script-panel-placeholder').addClass('d-none');
      $('.script-panel').addClass('d-none');
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
