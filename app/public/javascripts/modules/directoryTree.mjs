'use strict';

import { hostname } from './consts.mjs';

let renderTree = (subtree, type = 'scripts') => {
  let $ul = $('<ul>'),
      _subtree = subtree.map(el => { return el[1] }),
      folders = _subtree.filter(el => el.type == 'folder'),
      files = _subtree.filter(el => el.type == 'file');

  _.sortBy(folders, ['name']).forEach(_branch => {
    $ul.append(addFolder(_branch, type));
  });
  _.sortBy(files, ['name']).forEach(_branch => {
    if (type == 'scripts') {
      $ul.append(addScript(_branch));
    } else {
      $ul.append(addDataset(_branch));
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
  if (script.name.indexOf('.hsql') > -1) {
    $newScript.addClass('hsql');
  }
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
  $newDataset.data('logicalfile', dataset.logicalfile);
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
  $li.append('<a class="folder text-light' + ((branch.open) ? ' open' : '') + '"><span class="foldername">' +
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
          // console.log(workspace);
          let $newWorkspace = $workspaces.find('.cloner').clone();
          $newWorkspace.removeClass('d-none cloner');
          $newWorkspace.data('name', workspace.name || '');
          $newWorkspace.data('cluster', workspace.cluster || '');
          $newWorkspace.data('clusterUsername', workspace.clusterUser || '');
          $newWorkspace.data('clusterPassword', workspace.clusterPwd || '');
          $newWorkspace.data('id', workspace.id || '');
          $newWorkspace.data('directoryTree', workspace.directoryTree || '');
          $newWorkspace.text($newWorkspace.data('name'));
          $workspaces.append($newWorkspace);
        });

        loadWorkspace();
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

let populateDatasets = async () => {
  let url = new URL(hostname + '/datasets'),
      $activeWorkspace = $('.workspaces .active'),
      $datasets = $('.datasets'),
      $folders = $datasets.find('.folder'),
      $datasetLis = $datasets.find('.dataset:not(.cloner)'),
      params = { workspaceId: $activeWorkspace.data('id') };

  url.search = new URLSearchParams(params);
  return new Promise((resolve) => {
    fetch(url)
      .then(response => response.json())
      .then((datasets) => {
        // console.log('populateDatasets', datasets);

        if (Object.entries(datasets).length > 0) {
          $datasetLis.each((idx, el) => {
            let $dataset = $(el),
                _dataset = datasets[$dataset.data('id')];
            $dataset.data('query', _dataset.eclQuery);
            $dataset.data('wuid', _dataset.workunitId);
            $dataset.data('logicalfile', _dataset.logicalfile);
            $dataset.data('rows', _dataset.rowCount);
            $dataset.data('cols', _dataset.columnCount);
          });

          showDatasets();
        }
        resolve();
      });
  });
};

let showDatasets = () => {
  let $datasets = $('.datasets'),
      $datasetCollapser = $('#dataset-collapser');

  if (!$datasets.hasClass('show')) {
    $datasetCollapser.trigger('click');
  }
};

let populateScripts = async () => {
  let url = new URL(hostname + '/scripts'),
      $activeWorkspace = $('.workspaces .active'),
      $scripts = $('.scripts'),
      $folders = $scripts.find('.folder'),
      $scriptLis = $scripts.find('.script:not(.cloner)'),
      params = { workspaceId: $activeWorkspace.data('id') };

  url.search = new URLSearchParams(params);

  return new Promise((resolve) => {
    fetch(url)
      .then(response => response.json())
      .then((scripts) => {
        // console.log('populateScripts', scripts);

        if (Object.entries(scripts).length > 0) {
          $scriptLis.each((idx, el) => {
            let $script = $(el),
                _script = scripts[$script.data('id')];
            if (_script) {
              $script.data('revisionId', _script.revisionId);
              $script.data('content', _script.content);
              $script.data('cluster', _script.cluster);
              $script.data('parentPathNames', _script.path);
              $script.data('wuid', _script.workunitId);
            }
          });
          showScripts();
        }
        resolve();
      });
    });
};

let showScripts = () => {
  let $scripts = $('.scripts'),
      $scriptCollapser = $('#script-collapser');

  if (!$scripts.hasClass('show')) {
    $scriptCollapser.trigger('click');
  }
};

let loadWorkspace = () => {
  let workspaceId,
      qs = queryString.parse(window.location.search);
  if (qs.w) {
    workspaceId = qs.w;
  } else if (localStorage.getItem('_lastUsedWorkspace') != undefined) {
    workspaceId = localStorage.getItem('_lastUsedWorkspace');
  } else if ($('.workspace-load-msg.alert-info').length > 0) {
    workspaceId = $('.workspace-load-msg.alert-info').data('workspaceid');
  }
  if(workspaceId != undefined) {
    let $workspace = $('.workspaces .dropdown-item').filter(function() {
      return ($(this).data("id") == workspaceId ? true : false)
    });

    $($workspace[0]).addClass('active');
    if (window.location.search.replace('?w=', '') == '') {
      history.replaceState(null, null, '?w=' + workspaceId);
    }
    $('.workspaces .dropdown-item.active').trigger("click");
  }
}

export {
  renderTree, addScript, addDataset, addFolder, populateWorkspaces,
  populateWorkspaceDirectoryTree, populateDatasets, showDatasets,
  populateScripts, showScripts,
};