var Clay = require('@rebble/clay');
var clayConfig = require('./config');
var scheduleTextarea = require('./schedule_textarea');
var settingsUi = require('./settings_ui');

var clay = new Clay(clayConfig, settingsUi, {
  autoHandleEvents: false
});

clay.registerComponent(scheduleTextarea);

var DAY_MS = 24 * 60 * 60 * 1000;
var HOTEL_HOLD_MS = 2 * 60 * 60 * 1000;
var PRELOAD_WINDOW_MS = 6 * 60 * 60 * 1000;
var REFRESH_COOLDOWN_MS = 60 * 1000;
var AEROAPI_BASE = 'https://aeroapi.flightaware.com/aeroapi';
var STATE_VERSION = '12';

function getClayValue(settings, key) {
  if (settings[key] && settings[key].value !== undefined) {
    return String(settings[key].value);
  }

  return '';
}

function pad2(value) {
  return value < 10 ? '0' + value : String(value);
}

function normaliseAirlineCode(raw) {
  return String(raw || '').replace(/\s+/g, '').toUpperCase();
}

function normaliseFlightNumber(rawFlight, defaultAirlineCode) {
  var flight = String(rawFlight || '').replace(/\s+/g, '').toUpperCase();

  if (/^\d{1,5}[A-Z]?$/.test(flight)) {
    return defaultAirlineCode + flight;
  }

  return flight;
}

function isAirportCode(value) {
  return /^[A-Z]{3}$/.test(value);
}

function isValidFlightToken(value) {
  return /^\d{1,5}[A-Z]?$/.test(value) ||
    /^[A-Z0-9]{2,3}\d{1,5}[A-Z]?$/.test(value);
}

function parseTime(timeText) {
  if (!/^\d{3,4}$/.test(timeText)) {
    return null;
  }

  var padded = timeText.length === 3 ? '0' + timeText : timeText;
  var hour = parseInt(padded.substring(0, 2), 10);
  var minute = parseInt(padded.substring(2, 4), 10);

  if (hour > 23 || minute > 59) {
    return null;
  }

  return {
    hour: hour,
    minute: minute,
    display: padded.substring(0, 2) + ':' + padded.substring(2, 4)
  };
}

function parseReportLeadMinutes(raw) {
  var clean = String(raw || '').replace(/\D/g, '');

  if (!clean || clean.length > 4) {
    return 60;
  }

  while (clean.length < 4) {
    clean = '0' + clean;
  }

  var hours = parseInt(clean.substring(0, 2), 10);
  var minutes = parseInt(clean.substring(2, 4), 10);

  if (hours > 23 || minutes > 59) {
    return 60;
  }

  return (hours * 60) + minutes;
}

function getReportLeadMinutes() {
  var saved = parseInt(
    localStorage.getItem('nextleg_report_lead_minutes'),
    10
  );

  return isNaN(saved) ? 60 : saved;
}

function timeToMinutes(timeText) {
  var parts = timeText.split(':');

  return (parseInt(parts[0], 10) * 60) +
    parseInt(parts[1], 10);
}

function minutesToTime(minutes) {
  while (minutes < 0) {
    minutes += 24 * 60;
  }

  minutes = minutes % (24 * 60);

  return pad2(Math.floor(minutes / 60)) +
    ':' + pad2(minutes % 60);
}

function reportTimeForLeg(leg) {
  return minutesToTime(
    timeToMinutes(leg.scheduledDeparture) -
      getReportLeadMinutes()
  );
}

function addDelayToTime(timeText, delaySeconds) {
  return minutesToTime(
    timeToMinutes(timeText) +
      Math.round(delaySeconds / 60)
  );
}

function dateKeyFromParts(year, month, day) {
  return year + '-' + pad2(month + 1) + '-' + pad2(day);
}

function addDaysToDateKey(dateKey, days) {
  var parts = dateKey.split('-');

  var date = new Date(Date.UTC(
    parseInt(parts[0], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[2], 10)
  ));

  date.setUTCDate(date.getUTCDate() + days);

  return date.getUTCFullYear() + '-' +
    pad2(date.getUTCMonth() + 1) + '-' +
    pad2(date.getUTCDate());
}

