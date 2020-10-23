const template = document.createElement('template');
template.innerHTML = `
  <link rel="stylesheet" href="/components/file-explorer/stylesheets/file-explorer.css" />

  <div class="file-explorer">
    <div class="filter-wrapper">
      <input type="text" class="filter" placeholder="type to filter..." />
      <svg width="1em" height="1em" class="clear-filter d-none" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <title>Clear filter</title>
        <path fill-rule="evenodd" d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/>
      </svg>
    </div>
    <div class="file-list">
      <ul></ul>
    </div>
  </div>
`;

const debounce = (func, wait, immediate) => {
  let timeout = null;
  return function() {
    let context = this,
        args = arguments;
        later = () => {
          if (!immediate) func.apply(context, args);
        },
        callNow = immediate && !timeout;

    window.clearTimeout(timeout);
    timeout = window.setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
};

const setAttributes = (el, attrs) => {
  for (let key in attrs) {
    el.setAttribute('hpcc__' + key, attrs[key]);
  }
};

class FileExplorer extends HTMLElement {

  constructor() {
    super();

    this.scopeRoot = null;
    this.filter = null;
    this.clear = null;

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
  }

  static get observedAttributes() { return ['cluster']; }

  async fetchScope(scope) {
    return new Promise((resolve, reject) => {
      fetch(this.cluster + '/WsDfu/DFUFileView.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
         "DFUFileViewRequest": {
           "Scope": scope,
           "IncludeSuperOwner": false
         }
        })
      }).then(async response => {
        let json = await response.json();
        resolve(json.DFUFileViewResponse);
      }).catch(err => {
        this.displayErrorMsg(`Could not communicate with cluster ${this.cluster}`);
        console.error(err);
        reject({});
      })
    });
  }

  renderScopes(scopes, target) {
    scopes.DFULogicalFiles.DFULogicalFile.forEach(scope => {
      let li = document.createElement('li');
      target.appendChild(li);
      if (scope.isDirectory) {
        li.innerText = scope.Directory;
        li.classList.add('directory');
        li.setAttribute('scope', ((scopes.Scope) ? scopes.Scope + '::' : '') + scope.Directory);
        li.setAttribute('expanded', '');
        setAttributes(li, scope);
      } else {
        li.innerText = scope.Name.replace(scopes.Scope + '::', '');
        li.classList.add('file');
        li.setAttribute('draggable', 'true');
        li.setAttribute('scope', scope.Name.replace(scopes.Scope + '::', ''));
        setAttributes(li, scope);
      }
    });
  }

  displayErrorMsg (msg = 'Cluster attribute must be defined') {
    let msgEl = document.createElement('p');
    msgEl.innerText = msg;
    this.shadowRoot.querySelector('.file-explorer').appendChild(msgEl);
  }

  async scopeClick(evt) {
    if (evt.target.hasAttribute('expanded') == false) {
      let _attributes = {};
      for (let i = 0, atts = evt.target.attributes; i < atts.length; i++) {
        let key = atts[i].nodeName;
        if (key.indexOf('hpcc__') > -1) {
          _attributes[key.replace('hpcc__', '')] = evt.target.getAttribute(key);
        }
      }

      this.shadowRoot.querySelectorAll('li').forEach(el => {
        el.classList.remove('active');
      });
      if (evt.target.classList.contains('file')) {
        evt.target.classList.add('active');
      }

      const _evt = new CustomEvent('file-selected', {
        detail: _attributes,
        bubbles: true
      });
      this.dispatchEvent(_evt);
      return;
    }

    if (evt.target.getAttribute('expanded') == false) {
      evt.target.setAttribute('expanded', 'expanded');
      evt.target.classList.add('expanded');
      let scope = evt.target.getAttribute('scope'),
          ul = evt.target.querySelector('ul');
      if (!ul) {
        ul = document.createElement('ul');
        evt.target.appendChild(ul);
        let _scopes = await this.fetchScope(scope);
        this.renderScopes(_scopes, ul);
      } else {
        ul.classList.remove('d-none');
      }
    } else {
      evt.target.setAttribute('expanded', '');
      evt.target.classList.remove('expanded');
      let ul = evt.target.querySelector('ul');
      ul.classList.add('d-none');
    }
  }

  filterKeyup() {
    let lis = this.shadowRoot.querySelectorAll('li');

    if (!this.filter.value) {
      this.clear.classList.add('d-none');
      lis.forEach(li => {
        li.classList.remove('d-none');
      })
      return;
    }

    if (this.filter.value.length <= 2) return;

    this.clear.classList.remove('d-none');
    lis.forEach(li => {
      let name = li.getAttribute('hpcc__name'),
          scope = li.getAttribute('scope'),
          pattern = scope,
          isDir = li.getAttribute('hpcc__isdirectory'),
          _filter = this.filter.value.split('::').filter(n => n),
          regex = new RegExp(_filter.map((n, idx) => {
            if (idx == 0) return n + '.*';
            return '::' + n + '.*';
          }).join(''));

      if (isDir == 'false') {
        pattern = name;
      }

      if (!pattern.match(regex)) {
        li.classList.add('d-none');
      } else {
        if (isDir == 'true' && !li.classList.contains('expanded')) {
          const event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true
          });
          li.dispatchEvent(event);
        }
        li.classList.remove('d-none');
        let parent = li.parentElement;
        while (!parent.classList.contains('file-list')) {
          parent.classList.remove('d-none');
          parent = parent.parentElement;
        }
      }
    })
  }

  clearClick() {
    if (this.filter.value > '') {
      this.filter.value = '';
      this.clear.classList.add('d-none');
      const event = new KeyboardEvent('keyup', {
        key: '',
        char: '',
        bubbles: true,
        cancelable: true
      });
      this.filter.dispatchEvent(event);
    }
  }

  async connectedCallback() {
    this.cluster = this.getAttribute('cluster');
    this.scopeRoot = this.shadowRoot.querySelector('.file-explorer ul');

    this.filter = this.shadowRoot.querySelector('.filter');
    this.clear = this.shadowRoot.querySelector('.clear-filter');

    if (!this.cluster) {
      this.displayErrorMsg();
      return;
    }

    let height = this.getAttribute('height')
    if (height) {
      this.shadowRoot.host.style.setProperty('--height', height);
    }

    let scopes = await this.fetchScope('');
    this.renderScopes(scopes, this.scopeRoot);

    this.scopeRoot.addEventListener('click', this.scopeClick.bind(this));

    this.filter.addEventListener('keyup', debounce(this.filterKeyup.bind(this), 400));

    this.clear.addEventListener('click', this.clearClick.bind(this));

    this.shadowRoot.addEventListener('mouseover', (evt) => {
      if (evt.target.nodeName == 'LI') {
        evt.target.style['background-color'] = 'var(--hoverColor)';
      }
    });

    this.shadowRoot.addEventListener('mouseout', (evt) => {
      evt.target.style['background-color'] = '';
    });

    this.shadowRoot.addEventListener('dragstart', (evt) => {
      evt.dataTransfer.effectAllowed = 'move';
      let _attributes = {};
      for (let i = 0, atts = evt.target.attributes; i < atts.length; i++) {
        let key = atts[i].nodeName;
        if (key.indexOf('hpcc__') > -1) {
          _attributes[key.replace('hpcc__', '')] = evt.target.getAttribute(key);
        }
      }
      evt.dataTransfer.setData('text/plain', JSON.stringify(_attributes));
    });
  } //end function connectedCallback

  async attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'cluster') {
      this.cluster = newValue;
      let scopes = await this.fetchScope('');
      this.scopeRoot.innerHTML = '';
      this.renderScopes(scopes, this.scopeRoot);
    }
  }

}

customElements.define('file-explorer', FileExplorer);