'use strict';

import { hostname } from './consts.mjs';

let renderTree = (subtree, type = 'scripts') => {
  let $ul = $('<ul>');
  subtree.forEach((_branch) => {
    if (_branch[1].type == 'folder') {
      $ul.append(addFolder(_branch[1], type));
    } else {
      if (type == 'scripts') {
        $ul.append(addScript(_branch[1]));
      } else {
        $ul.append(addDataset(_branch[1]));
      }
    }
  });
  return $ul;
};

let addScript = (script) => {
  let $scripts = $('.scripts'),
      $newLi = $('<li>'),
      $newScript = $scripts.find('.cloner').clone();

  $newScript.removeClass('d-none cloner');
  $newScript.data('id', script.id);
  $newScript.data('name', script.name);
  $newScript.data('revisionId', script.revisionId);
  $newScript.data('content', script.content);
  $newScript.data('parentPathNames', script.parentPathNames);
  $newScript.data('wuid', '');
  $newScript.find('.scriptname').contents()[0].nodeValue = script.name;

  $newLi.append($newScript);

  return $newLi;
};

let addDataset = (dataset) => {
  let $datasets = $('.datasets'),
      $newLi = $('<li>'),
      $newDataset = $datasets.find('.cloner').clone();

  $newDataset.removeClass('d-none cloner');
  $newDataset.data('id', dataset.id);
  $newDataset.data('name', dataset.name);
  $newDataset.data('wuid', dataset.workunitId);
  $newDataset.data('rows', dataset.rowCount);
  $newDataset.data('cols', dataset.columnCount);
  $newDataset.data('query', dataset.eclQuery);
  $newDataset.find('.datasetname').contents()[0].nodeValue = dataset.name;

  $newLi.append($newDataset);

  return $newLi;
};

let addFolder = (branch, type) => {
  let $li = $('<li>');
  $li.data('name', branch.name);
  $li.data('id', branch.id);
  $li.data('type', type);
  $li.append('<a class="folder text-light"><span class="foldername">' +
    branch.name + '</span>' +
    '<i class="float-right fa fa-close delete d-none" title="Delete folder"></i>' +
    '<i class="float-right fa fa-pencil-square-o edit d-none mr-1" title="Edit folder"></i>' +
    '</a>');
  if (Object.entries(branch.children).length > 0) {
    $li.append(renderTree(Object.entries(branch.children), type));
  }
  return $li;
};

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
          $newWorkspace.data('cluster', workspace.cluster);
          $newWorkspace.data('id', workspace.id);
          $newWorkspace.data('directoryTree', workspace.directoryTree);
          $newWorkspace.text($newWorkspace.data('name'));
          $workspaces.append($newWorkspace);
        });
      }
    });
};

let populateWorkspaceDirectoryTree = (tree) => {
  let datasets = tree.datasets,
      scripts = tree.scripts,
      $datasetsTreeRoot = $('.datasets'),
      $scriptsTreeRoot = $('.scripts');

  $datasetsTreeRoot.children('ul').remove();
  $scriptsTreeRoot.children('ul').remove();

  let $datasetsUl = renderTree(Object.entries(tree.datasets), 'datasets'),
      $scriptsUl = renderTree(Object.entries(tree.scripts));

  $datasetsUl.removeClass('d-none');
  $scriptsUl.removeClass('d-none');

  $datasetsTreeRoot.append($datasetsUl);
  $scriptsTreeRoot.append($scriptsUl);
};

let populateDatasets = () => {
  let url = new URL(hostname + '/datasets'),
      $activeWorkspace = $('.workspaces .active'),
      $datasets = $('.datasets'),
      $folders = $datasets.find('.folder'),
      $datasetLis = $datasets.find('.dataset:not(.cloner)'),
      params = { workspaceId: $activeWorkspace.data('id') };

  url.search = new URLSearchParams(params);

  fetch(url)
    .then(response => response.json())
    .then((datasets) => {
      console.log('populateDatasets', datasets);

      if (Object.entries(datasets).length > 0) {
        $datasetLis.each((idx, el) => {
          let $dataset = $(el),
              _dataset = datasets[$dataset.data('id')];
          $dataset.data('query', _dataset.eclQuery);
          $dataset.data('wuid', _dataset.workunitId);
          $dataset.data('rows', _dataset.rowCount);
          $dataset.data('cols', _dataset.columnCount);
        }).promise().done(function() {
          showDatasets();
        });
      }
    });
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
      $folders = $scripts.find('.folder'),
      $scriptLis = $scripts.find('.script:not(.cloner)'),
      params = { workspaceId: $activeWorkspace.data('id') };

  url.search = new URLSearchParams(params);

  fetch(url)
    .then(response => response.json())
    .then((scripts) => {
      console.log('populateScripts', scripts);

      if (Object.entries(scripts).length > 0) {
        $scriptLis.each((idx, el) => {
          let $script = $(el),
              _script = scripts[$script.data('id')];
          if (_script) {
            $script.data('revisionId', _script.revisionId);
            $script.data('content', _script.content);
            $script.data('parentPathNames', _script.parentPathNames);
            $script.data('wuid', _script.workunitId);
          }
        }).promise().done(function() {
          showScripts();
        });
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

export {
  renderTree, addScript, addDataset, addFolder, populateWorkspaces,
  populateWorkspaceDirectoryTree, populateDatasets, showDatasets,
  populateScripts, showScripts,
};