function parseSchedule(scheduleText, defaultAirlineCode) {
  var lines = String(scheduleText || '').split(/\r?\n/);
  var legs = [];

  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth();

  for (var i = 0; i < lines.length; i++) {
    var clean = lines[i].toUpperCase().replace(/\s+/g, ' ').trim();

    if (!clean || clean.charAt(0) === '#') {
      continue;
    }

    var tokens = clean.split(' ');

    if (tokens.length < 6) {
      continue;
    }

    var dayText = tokens[0];
    var rawFlight = tokens[1];
    var origin = tokens[2];
    var departureText = tokens[3];
    var destination = tokens[4];
    var arrivalText = tokens[5];

    if (!/^\d{1,2}$/.test(dayText)) {
      continue;
    }

    if (!isValidFlightToken(rawFlight)) {
      continue;
    }

    if (!isAirportCode(origin) || !isAirportCode(destination)) {
      continue;
    }

    var departure = parseTime(departureText);
    var arrival = parseTime(arrivalText);

    if (!departure || !arrival) {
      continue;
    }

    var day = parseInt(dayText, 10);
    var testDate = new Date(year, month, day);

    if (day < 1 || testDate.getMonth() !== month) {
      continue;
    }

    var departureApprox = new Date(
      year,
      month,
      day,
      departure.hour,
      departure.minute,
      0,
      0
    );

    var arrivalApprox = new Date(
      year,
      month,
      day,
      arrival.hour,
      arrival.minute,
      0,
      0
    );

    if (arrivalApprox.getTime() <= departureApprox.getTime()) {
      arrivalApprox = new Date(arrivalApprox.getTime() + DAY_MS);
    }

    legs.push({
      dateKey: dateKeyFromParts(year, month, day),
      flightNumber: normaliseFlightNumber(
        rawFlight,
        defaultAirlineCode
      ),
      origin: origin,
      destination: destination,
      route: origin + ' > ' + destination,
      scheduledDeparture: departure.display,
      scheduledArrival: arrival.display,
      departureApproxMillis: departureApprox.getTime(),
      arrivalApproxMillis: arrivalApprox.getTime()
    });
  }

  legs.sort(function(a, b) {
    return a.departureApproxMillis - b.departureApproxMillis;
  });

  return legs;
}

function getLegs() {
  return parseSchedule(
    localStorage.getItem('nextleg_schedule') || '',
    localStorage.getItem('nextleg_airline_code') || ''
  );
}

function getActiveIndex() {
  var value = parseInt(
    localStorage.getItem('nextleg_active_index'),
    10
  );

  return isNaN(value) ? -1 : value;
}

function setActiveIndex(index) {
  localStorage.setItem('nextleg_active_index', String(index));
}

function clearActiveIndex() {
  localStorage.removeItem('nextleg_active_index');
}

function getHeldArrivalMillis() {
  var value = parseInt(
    localStorage.getItem('nextleg_active_actual_in'),
    10
  );

  return isNaN(value) ? 0 : value;
}

function setHeldArrivalMillis(value) {
  localStorage.setItem(
    'nextleg_active_actual_in',
    String(value)
  );
}

function clearHeldArrivalMillis() {
  localStorage.removeItem('nextleg_active_actual_in');
}

function cacheActiveDisplay(gate, departureTime, status) {
  localStorage.setItem('nextleg_active_gate', gate || '--');
  localStorage.setItem('nextleg_active_dep', departureTime || '--');
  localStorage.setItem('nextleg_active_status', status || '--');
}

function clearActiveDisplayCache() {
  localStorage.removeItem('nextleg_active_gate');
  localStorage.removeItem('nextleg_active_dep');
  localStorage.removeItem('nextleg_active_status');
}

function getCachedGate() {
  return localStorage.getItem('nextleg_active_gate') || '--';
}

function getCachedDeparture() {
  return localStorage.getItem('nextleg_active_dep') || '--';
}

function getCachedStatus() {
  return localStorage.getItem('nextleg_active_status') || '--';
}

function resetActiveState() {
  clearActiveIndex();
  clearHeldArrivalMillis();
  clearActiveDisplayCache();
}

function isLastFlightOfDay(legs, index) {
  return index >= legs.length - 1 ||
    legs[index].dateKey !== legs[index + 1].dateKey;
}

function isMoreThanSixHoursAway(leg) {
  return leg.departureApproxMillis >
    Date.now() + PRELOAD_WINDOW_MS;
}

function isTooOldToQuery(leg) {
  return leg.arrivalApproxMillis <
    Date.now() - (10 * DAY_MS);
}

