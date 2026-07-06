module.exports = [
  {
    type: 'heading',
    defaultValue: 'NEXT LEG',
    size: 1
  },
  {
    type: 'text',
    defaultValue: 'Your AeroAPI key and schedule stay on the phone. Only current flight information is sent to the watch.'
  },
  {
    type: 'section',
    items: [
      {
        type: 'input',
        messageKey: 'AeroApiKey',
        label: 'FlightAware AeroAPI Key',
        defaultValue: '',
        attributes: {
          type: 'password',
          placeholder: 'Your personal AeroAPI key'
        }
      },
      {
        type: 'input',
        messageKey: 'AirlineCode',
        label: 'Default Airline Code',
        defaultValue: 'AA',
        attributes: {
          type: 'text',
          placeholder: 'Example: AA',
          limit: 3
        }
      },
      {
        type: 'input',
        messageKey: 'ReportLeadTime',
        label: 'Report Lead Time (HHMM)',
        defaultValue: '0100',
        attributes: {
          type: 'text',
          placeholder: '0100',
          limit: 4
        }
      },
      {
        type: 'scheduletextarea',
        messageKey: 'ScheduleText',
        label: 'Paste Schedule',
        defaultValue: '',
        description: 'One flight per line: DD FLIGHT ORIGIN DEP DEST ARR',
        attributes: {
          rows: 14,
          placeholder: '03 1972 DFW 1730 LAX 1844',
          autocapitalize: 'characters',
          autocorrect: 'off',
          spellcheck: 'false'
        }
      },
      {
        type: 'button',
        id: 'clear-schedule',
        defaultValue: 'CLEAR SCHEDULE',
        primary: false,
        description: 'Clears the box. Tap Save Settings to apply.'
      }
    ]
  },
  {
    type: 'submit',
    defaultValue: 'Save Settings'
  }
];
