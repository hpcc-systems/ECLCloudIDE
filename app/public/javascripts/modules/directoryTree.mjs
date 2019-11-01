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

export { renderTree, addScript, addDataset, addFolder };