// A schedule entry from a completed prior calendar day must never become
// the active leg again. This check uses the parsed day/date, not merely the
// clock time, so a July 2 flight cannot be selected on July 4.
//
// A leg that crosses midnight is retained until its calculated arrival date,
// allowing an overnight flight from yesterday to remain eligible today.
function isCompletedPreviousScheduleDay(leg) {
  var now = new Date();
  var todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  ).getTime();

  return leg.arrivalApproxMillis < todayStart;
}

// A previous calendar day is stale only when FlightAware cannot confirm
// that the flight is still active. This keeps the schedule from freezing
// on an old leg when AeroAPI has no matching historical record.
function todayDateKey() {
  var now = new Date();

  return dateKeyFromParts(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
}

function isHistoricalScheduleDay(leg) {
  return leg.dateKey < todayDateKey();
}

function shouldAdvanceAfterMissingFlight(leg) {
  return isHistoricalScheduleDay(leg);
}

function sendWatchMessage(
  flightNumber,
  route,
  gate,
  departureTime,
  status
) {
  Pebble.sendAppMessage({
    FlightNumber: flightNumber || '--',
    Route: route || '--',
    Gate: gate || '--',
    DepartureTime: departureTime || '--',
    FlightStatus: status || '--'
  });
}

function sendNoSchedule() {
  sendWatchMessage(
    'NO FLT',
    'NO SCHEDULE',
    '--',
    '--',
    '--'
  );
}

function sendReportMode(leg) {
  sendWatchMessage(
    'REPORT',
    reportTimeForLeg(leg),
    '--',
    '--',
    '--'
  );
}

function sendScheduledLeg(leg, status) {
  sendWatchMessage(
    leg.flightNumber,
    leg.route,
    '--',
    leg.scheduledDeparture,
    status || '--'
  );
}

function airportMatches(airportRef, wantedCode) {
  if (!airportRef) {
    return false;
  }

  var wanted = wantedCode.toUpperCase();
  var candidates = [
    airportRef.code,
    airportRef.code_iata,
    airportRef.code_icao,
    airportRef.code_lid
  ];

  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i] &&
        String(candidates[i]).toUpperCase() === wanted) {
      return true;
    }
  }

  return false;
}

function canQueryFlight(leg) {
  var now = Date.now();

  return leg.departureApproxMillis >= now - (10 * DAY_MS) &&
    leg.departureApproxMillis <= now + (2 * DAY_MS);
}

function buildFlightUrl(leg) {
  return AEROAPI_BASE +
    '/flights/' + encodeURIComponent(leg.flightNumber) +
    '?ident_type=designator' +
    '&start=' + encodeURIComponent(
      addDaysToDateKey(leg.dateKey, -1)
    ) +
    '&end=' + encodeURIComponent(
      addDaysToDateKey(leg.dateKey, 2)
    );
}

function scheduledMillisForFlight(flight) {
  var scheduledTime =
    flight.scheduled_out || flight.scheduled_off || '';

  var millis = Date.parse(scheduledTime);

  return isNaN(millis) ? 0 : millis;
}

function findMatchingFlight(leg, data) {
  if (!data || !data.flights || !data.flights.length) {
    return null;
  }

  var bestFlight = null;
  var bestScore = Infinity;
  var maxMatchDistance = 18 * 60 * 60 * 1000;

  for (var i = 0; i < data.flights.length; i++) {
    var flight = data.flights[i];

    if (!airportMatches(flight.origin, leg.origin) ||
        !airportMatches(flight.destination, leg.destination)) {
      continue;
    }

    // Compare real instants, not the text date inside scheduled_out.
    // Late U.S. departures often have a next-day UTC calendar date even
    // though their local schedule day is still today.
    var scheduledMillis = scheduledMillisForFlight(flight);

    if (!scheduledMillis) {
      continue;
    }

    var score = Math.abs(
      scheduledMillis - leg.departureApproxMillis
    );

    // The endpoint spans several dates. Do not let a same-number flight
    // from a different day win just because the route is identical.
    if (score > maxMatchDistance) {
      continue;
    }

    if (score < bestScore) {
      bestScore = score;
      bestFlight = flight;
    }
  }

  return bestFlight;
}

function isFutureScheduledLeg(leg) {
  return leg.departureApproxMillis > Date.now();
}

