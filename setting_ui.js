module.exports = function(minified) {
  var clayConfig = this;

  clayConfig.on(clayConfig.EVENTS.AFTER_BUILD, function() {
    var scheduleBox =
      clayConfig.getItemByMessageKey('ScheduleText');

    var clearButton =
      clayConfig.getItemById('clear-schedule');

    if (!scheduleBox || !clearButton) {
      return;
    }

    clearButton.on('click', function() {
      scheduleBox.set('');
      scheduleBox.trigger('change');
    });
  });
};
