module.exports = {
  name: 'scheduletextarea',

  template:
    '<div class="component component-scheduletextarea">' +
      '<label class="tap-highlight schedule-label">' +
        '<span class="label">{{{label}}}</span>' +
      '</label>' +
      '<span class="input schedule-input">' +
        '<textarea data-manipulator-target ' +
          '{{each key: attributes}}{{key}}="{{this}}"{{/each}}' +
        '></textarea>' +
      '</span>' +
      '{{if description}}' +
        '<div class="description">{{{description}}}</div>' +
      '{{/if}}' +
    '</div>',

  style:
    '.component-scheduletextarea {' +
      'width: 100%;' +
    '}' +

    '.component-scheduletextarea .schedule-label {' +
      'display: block !important;' +
      'width: 100% !important;' +
      'margin-bottom: 10px;' +
    '}' +

    '.component-scheduletextarea .label {' +
      'display: block !important;' +
      'width: 100% !important;' +
    '}' +

    '.component-scheduletextarea .schedule-input {' +
      'display: block !important;' +
      'width: 100% !important;' +
    '}' +

    '.component-scheduletextarea textarea {' +
      'display: block !important;' +
      'box-sizing: border-box !important;' +
      'width: 100% !important;' +
      'height: 250px;' +
      'min-height: 250px;' +
      'padding: 10px;' +
      'font-family: monospace;' +
      'font-size: 14px;' +
      'line-height: 18px;' +
      'resize: vertical;' +
    '}',

  manipulator: 'val',

  defaults: {
    label: '',
    description: '',
    attributes: {}
  }
};