function queryFlightAware(leg, callback) {
  var apiKey = localStorage.getItem('nextleg_aero_api_key') || '';

  if (!apiKey) {
    callback('KEY', null);
    return;
  }

  if (!canQueryFlight(leg)) {
    callback(null, null);
    return;
  }

  var xhr = new XMLHttpRequest();

  xhr.onload = function() {
    if (xhr.status !== 200) {
      callback('ERR', null);
      return;
    }

    try {
      var response = JSON.parse(xhr.responseText);
      callback(null, findMatchingFlight(leg, response));
    } catch (error) {
      callback('ERR', null);
    }
  };

  xhr.onerror = function() {
    callback('ERR', null);
  };

  try {
    xhr.open('GET', buildFlightUrl(leg), true);
    xhr.setRequestHeader('x-apikey', apiKey);
    xhr.send();
  } catch (error) {
    callback('ERR', null);
  }
}

function departureDelaySeconds(flight) {
  // Prefer AeroAPI's purpose-built delay field. It is already a duration
  // in seconds, so applying it to the entered local scheduled departure
  // avoids exposing UTC clock values on the watch. Do not cap it: delays
  // can extend into the next day.
  if (typeof flight.departure_delay === 'number') {
    return flight.departure_delay;
  }

  // Fallback only when the API does not provide departure_delay.
  if (flight.estimated_out && flight.scheduled_out) {
    return Date.parse(flight.estimated_out) -
      Date.parse(flight.scheduled_out);
  }

  return 0;
}

function statusForFlight(flight) {
  if (flight.cancelled) {
    return 'CNX';
  }

  if (flight.actual_in) {
    return 'ARR';
  }

  if (departureDelaySeconds(flight) > 300) {
    return 'DELAY';
  }

  return 'ON TIME';
}

function departureForFlight(leg, flight) {
  if (flight.cancelled) {
    return '--';
  }

  // The manual schedule is already in local origin time. Apply the delay
  // calculated from AeroAPI's estimated and scheduled timestamps, rather
  // than displaying the UTC clock portion of estimated_out directly.
  var delaySeconds = departureDelaySeconds(flight);

  if (delaySeconds > 60) {
    return addDelayToTime(
      leg.scheduledDeparture,
      delaySeconds
    );
  }

  return leg.scheduledDeparture;
}

function sendLiveFlightToWatch(leg, flight, routeOverride) {
  var gate = flight.gate_origin || '--';
  var departureTime = departureForFlight(leg, flight);
  var status = statusForFlight(flight);

  cacheActiveDisplay(gate, departureTime, status);

  sendWatchMessage(
    leg.flightNumber,
    routeOverride || leg.route,
    gate,
    departureTime,
    status
  );
}

function sendPostFlightHold(legs, index, flight) {
  var nextLeg = index + 1 < legs.length ?
    legs[index + 1] : null;

  var routeText = nextLeg ?
    'REPORT ' + reportTimeForLeg(nextLeg) :
    legs[index].route;

  cacheActiveDisplay('--', '--', 'ARR');

  sendWatchMessage(
    legs[index].flightNumber,
    routeText,
    '--',
    '--',
    'ARR'
  );
}

function showSavedState(legs, index) {
  if (index < 0 || index >= legs.length) {
    sendNoSchedule();
    return;
  }

  var leg = legs[index];
  var heldArrival = getHeldArrivalMillis();

  if (heldArrival && isLastFlightOfDay(legs, index)) {
    if (Date.now() < heldArrival + HOTEL_HOLD_MS) {
      var nextLeg = index + 1 < legs.length ?
        legs[index + 1] : null;

      var routeText = nextLeg ?
        'REPORT ' + reportTimeForLeg(nextLeg) :
        leg.route;

      sendWatchMessage(
        leg.flightNumber,
        routeText,
        '--',
        '--',
        'ARR'
      );
      return;
    }

    reconcileFromIndex(legs, index + 1);
    return;
  }

  if (isMoreThanSixHoursAway(leg)) {
    sendReportMode(leg);
    return;
  }

  sendWatchMessage(
    leg.flightNumber,
    leg.route,
    getCachedGate(),
    getCachedDeparture() === '--' ?
      leg.scheduledDeparture : getCachedDeparture(),
    getCachedStatus()
  );
}

function finishSchedule() {
  resetActiveState();
  sendNoSchedule();
}

