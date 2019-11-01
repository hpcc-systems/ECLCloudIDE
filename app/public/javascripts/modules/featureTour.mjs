'use strict';

let tour = new Shepherd.Tour({
  defaultStepOptions: {
    classes: 'shadow-md bg-purple-dark',
    scrollTo: { behavior: 'smooth', block: 'center' },
    showCancelLink: true,
    when: {
      show: function() {
        $('.shepherd-element').find('video').trigger('play');
      },
      hide: function() {
        $('.shepherd-element').find('video').trigger('pause');
      }
    },
    shepherdElementMaxWidth: '500px'
  },
  useModalOverlay: true,
  steps: [{
    id: 'workspace-step',
    title: 'Create a Workspace',
    text: `
      First, create a new workspace to contain your<br />uploaded data files and ECL scripts.<br /></br />
      <video muted autoplay loop width="600">
        <source src="/videos/create-workspace.webm" type="video/webm" />
        An HTML5 video tag showing the creation of a workspace.
      </video>
    `,
    attachTo: {
      element: '.navbar-nav',
    },
    buttons: [
      { text: 'Exit', secondary: true, action: function() { return this.cancel(); } },
      { text: 'Next', secondary: false, action: function() { return this.next(); } }
    ]
  }, {
    id: 'datasets-step',
    title: 'Upload a CSV',
    text: `
      Then upload a CSV file containing some data. The first<br />row of the file
      should contain column headings.<br /><br />
      <video muted autoplay loop width="600">
        <source src="/videos/add-dataset.webm" type="video/webm" />
        An HTML5 video tag showing uploading a CSV dataset.
      </video>
    `,
    attachTo: {
      element: '#datasets-wrapper'
    },
    buttons: [
      { text: 'Back', secondary: true, action: function() { return this.back(); } },
      { text: 'Next', secondary: false, action: function() { return this.next(); } }
    ]
  }, {
    id: 'scripts-step',
    title: 'Create an ECL Script',
    text: `
      Create a new script, add some ECL, and run that code<br />on the Workspace's cluster.<br /><br />
      <video muted autoplay loop width="600">
        <source src="/videos/add-script.webm" type="video/webm" />
        An HTML5 video tag showing creating and executing an ECL script.
      </video>
    `,
    attachTo: {
      element: '#scripts-wrapper'
    },
    buttons: [
      { text: 'Back', secondary: true, action: function() { return this.back(); } },
      { text: 'Done', secondary: false, action: function() { return this.next(); } }
    ]
  }]
});

export { tour };