function reconcileFromIndex(legs, index) {
  if (index >= legs.length) {
    finishSchedule();
    return;
  }

  var leg = legs[index];

  // On a fresh scan, skip completed prior-day schedule lines before calling
  // AeroAPI. This is the safeguard that makes the DD column authoritative.
  if (isCompletedPreviousScheduleDay(leg)) {
    reconcileFromIndex(legs, index + 1);
    return;
  }

  setActiveIndex(index);
  clearHeldArrivalMillis();
  clearActiveDisplayCache();

  if (isTooOldToQuery(leg)) {
    reconcileFromIndex(legs, index + 1);
    return;
  }

  if (isMoreThanSixHoursAway(leg)) {
    sendReportMode(leg);
    return;
  }

  if (!canQueryFlight(leg)) {
    sendScheduledLeg(leg);
    return;
  }

  queryFlightAware(leg, function(error, flight) {
    if (error) {
      if (shouldAdvanceAfterMissingFlight(leg)) {
        reconcileFromIndex(legs, index + 1);
        return;
      }

      sendScheduledLeg(leg, error);
      return;
    }

    // On a previous calendar day, a missing exact FlightAware result
    // should not trap the watch on an old schedule line.
    if (!flight) {
      if (shouldAdvanceAfterMissingFlight(leg)) {
        reconcileFromIndex(legs, index + 1);
        return;
      }

      sendScheduledLeg(leg);
      return;
    }

    if (flight.cancelled) {
      sendLiveFlightToWatch(leg, flight);
      return;
    }

    // Never advance past a manually scheduled future leg. This protects
    // against a stale completed record for the same flight number/route.
    if (flight.actual_in && isFutureScheduledLeg(leg)) {
      sendScheduledLeg(leg);
      return;
    }

    if (flight.actual_in) {
      var actualInMillis = Date.parse(flight.actual_in);

      if (!isNaN(actualInMillis) &&
          isLastFlightOfDay(legs, index) &&
          Date.now() < actualInMillis + HOTEL_HOLD_MS) {
        setHeldArrivalMillis(actualInMillis);
        sendPostFlightHold(legs, index, flight);
        return;
      }

      reconcileFromIndex(legs, index + 1);
      return;
    }

    sendLiveFlightToWatch(leg, flight);
  });
}

function refreshActiveLeg() {
  var legs = getLegs();

  if (!legs.length) {
    sendNoSchedule();
    return;
  }

  var activeIndex = getActiveIndex();

  if (activeIndex < 0 || activeIndex >= legs.length) {
    reconcileFromIndex(legs, 0);
    return;
  }

  var leg = legs[activeIndex];
  var heldArrival = getHeldArrivalMillis();

  if (heldArrival && isLastFlightOfDay(legs, activeIndex)) {
    if (Date.now() >= heldArrival + HOTEL_HOLD_MS) {
      reconcileFromIndex(legs, activeIndex + 1);
      return;
    }
  }

  if (isCompletedPreviousScheduleDay(leg)) {
    reconcileFromIndex(legs, activeIndex + 1);
    return;
  }

  if (isTooOldToQuery(leg)) {
    reconcileFromIndex(legs, activeIndex + 1);
    return;
  }

  if (isMoreThanSixHoursAway(leg)) {
    sendReportMode(leg);
    return;
  }

  if (!canQueryFlight(leg)) {
    showSavedState(legs, activeIndex);
    return;
  }

  queryFlightAware(leg, function(error, flight) {
    if (error) {
      if (shouldAdvanceAfterMissingFlight(leg)) {
        reconcileFromIndex(legs, activeIndex + 1);
        return;
      }

      sendScheduledLeg(leg, error);
      return;
    }

    if (!flight) {
      if (shouldAdvanceAfterMissingFlight(leg)) {
        reconcileFromIndex(legs, activeIndex + 1);
        return;
      }

      sendScheduledLeg(leg);
      return;
    }

    if (flight.cancelled) {
      clearHeldArrivalMillis();
      sendLiveFlightToWatch(leg, flight);
      return;
    }

    // Never advance past a manually scheduled future leg. This protects
    // against a stale completed record for the same flight number/route.
    if (flight.actual_in && isFutureScheduledLeg(leg)) {
      sendScheduledLeg(leg);
      return;
    }

    if (flight.actual_in) {
      var actualInMillis = Date.parse(flight.actual_in);

      if (!isNaN(actualInMillis) &&
          isLastFlightOfDay(legs, activeIndex) &&
          Date.now() < actualInMillis + HOTEL_HOLD_MS) {
        setHeldArrivalMillis(actualInMillis);
        sendPostFlightHold(legs, activeIndex, flight);
        return;
      }

      reconcileFromIndex(legs, activeIndex + 1);
      return;
    }

    clearHeldArrivalMillis();
    sendLiveFlightToWatch(leg, flight);
  });
}

function restoreCachedActiveDisplay() {
  var legs = getLegs();

  if (!legs.length) {
    sendNoSchedule();
    return;
  }

  var activeIndex = getActiveIndex();

  if (activeIndex < 0 || activeIndex >= legs.length) {
    sendNoSchedule();
    return;
  }

  var leg = legs[activeIndex];
  var heldArrival = getHeldArrivalMillis();

  if (heldArrival && isLastFlightOfDay(legs, activeIndex) &&
      Date.now() < heldArrival + HOTEL_HOLD_MS) {
    var nextLeg = activeIndex + 1 < legs.length ?
      legs[activeIndex + 1] : null;

    sendWatchMessage(
      leg.flightNumber,
      nextLeg ? 'REPORT ' + reportTimeForLeg(nextLeg) : leg.route,
      '--',
      '--',
      'ARR'
    );
    return;
  }

  if (isMoreThanSixHoursAway(leg)) {
    sendReportMode(leg);
    return;
  }

  sendWatchMessage(
    leg.flightNumber,
    leg.route,
    getCachedGate(),
    getCachedDeparture() === '--' ?
      leg.scheduledDeparture : getCachedDeparture(),
    getCachedStatus()
  );
}

function initialiseCompanion() {
  var legs = getLegs();

  if (!legs.length) {
    sendNoSchedule();
    return;
  }

  if (localStorage.getItem('nextleg_state_version') !== STATE_VERSION) {
    localStorage.setItem('nextleg_state_version', STATE_VERSION);
    resetActiveState();
  }

  var activeIndex = getActiveIndex();

  if (activeIndex < 0 || activeIndex >= legs.length) {
    reconcileFromIndex(legs, 0);
    return;
  }

  // Recheck saved state after a phone/watch restart. A leg whose
  // calculated arrival belongs to a completed prior day is not eligible.
  if (isCompletedPreviousScheduleDay(legs[activeIndex])) {
    reconcileFromIndex(legs, activeIndex + 1);
    return;
  }

  showSavedState(legs, activeIndex);
}

Pebble.addEventListener('ready', function() {
  console.log('Next Leg companion ready');
  initialiseCompanion();
});

Pebble.addEventListener('showConfiguration', function() {
  Pebble.openURL(clay.generateUrl());
});

Pebble.addEventListener('webviewclosed', function(e) {
  if (!e || !e.response) {
    return;
  }

  var settings = clay.getSettings(e.response, false);

  var aeroApiKey = getClayValue(settings, 'AeroApiKey')
    .replace(/\s+/g, '');

  var airlineCode = normaliseAirlineCode(
    getClayValue(settings, 'AirlineCode')
  );

  var reportLeadMinutes = parseReportLeadMinutes(
    getClayValue(settings, 'ReportLeadTime')
  );

  var scheduleText = getClayValue(settings, 'ScheduleText');

  localStorage.setItem('nextleg_aero_api_key', aeroApiKey);
  localStorage.setItem('nextleg_airline_code', airlineCode);
  localStorage.setItem(
    'nextleg_report_lead_minutes',
    String(reportLeadMinutes)
  );
  localStorage.setItem('nextleg_schedule', scheduleText);
  localStorage.setItem('nextleg_state_version', STATE_VERSION);

  resetActiveState();
  reconcileFromIndex(getLegs(), 0);
});

Pebble.addEventListener('appmessage', function(e) {
  if (e.payload.RefreshRequest !== 1) {
    return;
  }

  var now = Date.now();
  var lastRefresh = parseInt(
    localStorage.getItem('nextleg_last_refresh_millis'),
    10
  );

  if (!isNaN(lastRefresh) &&
      now - lastRefresh < REFRESH_COOLDOWN_MS) {
    console.log('Refresh ignored: 60-second cooldown');
    // The watch briefly says SYNC after a shake. Send its cached state
    // back without querying AeroAPI so the display immediately restores.
    restoreCachedActiveDisplay();
    return;
  }

  localStorage.setItem(
    'nextleg_last_refresh_millis',
    String(now)
  );

  refreshActiveLeg();
});
